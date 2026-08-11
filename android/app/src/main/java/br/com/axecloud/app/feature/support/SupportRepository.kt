package br.com.axecloud.app.feature.support

import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import javax.inject.Inject

class SupportRepository @Inject constructor(
    private val http: AxeCloudHttpClient,
    private val sessions: SessionStore,
) {
    suspend fun load(): SupportForm {
        val session = session()
        check(!session.isFilho) { "O suporte da conta é exclusivo da liderança." }
        val profile = runCatching {
            http.get(api("/api/v1/settings/portal-consulente"), session.accessToken).jsonObject
        }.getOrNull()
        return SupportForm(
            leaderName = profile?.text("zelador", "leaderName").orEmpty().ifBlank { session.role.ifBlank { "Zelador(a)" } },
            houseName = profile?.text("nomeTerreiro", "nome_terreiro").orEmpty().ifBlank { session.houseName },
            whatsapp = profile?.text("whatsappPublico", "whatsapp_publico").orEmpty().filter(Char::isDigit),
        )
    }

    suspend fun send(form: SupportForm) {
        val session = session()
        http.post(
            api("/api/v1/support"),
            buildJsonObject {
                put("nomeZelador", form.leaderName.trim())
                put("nomeTerreiro", form.houseName.trim())
                put("whatsapp", form.whatsapp.filter(Char::isDigit))
                put("mensagem", form.message.trim())
            },
            session.accessToken,
        )
    }

    private fun session() = sessions.current().also { check(it.isAuthenticated) }
    private fun api(path: String) = BuildConfig.API_BASE_URL.trimEnd('/') + path
}

private fun kotlinx.serialization.json.JsonObject.text(vararg keys: String): String =
    keys.firstNotNullOfOrNull { key -> runCatching { this[key]?.jsonPrimitive?.content }.getOrNull()?.takeIf(String::isNotBlank) }.orEmpty()
