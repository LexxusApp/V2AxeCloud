package br.com.axecloud.app.feature.notices

import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.net.URLEncoder
import javax.inject.Inject

class NoticesRepository @Inject constructor(private val http: AxeCloudHttpClient, private val sessions: SessionStore) {
    suspend fun load(): Pair<Boolean, List<HouseNotice>> {
        val session = session()
        val root = http.get(api("/api/notices?tenantId=${encode(session.tenantId)}"), session.accessToken).asObject()
        return session.isFilho to root.array("data", "items", "notices").map { element ->
            val item = element.asObject()
            HouseNotice(
                id = item.text("id"), title = item.text("titulo", "title"), content = item.text("conteudo", "content", "body"),
                category = item.text("categoria", "category").ifBlank { "Geral" }, publishedAt = item.text("data_publicacao", "created_at"),
                expiresAt = item.text("expiracao", "expires_at"),
            )
        }
    }
    suspend fun publish(form: NoticeForm) {
        val session = session(); check(!session.isFilho) { "Somente a zeladoria pode publicar avisos." }
        http.post(api("/api/notices"), buildJsonObject {
            put("titulo", form.title.trim()); put("conteudo", form.content.trim()); put("categoria", form.category)
            put("tenantId", session.tenantId); put("autorId", session.userId); put("autorNome", session.email.substringBefore('@'))
            if (form.expiresAt.isNotBlank()) put("expiracao", form.expiresAt)
            put("notifyWhatsApp", false)
        }, session.accessToken)
    }
    suspend fun delete(id: String) {
        val session = session(); check(!session.isFilho) { "Acesso negado." }
        http.delete(api("/api/notices/${encode(id)}"), session.accessToken)
    }
    private fun session() = sessions.current().also { check(it.isAuthenticated) { "Entre novamente para continuar." } }
    private fun api(path: String) = BuildConfig.API_BASE_URL.trimEnd('/') + path
    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8")
}

private fun JsonElement?.asObject() = this as? JsonObject ?: JsonObject(emptyMap())
private fun JsonObject.array(vararg keys: String) = keys.firstNotNullOfOrNull { this[it] as? JsonArray } ?: JsonArray(emptyList())
private fun JsonObject.text(vararg keys: String) = keys.firstNotNullOfOrNull { runCatching { this[it]?.jsonPrimitive?.content }.getOrNull()?.takeIf(String::isNotBlank) }.orEmpty()
