package br.com.axecloud.app.feature.home

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.provider.OpenableColumns
import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.cache.HomeCache
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionSnapshot
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton
import dagger.hilt.android.qualifiers.ApplicationContext

@Singleton
class HomeRepository @Inject constructor(
    private val http: AxeCloudHttpClient,
    private val sessions: SessionStore,
    private val homeCache: HomeCache,
    @ApplicationContext private val context: Context,
) {
    fun session(): SessionSnapshot = sessions.current()

    suspend fun acknowledgePrecept(id: String) {
        val session = authenticatedSession()
        http.post(
            api("/api/v1/preceitos/${encode(id)}/acknowledge"),
            buildJsonObject { put("tenantId", session.tenantId) },
            session.accessToken,
        )
    }

    suspend fun requestPreceptGuidance(id: String) {
        val session = authenticatedSession()
        http.post(
            api("/api/v1/preceitos/${encode(id)}/guidance"),
            buildJsonObject { put("tenantId", session.tenantId) },
            session.accessToken,
        )
    }

    suspend fun loadMessages(conversationId: String): List<ChatMessage> {
        val session = authenticatedSession()
        val root = http.get(
            api("/api/v1/chat/conversations/${encode(conversationId)}/messages?limit=80"),
            session.accessToken,
        ).asObject()
        runCatching {
            http.post(
                api("/api/v1/chat/conversations/${encode(conversationId)}/read"),
                buildJsonObject { },
                session.accessToken,
            )
        }
        return root.array("messages", "data").map { element ->
            val item = element.asObject()
            ChatMessage(
                id = item.text("id"),
                body = item.text("body", "message").ifBlank { when (item.text("messageType")) {
                    "audio" -> "Áudio"
                    "image" -> "Imagem"
                    "video" -> "Vídeo"
                    else -> "Mensagem"
                } },
                senderName = item.text("senderNome", "senderName").ifBlank { "Casa" },
                createdAt = item.text("createdAt", "created_at"),
                isOwn = item.bool("isOwn", "is_own") == true,
                mediaType = item.text("messageType", "message_type").ifBlank { "text" },
                mediaUrl = item.text("mediaUrl", "media_url"),
                mediaMime = item.text("mediaMime", "media_mime"),
            )
        }
    }

    suspend fun sendTextMessage(conversationId: String, body: String) {
        val session = authenticatedSession()
        http.post(
            api("/api/v1/chat/conversations/${encode(conversationId)}/messages"),
            buildJsonObject {
                put("body", body.trim())
                put("messageType", "text")
            },
            session.accessToken,
        )
    }

    suspend fun sendMediaMessage(conversationId: String, uri: Uri) {
        val session = authenticatedSession()
        val mime = context.contentResolver.getType(uri) ?: when { uri.path?.endsWith(".m4a", true) == true -> "audio/mp4"; uri.path?.endsWith(".jpg", true) == true -> "image/jpeg"; else -> "application/octet-stream" }
        check(mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/")) { "Escolha uma imagem, vídeo ou áudio." }
        val bytes = if (uri.scheme == "file") java.io.File(uri.path!!).readBytes() else context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Não foi possível ler o arquivo.")
        val fileName = if (uri.scheme == "file") java.io.File(uri.path!!).name else context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null } ?: uri.lastPathSegment ?: "midia"
        val prep = http.post(api("/api/v1/chat/upload-url"), buildJsonObject {
            put("tenantId", session.tenantId); put("conversationId", conversationId); put("fileName", fileName); put("contentType", mime); put("sizeBytes", bytes.size)
        }, session.accessToken).asObject()
        http.putBytes(prep.text("uploadUrl"), bytes, mime)
        http.post(api("/api/v1/chat/conversations/${encode(conversationId)}/messages"), buildJsonObject {
            put("body", ""); put("messageType", prep.text("messageType")); put("mediaUrl", prep.text("publicUrl")); put("mediaPath", prep.text("storageKey")); put("mediaMime", mime)
        }, session.accessToken)
    }

    suspend fun settleMonthlyPayment(id: String, amount: Double) {
        val session = authenticatedSession()
        http.post(
            api("/api/v1/financial/mensalidades/liquidar"),
            buildJsonObject {
                put("id", id)
                put("tenant_id", session.tenantId)
                if (amount > 0) put("valor", amount)
            },
            session.accessToken,
        )
    }

    suspend fun createEvent(title: String, date: String, time: String, type: String, description: String) {
        val session = authenticatedSession()
        check(!session.isFilho) { "Somente a zeladoria pode criar giras." }
        http.post(
            api("/api/events"),
            buildJsonObject {
                put("titulo", title.trim())
                put("data", date.trim())
                put("hora", time.trim())
                put("tipo", type.trim().ifBlank { "Gira" })
                put("descricao", description.trim())
                put("status_confirmacao", "Confirmado")
                put("evento_publico", false)
            },
            session.accessToken,
        )
    }

    suspend fun updatePrayerStatus(id: String, status: String) {
        val session = authenticatedSession()
        check(!session.isFilho) { "Somente a zeladoria pode acolher pedidos." }
        http.patch(
            api("/api/v1/atendimentos/pedidos-reza/${encode(id)}"),
            buildJsonObject {
                put("tenantId", session.tenantId)
                put("status", status)
            },
            session.accessToken,
        )
    }

    suspend fun createAlbum(name: String, description: String) {
        val session = authenticatedSession()
        check(!session.isFilho) { "Somente a zeladoria pode criar álbuns." }
        http.post(
            api("/api/v1/gallery/albums"),
            buildJsonObject {
                put("tenantId", session.tenantId)
                put("name", name.trim())
                put("description", description.trim())
                put("category", "lembranca")
            },
            session.accessToken,
        )
    }

    suspend fun addInventoryItem(name: String, category: String, current: Int, minimum: Int) {
        val session = authenticatedSession()
        check(!session.isFilho) { "Somente a zeladoria pode alterar o estoque." }
        http.post(
            api("/api/inventory"),
            buildJsonObject {
                put("item", name.trim())
                put("categoria", category.trim().ifBlank { "Geral" })
                put("quantidade_atual", current.coerceAtLeast(0))
                put("quantidade_minima", minimum.coerceAtLeast(0))
                put("tenantId", session.tenantId)
                put("autorId", session.userId)
            },
            session.accessToken,
        )
    }

    suspend fun addStoreProduct(name: String, description: String, price: Double, stock: Int) {
        val session = authenticatedSession()
        check(!session.isFilho) { "Somente a zeladoria pode cadastrar produtos." }
        http.post(
            api("/api/v1/store/products"),
            buildJsonObject {
                put("tenantId", session.tenantId)
                put("nome", name.trim())
                put("descricao", description.trim())
                put("preco", price.coerceAtLeast(0.0))
                put("estoque_atual", stock.coerceAtLeast(0))
                put("estoque_minimo", 0)
                put("categoria", "Outros")
            },
            session.accessToken,
        )
    }

    suspend fun uploadProfilePhoto(uri: Uri) {
        val session = authenticatedSession()
        val (mime, encoded) = readImage(uri)
        val endpoint = if (session.isFilho) "/api/v1/filho/profile-photo" else "/api/v1/profile/upload-photo"
        val response = http.post(
            api(endpoint),
            buildJsonObject {
                put("fileData", encoded)
                put("contentType", mime)
                if (!session.isFilho) put("fileName", "${session.userId}-${System.currentTimeMillis()}.${mime.substringAfter('/')}")
            },
            session.accessToken,
        ).asObject()
        val url = response.text("publicUrl", "url")
        check(url.isNotBlank()) { "O servidor não retornou a nova foto." }
        if (!session.isFilho) {
            http.patch(
                api("/api/v1/profile/photo"),
                buildJsonObject {
                    put("photoUrl", url)
                },
                session.accessToken,
            )
        }
        sessions.save(session.copy(profilePhotoUrl = url))
    }

    suspend fun validatePaymentReceipt(uri: Uri) {
        val session = authenticatedSession()
        check(session.isFilho) { "O envio de comprovante pertence ao acesso do filho de santo." }
        val (mime, encoded) = readImage(uri)
        val result = http.post(
            api("/api/v1/financeiro/validar-comprovante"),
            buildJsonObject {
                put("tenant_id", session.tenantId)
                put("fileData", encoded)
                put("contentType", mime)
            },
            session.accessToken,
        ).asObject()
        check(result.bool("success") != false) { result.text("error", "message").ifBlank { "Não foi possível validar o comprovante." } }
    }

    suspend fun load(): HomeSnapshot {
        val session = sessions.current()
        check(session.isAuthenticated) { "Entre novamente para continuar." }
        val cacheKey = "${session.tenantId}:${session.userId}:${session.role}"
        return try {
            val fresh = if (session.isFilho) loadFilho(session) else loadZelador(session)
            homeCache.save(cacheKey, fresh)
            fresh
        } catch (error: Throwable) {
            homeCache.read(cacheKey) ?: throw error
        }
    }

    suspend fun markNotificationRead(id: String?) {
        val session = authenticatedSession()
        val path = if (id == null) "/api/notifications/read-all" else "/api/notifications/${encode(id)}/read"
        http.patch(api(path), buildJsonObject { put("tenantId", session.tenantId) }, session.accessToken)
    }

    private suspend fun loadFilho(session: SessionSnapshot): HomeSnapshot = coroutineScope {
        val tenant = encode(session.tenantId)
        val homeCall = async { http.get(api("/api/v1/filho/home"), session.accessToken) }
        val preceptsCall = async { safeGet("/api/v1/preceitos/current?tenantId=$tenant", session.accessToken) }
        val libraryCall = async { safeGet("/api/v1/library/materials?tenantId=$tenant", session.accessToken) }
        val chatsCall = async { safeGet("/api/v1/chat/conversations?tenantId=$tenant", session.accessToken) }
        val pixCall = async { safeGet("/api/v1/financial/pix-config?tenantId=$tenant", session.accessToken) }
        val galleryCall = async { safeGet("/api/v1/gallery/albums?tenantId=$tenant", session.accessToken) }
        val storeCall = async { safeGet("/api/v1/store/products?tenantId=$tenant", session.accessToken) }
        val transactionsCall = async {
            safeGet("/api/transactions?tenantId=$tenant&userId=${encode(session.userId)}&userRole=filho&limit=100", session.accessToken)
        }
        val root = homeCall.await().asObject()
        val child = root.obj("child")
        val financialStatus = root.text("financialStatus", "financial_status").lowercase()
        val notices = root.array("notices")
        val name = child.text("nome", "name", "full_name").firstName()
        val pending = if (financialStatus in listOf("pago", "paid", "em_dia", "em dia", "")) 0 else 1
        val inGoodStanding = pending == 0
        val pix = pixCall.await().asObject().obj("data")
        val monthlyActive = pix.bool("mensalidade_ativa") != false
        val monthlyValue = pix.number("valor_mensalidade")
        val pixKey = pix.text("chave_pix")
        val pixPayload = if (monthlyActive && pixKey.isNotBlank() && monthlyValue > 0) buildPixPayload(
            key = pixKey,
            beneficiary = pix.text("nome_beneficiario").ifBlank { session.houseName },
            value = monthlyValue,
            txid = child.text("id").ifBlank { session.userId },
        ) else ""
        HomeSnapshot(
            greetingName = name.ifBlank { "irmão" },
            houseName = session.houseName,
            isFilho = true,
            primaryMetric = if (inGoodStanding) "Em dia" else pending.toString(),
            primaryLabel = "Mensalidade",
            secondaryMetric = notices.size.toString(),
            secondaryLabel = "Avisos da casa",
            notices = notices.size,
            events = root.array("events", "giras").size,
            nextAction = if (inGoodStanding) "Confira a agenda e os recados da casa" else "Regularize sua mensalidade",
            financialMessage = if (inGoodStanding) "Tudo certo por aqui" else "$pending cobrança(s) pendente(s)",
            eventItems = root.array("events", "giras").map { it.asObject().toEventItem() },
            noticeItems = notices.map { it.asObject().toNoticeItem() },
            preceptItems = preceptsCall.await().asList("data", "items").map { it.asObject().toPreceptItem() },
            libraryItems = libraryCall.await().asList("data", "items", "materials").take(20).map { it.asObject().toLibraryItem() },
            conversationItems = chatsCall.await().asList("conversations", "data", "items").take(20).map { it.asObject().toConversationItem() },
            monthlyActive = monthlyActive,
            monthlyValue = monthlyValue,
            monthlyDueDay = pix.number("dia_vencimento").toInt().takeIf { it in 1..31 } ?: 10,
            pixPayload = pixPayload,
            pixBeneficiary = pix.text("nome_beneficiario"),
            profilePhotoUrl = session.profilePhotoUrl.ifBlank { child.text("foto_url", "photo_url") },
            galleryItems = galleryCall.await().asList("albums", "data", "items").map { it.asObject().toGalleryItem() },
            storeItems = storeCall.await().asList("data", "items", "products").map { it.asObject().toStoreItem() },
            transactionItems = transactionsCall.await().asList("transactions", "items", "data").map { it.asObject().toTransactionItem() },
        )
    }

    private suspend fun loadZelador(session: SessionSnapshot): HomeSnapshot = coroutineScope {
        val query = "tenantId=${encode(session.tenantId)}&userId=${encode(session.userId)}&userRole=${encode(session.role)}"
        val childrenCall = async { safeGet("/api/children?$query", session.accessToken) }
        val transactionsCall = async { safeGet("/api/transactions?$query&limit=400", session.accessToken) }
        val eventsCall = async { safeGet("/api/events?tenantId=${encode(session.tenantId)}&scope=calendar", session.accessToken) }
        val noticesCall = async { safeGet("/api/notices?tenantId=${encode(session.tenantId)}", session.accessToken) }
        val notificationsCall = async { safeGet("/api/notifications?tenantId=${encode(session.tenantId)}&limit=50", session.accessToken) }
        val prayersCall = async { safeGet("/api/v1/atendimentos/pedidos-reza?tenantId=${encode(session.tenantId)}", session.accessToken) }
        val preceptsCall = async { safeGet("/api/v1/preceitos?tenantId=${encode(session.tenantId)}", session.accessToken) }
        val libraryCall = async { safeGet("/api/v1/library/materials?tenantId=${encode(session.tenantId)}", session.accessToken) }
        val chatsCall = async { safeGet("/api/v1/chat/conversations?tenantId=${encode(session.tenantId)}", session.accessToken) }
        val monthlyCall = async { safeGet("/api/v1/financial/mensalidades?tenantId=${encode(session.tenantId)}&view=pendentes", session.accessToken) }
        val paidMonthlyCall = async { safeGet("/api/v1/financial/mensalidades?tenantId=${encode(session.tenantId)}&view=pagas", session.accessToken) }
        val galleryCall = async { safeGet("/api/v1/gallery/albums?tenantId=${encode(session.tenantId)}", session.accessToken) }
        val inventoryCall = async { safeGet("/api/inventory?tenantId=${encode(session.tenantId)}", session.accessToken) }
        val storeCall = async { safeGet("/api/v1/store/products?tenantId=${encode(session.tenantId)}", session.accessToken) }

        val children = childrenCall.await().asList("children", "items", "data")
        val transactions = transactionsCall.await().asList("transactions", "items", "data")
        val events = eventsCall.await().asList("events", "items", "data")
        val notices = noticesCall.await().asList("notices", "items", "data")
        val notifications = notificationsCall.await().asList("notifications", "items", "data")
        val prayers = prayersCall.await().asList("pedidos", "items", "data")
        val balance = transactions.sumOf { item ->
            val obj = item.asObject()
            val value = obj.number("valor", "value", "amount")
            val flow = obj.text("fluxo", "flow", "type").lowercase()
            if (flow.contains("saída") || flow.contains("saida") || flow.contains("expense")) -value else value
        }
        HomeSnapshot(
            greetingName = session.email.substringBefore('@').firstName().ifBlank { "zelador" },
            houseName = session.houseName,
            primaryMetric = children.count { it.asObject().text("status").lowercase() !in listOf("inativo", "inactive") }.toString(),
            primaryLabel = "Filhos ativos",
            secondaryMetric = balance.asCurrency(),
            secondaryLabel = "Saldo da casa",
            notices = notifications.count { item -> item.asObject().bool("lida", "read") != true }.takeIf { it > 0 } ?: notices.size,
            events = events.size,
            nextAction = when {
                prayers.isNotEmpty() -> "Acolha ${prayers.size} pedido(s) de reza"
                events.isEmpty() -> "Agende a próxima gira"
                notices.isEmpty() -> "Publique um aviso para a corrente"
                else -> "Acompanhe o movimento da casa"
            },
            financialMessage = "${transactions.size} movimentações registradas",
            eventItems = events.take(20).map { it.asObject().toEventItem() },
            noticeItems = (notifications.ifEmpty { notices }).take(20).map { it.asObject().toNoticeItem() },
            preceptItems = preceptsCall.await().asList("data", "items").take(20).map { it.asObject().toPreceptItem() },
            libraryItems = libraryCall.await().asList("data", "items", "materials").take(20).map { it.asObject().toLibraryItem() },
            conversationItems = chatsCall.await().asList("conversations", "data", "items").take(20).map { it.asObject().toConversationItem() },
            monthlyActive = true,
            monthlyItems = monthlyCall.await().asList("data", "items").map { it.asObject().toMonthlyItem() },
            paidMonthlyItems = paidMonthlyCall.await().asList("data", "items").map { it.asObject().toMonthlyItem() },
            transactionItems = transactions.take(100).map { it.asObject().toTransactionItem() },
            galleryItems = galleryCall.await().asList("albums", "data", "items").map { it.asObject().toGalleryItem() },
            inventoryItems = inventoryCall.await().asList("data", "items").map { it.asObject().toInventoryItem() },
            storeItems = storeCall.await().asList("data", "items", "products").map { it.asObject().toStoreItem() },
            prayerItems = prayers.map { it.asObject().toPrayerItem() },
            profilePhotoUrl = session.profilePhotoUrl,
        )
    }

    private suspend fun safeGet(path: String, token: String): JsonElement =
        runCatching { http.get(api(path), token) }.getOrElse { JsonArray(emptyList()) }

    private fun api(path: String) = BuildConfig.API_BASE_URL.trimEnd('/') + path
    private fun encode(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())
    private fun authenticatedSession(): SessionSnapshot = sessions.current().also {
        check(it.isAuthenticated) { "Entre novamente para continuar." }
    }

    private fun readImage(uri: Uri): Pair<String, String> {
        val mime = context.contentResolver.getType(uri)?.lowercase() ?: "image/jpeg"
        check(mime in setOf("image/jpeg", "image/png", "image/webp")) { "Escolha uma imagem JPEG, PNG ou WebP." }
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: error("Não foi possível ler a imagem.")
        check(bytes.size <= 5 * 1024 * 1024) { "A imagem deve ter no máximo 5 MB." }
        return mime to Base64.encodeToString(bytes, Base64.NO_WRAP)
    }
}

private fun JsonElement?.asObject(): JsonObject = this as? JsonObject ?: JsonObject(emptyMap())
private fun JsonObject.obj(key: String): JsonObject = this[key].asObject()
private fun JsonObject.array(vararg keys: String): JsonArray = keys.firstNotNullOfOrNull { this[it] as? JsonArray } ?: JsonArray(emptyList())
private fun JsonElement.asList(vararg keys: String): List<JsonElement> = when (this) {
    is JsonArray -> this
    is JsonObject -> keys.firstNotNullOfOrNull { this[it] as? JsonArray } ?: emptyList()
    else -> emptyList()
}
private fun JsonObject.text(vararg keys: String): String = keys.firstNotNullOfOrNull { key ->
    runCatching { this[key]?.jsonPrimitive?.content }.getOrNull()?.takeIf(String::isNotBlank)
}.orEmpty()
private fun JsonObject.number(vararg keys: String): Double = keys.firstNotNullOfOrNull { key ->
    runCatching { this[key]?.jsonPrimitive?.doubleOrNull }.getOrNull()
} ?: 0.0
private fun JsonObject.bool(vararg keys: String): Boolean? = keys.firstNotNullOfOrNull { key ->
    runCatching { this[key]?.jsonPrimitive?.content?.toBooleanStrictOrNull() }.getOrNull()
}
private fun String.firstName() = trim().substringBefore(' ').replaceFirstChar { it.uppercase() }
private fun Double.asCurrency(): String = "R$ " + String.format(java.util.Locale("pt", "BR"), "%,.2f", this)
private fun JsonObject.toEventItem() = HomeFeedItem(
    id = text("id"),
    title = text("titulo", "title", "nome", "name").ifBlank { "Gira da casa" },
    detail = listOf(text("data", "date", "start_date", "starts_at"), text("hora", "horario", "time")).filter(String::isNotBlank).joinToString(" · "),
)
private fun JsonObject.toNoticeItem() = HomeFeedItem(
    id = text("id"),
    title = text("titulo", "title", "assunto", "subject", "tipo").ifBlank { "Aviso da casa" },
    detail = text("conteudo", "content", "mensagem", "message", "descricao").take(100),
    status = if (containsKey("lida")) if (bool("lida") == true) "server:read" else "server:unread" else "",
)
private fun JsonObject.toPreceptItem() = HomeFeedItem(
    id = text("id"),
    title = text("titulo", "title").ifBlank { "Preceito da casa" },
    detail = listOf(text("tipo", "type"), text("inicio_em", "start_date"), text("fim_em", "end_date")).filter(String::isNotBlank).joinToString(" · "),
    status = obj("participacao").text("status").ifBlank { text("status") },
)
private fun JsonObject.toLibraryItem() = HomeFeedItem(
    id = text("id"),
    title = text("titulo", "title", "nome", "name").ifBlank { "Material de estudo" },
    detail = text("categoria", "category", "descricao", "description"),
    url = text("arquivo_url", "fileUrl", "url"),
)
private fun JsonObject.toConversationItem() = HomeFeedItem(
    id = text("id"),
    title = text("title", "titulo").ifBlank {
        obj("peer").text("name", "nome", "displayName").ifBlank { "Conversa da casa" }
    },
    detail = text("lastMessagePreview", "ultima_mensagem", "message").ifBlank { "Abra para acompanhar" },
    status = number("unreadCount", "unread_count").toInt().takeIf { it > 0 }?.toString().orEmpty(),
)
private fun JsonObject.toMonthlyItem() = HomeFeedItem(
    id = text("id"),
    title = text("nome", "filho_nome", "child_name").ifBlank {
        obj("filhos_de_santo").text("nome", "name").ifBlank { text("descricao").ifBlank { "Mensalidade" } }
    },
    detail = listOf(text("vencimento", "data_vencimento", "due_date"), text("status")).filter(String::isNotBlank).joinToString(" · "),
    status = text("status").ifBlank { "pendente" },
    amount = number("valor", "value", "amount"),
)
private fun JsonObject.toTransactionItem() = HomeFeedItem(
    id = text("id"),
    title = text("descricao", "description", "categoria", "category").ifBlank { "Movimentação financeira" },
    detail = listOf(text("data", "date", "created_at"), text("categoria", "category")).filter(String::isNotBlank).joinToString(" · "),
    status = text("fluxo", "flow", "tipo", "type", "status"),
    amount = number("valor", "value", "amount"),
)
private fun JsonObject.toGalleryItem(): HomeFeedItem {
    val firstMedia = array("media").firstOrNull().asObject()
    return HomeFeedItem(
        id = text("id"),
        title = text("nome", "name", "titulo", "title").ifBlank { "Álbum da casa" },
        detail = "${array("media").size} memória(s)",
        url = firstMedia.text("public_url", "url", "media_url", "arquivo_url"),
    )
}
private fun JsonObject.toInventoryItem() = HomeFeedItem(
    id = text("id"),
    title = text("item", "nome", "name").ifBlank { "Item do estoque" },
    detail = text("categoria", "category"),
    status = if (number("quantidade_atual") <= number("quantidade_minima")) "estoque baixo" else "disponível",
    amount = number("quantidade_atual", "quantity"),
)
private fun JsonObject.toStoreItem() = HomeFeedItem(
    id = text("id"),
    title = text("nome", "name").ifBlank { "Produto da casa" },
    detail = text("descricao", "description", "categoria"),
    url = text("imagem_url", "image_url"),
    status = if (number("estoque_atual", "stock") > 0) "disponível" else "esgotado",
    amount = number("preco", "price"),
)
private fun JsonObject.toPrayerItem() = HomeFeedItem(
    id = text("id"),
    title = text("nome", "name").ifBlank { "Pedido de reza" },
    detail = listOf(text("categoria"), text("vela"), text("pedido", "mensagem", "descricao")).filter(String::isNotBlank).joinToString(" · ").take(140),
    status = text("status").ifBlank { "pendente" },
)

private fun buildPixPayload(key: String, beneficiary: String, value: Double, txid: String): String {
    fun field(id: String, value: String) = id + value.toByteArray(Charsets.UTF_8).size.toString().padStart(2, '0') + value
    val cleanName = beneficiary.uppercase().replace(Regex("[^A-Z0-9 ]"), "").take(25).ifBlank { "TERREIRO" }
    val cleanTxid = txid.filter(Char::isLetterOrDigit).take(25).padEnd(5, '0')
    val merchant = field("00", "br.gov.bcb.pix") + field("01", key.trim()) + field("02", "Mensalidade")
    val additional = field("05", cleanTxid)
    val raw = "000201" + "010212" + field("26", merchant) + "52040000" + "5303986" +
        field("54", String.format(java.util.Locale.US, "%.2f", value)) + "5802BR" + field("59", cleanName) +
        field("60", "BRASIL") + field("62", additional) + "6304"
    var crc = 0xFFFF
    raw.toByteArray(Charsets.UTF_8).forEach { byte ->
        crc = crc xor ((byte.toInt() and 0xFF) shl 8)
        repeat(8) { crc = if ((crc and 0x8000) != 0) (crc shl 1) xor 0x1021 else crc shl 1 }
        crc = crc and 0xFFFF
    }
    return raw + crc.toString(16).uppercase().padStart(4, '0')
}
