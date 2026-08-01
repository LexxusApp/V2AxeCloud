package br.com.axecloud.app.feature.home

import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionSnapshot
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HomeRepository @Inject constructor(
    private val http: AxeCloudHttpClient,
    private val sessions: SessionStore,
) {
    fun session(): SessionSnapshot = sessions.current()

    suspend fun load(): HomeSnapshot {
        val session = sessions.current()
        check(session.isAuthenticated) { "Entre novamente para continuar." }
        return if (session.isFilho) loadFilho(session) else loadZelador(session)
    }

    private suspend fun loadFilho(session: SessionSnapshot): HomeSnapshot = coroutineScope {
        val tenant = encode(session.tenantId)
        val homeCall = async { http.get(api("/api/v1/filho/home"), session.accessToken) }
        val preceptsCall = async { safeGet("/api/v1/preceitos/current?tenantId=$tenant", session.accessToken) }
        val libraryCall = async { safeGet("/api/v1/library/materials?tenantId=$tenant", session.accessToken) }
        val chatsCall = async { safeGet("/api/v1/chat/conversations?tenantId=$tenant", session.accessToken) }
        val root = homeCall.await().asObject()
        val child = root.obj("child")
        val financial = root.obj("financialStatus")
        val notices = root.array("notices")
        val name = child.text("nome", "name", "full_name").firstName()
        val pending = financial.number("pendingCount", "pending_count", "pendentes").toInt()
        val inGoodStanding = financial.bool("isUpToDate", "em_dia") ?: (pending == 0)
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
        )
    }

    private suspend fun safeGet(path: String, token: String): JsonElement =
        runCatching { http.get(api(path), token) }.getOrElse { JsonArray(emptyList()) }

    private fun api(path: String) = BuildConfig.API_BASE_URL.trimEnd('/') + path
    private fun encode(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())
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
    title = text("titulo", "title", "nome", "name").ifBlank { "Gira da casa" },
    detail = listOf(text("data", "date", "start_date", "starts_at"), text("horario", "time")).filter(String::isNotBlank).joinToString(" · "),
)
private fun JsonObject.toNoticeItem() = HomeFeedItem(
    title = text("titulo", "title", "assunto", "subject", "tipo").ifBlank { "Aviso da casa" },
    detail = text("conteudo", "content", "mensagem", "message", "descricao").take(100),
)
private fun JsonObject.toPreceptItem() = HomeFeedItem(
    title = text("titulo", "title").ifBlank { "Preceito da casa" },
    detail = listOf(text("tipo", "type"), text("inicio_em", "start_date"), text("fim_em", "end_date")).filter(String::isNotBlank).joinToString(" · "),
)
private fun JsonObject.toLibraryItem() = HomeFeedItem(
    title = text("titulo", "title", "nome", "name").ifBlank { "Material de estudo" },
    detail = text("categoria", "category", "descricao", "description"),
)
private fun JsonObject.toConversationItem() = HomeFeedItem(
    title = text("title", "titulo").ifBlank {
        obj("peer").text("name", "nome", "displayName").ifBlank { "Conversa da casa" }
    },
    detail = text("lastMessagePreview", "ultima_mensagem", "message").ifBlank { "Abra para acompanhar" },
)
