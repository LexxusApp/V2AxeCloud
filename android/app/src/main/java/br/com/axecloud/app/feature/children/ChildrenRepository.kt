package br.com.axecloud.app.feature.children

import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChildrenRepository @Inject constructor(
    private val http: AxeCloudHttpClient,
    private val sessions: SessionStore,
) {
    suspend fun list(): List<ChildOfSaint> {
        val session = session()
        check(!session.isFilho) { "Este módulo pertence à zeladoria." }
        val result = http.get(
            api("/api/children?tenantId=${encode(session.tenantId)}&userId=${encode(session.userId)}&userRole=admin"),
            session.accessToken,
        ).asObject()
        return result.array("data", "children", "items").map { item ->
            val child = item as? JsonObject ?: JsonObject(emptyMap())
            ChildOfSaint(
                id = child.text("id"),
                name = child.text("nome", "name"),
                photoUrl = child.text("foto_url", "photo_url"),
                frontOrisha = child.text("orixa_frente", "orixa"),
                role = child.text("cargo").ifBlank { "Filho de Santo" },
                cpf = child.text("cpf"),
                birthDate = child.text("data_nascimento"),
                entryDate = child.text("data_entrada"),
                status = child.text("status").ifBlank { "Ativo" },
                whatsapp = child.text("whatsapp_phone"),
                phone = child.text("telefone"),
                restrictions = (child["quizilas"] as? JsonArray).orEmpty().mapNotNull {
                    runCatching { it.jsonPrimitive.content }.getOrNull()
                },
            )
        }
    }

    suspend fun create(form: ChildForm) {
        val session = session()
        http.post(
            api("/api/children"),
            buildJsonObject {
                put("userId", session.userId)
                put("tenantId", session.tenantId)
                put("childData", form.toPayload())
            },
            session.accessToken,
        )
    }

    suspend fun update(id: String, form: ChildForm) {
        val session = session()
        http.put(
            api("/api/children/${encode(id)}?tenantId=${encode(session.tenantId)}&userRole=admin"),
            form.toPayload(),
            session.accessToken,
        )
    }

    suspend fun delete(id: String) {
        val session = session()
        http.delete(
            api("/api/children/${encode(id)}?tenantId=${encode(session.tenantId)}&userRole=admin"),
            session.accessToken,
        )
    }

    private fun ChildForm.toPayload() = buildJsonObject {
        put("nome", name.trim())
        put("orixa_frente", frontOrisha.trim())
        put("cargo", role.trim())
        put("cpf", cpf.filter(Char::isDigit))
        put("data_nascimento", birthDate.trim())
        put("data_entrada", entryDate.trim())
        put("status", status)
        put("whatsapp_phone", whatsapp.filter(Char::isDigit))
    }

    private fun session() = sessions.current().also {
        check(it.isAuthenticated) { "Entre novamente para continuar." }
    }

    private fun api(path: String) = BuildConfig.API_BASE_URL.trimEnd('/') + path
    private fun encode(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())
}

private fun JsonObject.text(vararg keys: String): String = keys.firstNotNullOfOrNull { key ->
    runCatching { this[key]?.jsonPrimitive?.content }.getOrNull()?.takeIf(String::isNotBlank)
}.orEmpty()

private fun JsonObject.array(vararg keys: String): JsonArray = keys.firstNotNullOfOrNull { key ->
    runCatching { this[key]?.jsonArray }.getOrNull()
} ?: JsonArray(emptyList())

private fun kotlinx.serialization.json.JsonElement.asObject(): JsonObject =
    runCatching { jsonObject }.getOrElse { JsonObject(emptyMap()) }
