package br.com.axecloud.app.feature.frequency

import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URLEncoder
import javax.inject.Inject

class FrequencyRepository @Inject constructor(private val http: AxeCloudHttpClient, private val sessions: SessionStore) {
    suspend fun load(): List<FrequencyMember> {
        val session = sessions.current()
        check(session.isAuthenticated && !session.isFilho) { "A frequência é administrada pela zeladoria." }
        val root = http.get(
            BuildConfig.API_BASE_URL.trimEnd('/') + "/api/v1/frequencia?tenantId=" + URLEncoder.encode(session.tenantId, "UTF-8"),
            session.accessToken,
        ).asObject()
        return root.array("data", "items").mapNotNull { element ->
            val item = element as? JsonObject ?: return@mapNotNull null
            FrequencyMember(
                id = item.text("filho_id", "id"),
                name = item.text("nome", "name"),
                role = item.text("cargo").ifBlank { "Filho de Santo" },
                photoUrl = item.text("foto_url"),
                totalEvents = item.int("total_eventos"),
                present = item.int("presentes", "confirmados"),
                absences = item.int("faltas"),
                attendance = item.int("assiduidade_pct").coerceIn(0, 100),
                history = item.array("historico").mapNotNull { historyElement ->
                    val history = historyElement as? JsonObject ?: return@mapNotNull null
                    FrequencyEvent(
                        id = history.text("event_id", "id"),
                        title = history.text("titulo", "title").ifBlank { "Gira" },
                        date = history.text("data", "date"),
                        type = history.text("tipo", "type"),
                        status = history.text("status").ifBlank { "pendente" },
                    )
                },
            )
        }
    }
}

private fun kotlinx.serialization.json.JsonElement.asObject() = runCatching { jsonObject }.getOrElse { JsonObject(emptyMap()) }
private fun JsonObject.array(vararg keys: String): JsonArray = keys.firstNotNullOfOrNull { runCatching { this[it]?.jsonArray }.getOrNull() } ?: JsonArray(emptyList())
private fun JsonObject.text(vararg keys: String) = keys.firstNotNullOfOrNull { runCatching { this[it]?.jsonPrimitive?.content }.getOrNull()?.takeIf(String::isNotBlank) }.orEmpty()
private fun JsonObject.int(vararg keys: String) = keys.firstNotNullOfOrNull { runCatching { this[it]?.jsonPrimitive?.content?.toInt() }.getOrNull() } ?: 0
