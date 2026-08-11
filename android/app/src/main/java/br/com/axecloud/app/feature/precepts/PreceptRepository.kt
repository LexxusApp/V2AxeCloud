package br.com.axecloud.app.feature.precepts

import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.*
import java.net.URLEncoder
import javax.inject.Inject

data class PreceptPayload(
    val cycles: List<PreceptCycle>,
    val children: List<PreceptChild>,
    val roles: List<String>,
    val foundations: List<PreceptFoundation>,
)

class PreceptRepository @Inject constructor(
    private val http: AxeCloudHttpClient,
    private val sessions: SessionStore,
) {
    suspend fun load(): PreceptPayload = coroutineScope {
        val session = session()
        check(!session.isFilho) { "A gestão de preceitos pertence à zeladoria." }
        val tenant = enc(session.tenantId)
        val cyclesCall = async { http.get(api("/api/v1/preceitos?tenantId=$tenant"), session.accessToken).jsonObject }
        val optionsCall = async { http.get(api("/api/v1/preceitos/options?tenantId=$tenant"), session.accessToken).jsonObject }
        val options = optionsCall.await()
        PreceptPayload(
            cycles = cyclesCall.await().array("data").map { it.jsonObject.cycle() },
            children = options.array("children").map { row ->
                val item = row.jsonObject
                PreceptChild(item.t("id"), item.t("nome"), item.t("cargo"), item.t("status").lowercase() !in setOf("inativo", "inactive"))
            },
            roles = options.array("cargos").mapNotNull { runCatching { it.jsonPrimitive.content }.getOrNull() },
            foundations = options.array("fundamentos").map { row ->
                val item = row.jsonObject
                PreceptFoundation(item.t("id"), item.t("titulo"), item.t("categoria"))
            },
        )
    }

    suspend fun detail(id: String): PreceptCycle {
        val session = session()
        val root = http.get(api("/api/v1/preceitos/${enc(id)}?tenantId=${enc(session.tenantId)}"), session.accessToken).jsonObject
        return (root["data"]?.jsonObject ?: JsonObject(emptyMap())).cycle(withParticipants = true)
    }

    suspend fun create(form: PreceptForm) {
        val session = session()
        http.post(api("/api/v1/preceitos"), buildJsonObject {
            put("tenantId", session.tenantId)
            put("titulo", form.title.trim())
            put("motivo", form.reason.trim())
            put("orientacoes", form.instructions.trim())
            put("tipo", if (form.audience == "corrente") "coletivo" else "restrito")
            put("publico_alvo", form.audience)
            put("cargos_alvo", JsonArray(form.targetRoles.map(::JsonPrimitive)))
            put("filhos_alvo", JsonArray(form.targetChildren.map(::JsonPrimitive)))
            put("filhos_excluidos", JsonArray(form.excludedChildren.map(::JsonPrimitive)))
            put("fundamento_id", form.foundationId)
            put("inicio_em", "${form.startDate}T00:00:00-03:00")
            put("fim_em", "${form.endDate}T23:59:59-03:00")
            put("status", if (form.publishNow) "ativo" else "rascunho")
        }, session.accessToken)
    }

    suspend fun updateStatus(id: String, status: String) {
        val session = session()
        http.patch(api("/api/v1/preceitos/${enc(id)}/status"), buildJsonObject {
            put("tenantId", session.tenantId)
            put("status", status)
        }, session.accessToken)
    }

    suspend fun updateParticipant(cycleId: String, participantId: String, status: String, reason: String = "") {
        val session = session()
        http.patch(api("/api/v1/preceitos/${enc(cycleId)}/participantes/${enc(participantId)}"), buildJsonObject {
            put("tenantId", session.tenantId)
            put("status", status)
            put("motivo", reason)
        }, session.accessToken)
    }

    private fun session() = sessions.current().also { check(it.isAuthenticated) }
    private fun api(path: String) = BuildConfig.API_BASE_URL.trimEnd('/') + path
    private fun enc(value: String) = URLEncoder.encode(value, "UTF-8")
}

private fun JsonObject.cycle(withParticipants: Boolean = false): PreceptCycle {
    val count = obj("counts")
    val participants = if (withParticipants) array("participantes").map { row ->
        val item = row.jsonObject
        val child = item.obj("filho")
        PreceptParticipant(item.t("id"), item.t("filho_id"), child.t("nome").ifBlank { "Membro da corrente" }, child.t("cargo"), item.t("status"))
    } else emptyList()
    return PreceptCycle(
        id = t("id"), title = t("titulo"), reason = t("motivo"), instructions = t("orientacoes"),
        audience = t("publico_alvo"), targetRoles = array("cargos_alvo").mapNotNull { runCatching { it.jsonPrimitive.content }.getOrNull() },
        startsAt = t("inicio_em"), endsAt = t("fim_em"), status = t("status"),
        counts = PreceptCounts(count.i("total"), count.i("pendentes"), count.i("cientes"), count.i("dispensados"), count.i("orientacao")),
        participants = participants,
    )
}

private fun JsonObject.t(key: String) = runCatching { this[key]?.jsonPrimitive?.content }.getOrNull().orEmpty()
private fun JsonObject.i(key: String) = runCatching { this[key]?.jsonPrimitive?.int }.getOrNull() ?: 0
private fun JsonObject.obj(key: String) = runCatching { this[key]?.jsonObject }.getOrNull() ?: JsonObject(emptyMap())
private fun JsonObject.array(key: String) = runCatching { this[key]?.jsonArray }.getOrNull().orEmpty()
