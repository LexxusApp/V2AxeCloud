package br.com.axecloud.app.feature.giras

import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.net.URLEncoder
import javax.inject.Inject

class GirasRepository @Inject constructor(private val http: AxeCloudHttpClient, private val sessions: SessionStore) {
    suspend fun load(): Pair<Boolean, List<GiraEvent>> = coroutineScope {
        val session = session()
        val tenant = encode(session.tenantId)
        val eventsCall = async { http.get(api("/api/events?tenantId=$tenant&scope=calendar"), session.accessToken) }
        val extrasCall = async {
            runCatching {
                if (session.isFilho) http.get(api("/api/v1/participacoes?tenantId=$tenant"), session.accessToken)
                else http.get(api("/api/v1/events/confirmados-resumo?tenantId=$tenant"), session.accessToken)
            }.getOrNull()
        }
        val extras = extrasCall.await().asObject()
        val participations = extras.array("data").associate { element ->
            val row = element.asObject()
            row.text("event_id") to row.text("status")
        }
        val confirmed = (extras["data"] as? JsonObject)?.mapValues { (_, value) ->
            (value as? JsonArray)?.size ?: 0
        }.orEmpty()
        val events = eventsCall.await().asObject().array("data", "events", "items").map { element ->
            val event = element.asObject()
            val id = event.text("id")
            GiraEvent(
                id = id,
                title = event.text("titulo", "title"),
                date = event.text("data", "date").take(10),
                time = event.text("hora", "time").take(5),
                type = event.text("tipo", "type").ifBlank { "Gira" },
                description = event.text("descricao", "description"),
                status = event.text("status_confirmacao", "status").ifBlank { "Confirmado" },
                bannerUrl = event.text("banner_url"),
                isPublic = event.bool("evento_publico"),
                maxGuests = event.intOrNull("vagas_maximas"),
                ticketsEnabled = event.bool("senhas_ativas"),
                maxTickets = event.intOrNull("senhas_maximas"),
                participantStatus = participations[id].orEmpty(),
                confirmedCount = confirmed[id] ?: 0,
            )
        }.filterNot { it.type.equals("Obrigação", true) }
        session.isFilho to events
    }

    suspend fun save(id: String?, form: GiraForm) {
        val session = session()
        check(!session.isFilho) { "Somente a zeladoria pode alterar giras." }
        val body = buildJsonObject {
            put("titulo", form.title.trim()); put("data", form.date); put("hora", form.time)
            put("tipo", form.type); put("descricao", form.description.trim()); put("status_confirmacao", form.status)
            put("evento_publico", form.isPublic || form.ticketsEnabled)
            form.maxGuests.toIntOrNull()?.let { put("vagas_maximas", it) }
            put("senhas_ativas", form.ticketsEnabled)
            form.maxTickets.toIntOrNull()?.let { put("senhas_maximas", it) }
            put("lider_id", session.userId); put("tenant_id", session.tenantId)
        }
        if (id == null) http.post(api("/api/events"), body, session.accessToken)
        else http.patch(api("/api/events/${encode(id)}"), body, session.accessToken)
    }

    suspend fun delete(id: String) {
        val session = session(); check(!session.isFilho) { "Acesso negado." }
        http.delete(api("/api/events/${encode(id)}"), session.accessToken)
    }

    suspend fun respond(id: String, action: String) {
        val session = session(); check(session.isFilho) { "Esta resposta pertence ao filho de santo." }
        http.post(api("/api/v1/events/${encode(id)}/participantes/respond"), buildJsonObject {
            put("tenantId", session.tenantId); put("action", action)
        }, session.accessToken)
    }

    suspend fun notify(id: String, title: String, date: String, time: String) {
        val session = session(); check(!session.isFilho) { "Acesso negado." }
        http.post(api("/api/push-broadcast"), buildJsonObject {
            put("tenantId", session.tenantId); put("title", "Nova gira: $title")
            put("body", "Marcada para ${date.asBrDate()} às $time. Contamos com sua presença!")
            put("url", "/calendar")
        }, session.accessToken)
    }

    private fun session() = sessions.current().also { check(it.isAuthenticated) { "Entre novamente para continuar." } }
    private fun api(path: String) = BuildConfig.API_BASE_URL.trimEnd('/') + path
    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8")
}

private fun JsonElement?.asObject() = this as? JsonObject ?: JsonObject(emptyMap())
private fun JsonObject.array(vararg keys: String) = keys.firstNotNullOfOrNull { this[it] as? JsonArray } ?: JsonArray(emptyList())
private fun JsonObject.text(vararg keys: String) = keys.firstNotNullOfOrNull { runCatching { this[it]?.jsonPrimitive?.content }.getOrNull()?.takeIf(String::isNotBlank) }.orEmpty()
private fun JsonObject.bool(key: String) = runCatching { this[key]?.jsonPrimitive?.content?.toBooleanStrictOrNull() }.getOrNull() ?: false
private fun JsonObject.intOrNull(key: String) = runCatching { this[key]?.jsonPrimitive?.content?.toInt() }.getOrNull()
private fun String.asBrDate() = takeIf { Regex("\\d{4}-\\d{2}-\\d{2}").matches(it) }?.let { "${it.takeLast(2)}/${it.substring(5, 7)}/${it.take(4)}" } ?: this
