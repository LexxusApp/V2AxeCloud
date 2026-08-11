package br.com.axecloud.app.feature.settings

import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.*
import java.net.URLEncoder
import javax.inject.Inject

data class SettingsPayload(
    val identity: IdentitySettings,
    val portal: PortalSettings,
    val subscription: SubscriptionSettings,
    val whatsapp: WhatsAppSettings,
)

class SettingsRepository @Inject constructor(
    private val http: AxeCloudHttpClient,
    private val sessions: SessionStore,
) {
    suspend fun load(): SettingsPayload = coroutineScope {
        val session = session()
        check(!session.isFilho) { "Configurações da casa são exclusivas da liderança." }
        val portalCall = async { http.get(api("/api/v1/settings/portal-consulente"), session.accessToken).jsonObject }
        val tenantCall = async {
            http.get(
                api("/api/tenant-info?userId=${encode(session.userId)}&email=${encode(session.email)}"),
                session.accessToken,
            ).jsonObject
        }
        val plansCall = async { runCatching { http.get(api("/api/plans")).jsonObject }.getOrNull() }
        val whatsappCall = async { loadWhatsApp(session.accessToken) }
        val portal = portalCall.await()
        val tenant = tenantCall.await()
        val premium = plansCall.await()?.objectAt("plans")?.objectAt("premium")
        SettingsPayload(
            identity = IdentitySettings(
                houseName = portal.t("nomeTerreiro").ifBlank { session.houseName },
                leaderName = portal.t("zelador", "leaderName"),
                role = session.role.ifBlank { "Zelador" },
                email = session.email,
                photo = session.profilePhotoUrl,
            ),
            portal = PortalSettings(
                tradition = portal.t("tradicao").ifBlank { "mista" },
                slug = portal.t("publicSlug"),
                prayerActive = portal.b("portalAtivo"),
                prayerMessage = portal.t("mensagem"),
                publicActive = portal.b("portalPublicoAtivo"),
                city = portal.t("cidadePublica"),
                state = portal.t("estadoPublico"),
                neighborhood = portal.t("bairroPublico"),
                whatsapp = portal.t("whatsappPublico"),
                description = portal.t("descricaoPublica"),
                views = portal.i("visualizacoes"),
                publicUrl = portal.t("terreiroUrl", "portalUrl"),
                prayerListUrl = portal.t("listagemPedidosUrl"),
                verified = portal.b("casaVerificada"),
            ),
            subscription = SubscriptionSettings(
                plan = tenant.t("plan").ifBlank { session.plan },
                status = tenant.t("status").ifBlank { "active" },
                expiresAt = tenant.t("expires_at"),
                billingCycle = tenant.t("billing_cycle").ifBlank { "monthly" },
                trial = tenant.b("is_trial"),
                monthlyPrice = premium?.d("price") ?: 0.0,
                annualPrice = premium?.d("annual_price") ?: 0.0,
                tenantId = tenant.t("tenant_id").ifBlank { session.tenantId },
            ),
            whatsapp = whatsappCall.await(),
        )
    }

    private suspend fun loadWhatsApp(token: String): WhatsAppSettings = coroutineScope {
        val configCall = async { runCatching { http.get(api("/api/whatsapp/config"), token).jsonObject }.getOrNull() }
        val statusCall = async { runCatching { http.get(api("/api/whatsapp/status"), token).jsonObject }.getOrNull() }
        val logsCall = async { runCatching { http.get(api("/api/whatsapp/logs?limit=20"), token).jsonObject }.getOrNull() }
        val config = configCall.await()
        val status = statusCall.await()
        val preferences = config?.objectAt("preferences")
        val logs = logsCall.await()?.arrayAt("logs").orEmpty().mapNotNull { element ->
            val row = element as? JsonObject ?: return@mapNotNull null
            WhatsAppLog(row.t("id"), row.t("telefone"), row.t("mensagem"), row.t("tipo"), row.t("status"), row.t("created_at"))
        }
        WhatsAppSettings(
            connected = status?.t("status").equals("CONNECTED", true),
            channelMessage = status?.t("message").orEmpty(),
            preferences = WhatsAppPreferences(
                giras = preferences?.b("notifGiras") ?: true,
                financeiro = preferences?.b("notifFinanceiro") ?: true,
                reza = preferences?.b("notifReza") ?: true,
                aniversarios = preferences?.b("notifAniversarios") ?: true,
            ),
            logs = logs,
        )
    }

    suspend fun saveWhatsAppPreferences(value: WhatsAppPreferences) {
        val session = session()
        http.post(api("/api/whatsapp/config"), buildJsonObject {
            put("tenant_id", session.userId)
            put("preferences", buildJsonObject {
                put("notifGiras", value.giras); put("notifFinanceiro", value.financeiro)
                put("notifReza", value.reza); put("notifAniversarios", value.aniversarios)
            })
        }, session.accessToken)
    }

    suspend fun testWhatsApp(phone: String) {
        val session = session()
        http.post(api("/api/whatsapp/test-message"), buildJsonObject { put("tenant_id", session.userId); put("phone", phone.filter(Char::isDigit)) }, session.accessToken)
    }

    suspend fun saveIdentity(value: IdentitySettings) {
        val session = session()
        http.post(api("/api/v1/settings/save"), buildJsonObject {
            put("userId", session.userId); put("tenantId", session.tenantId)
            put("profile", buildJsonObject {
                put("email", session.email); put("nome_terreiro", value.houseName); put("cargo", value.role)
                put("zelador", value.leaderName.ifBlank { value.role }); put("foto_url", value.photo)
            })
        }, session.accessToken)
    }

    suspend fun savePortal(value: PortalSettings): PortalSettings {
        val session = session()
        val response = http.post(api("/api/v1/settings/portal-consulente"), buildJsonObject {
            put("tradicao", value.tradition); put("publicSlug", value.slug); put("portalAtivo", value.prayerActive)
            put("mensagem", value.prayerMessage); put("portalPublicoAtivo", value.publicActive); put("cidadePublica", value.city)
            put("estadoPublico", value.state); put("bairroPublico", value.neighborhood); put("whatsappPublico", value.whatsapp)
            put("descricaoPublica", value.description)
        }, session.accessToken).jsonObject
        return value.copy(
            slug = response.t("publicSlug").ifBlank { value.slug },
            publicActive = response.bn("portalPublicoAtivo") ?: value.publicActive,
            publicUrl = response.t("terreiroUrl", "portalUrl").ifBlank { value.publicUrl },
            prayerListUrl = response.t("listagemPedidosUrl").ifBlank { value.prayerListUrl },
        )
    }

    suspend fun changeEmail(email: String, password: String) {
        val session = session()
        val result = http.post(api("/api/v1/account/change-email"), buildJsonObject { put("newEmail", email.trim().lowercase()); put("currentPassword", password) }, session.accessToken).jsonObject
        val updated = result.t("email").ifBlank { email.trim().lowercase() }
        sessions.save(session.copy(email = updated))
    }

    suspend fun changePassword(current: String, new: String, confirm: String) {
        val session = session()
        http.post(api("/api/v1/account/change-password"), buildJsonObject { put("currentPassword", current); put("newPassword", new); put("confirmPassword", confirm) }, session.accessToken)
    }

    suspend fun deleteAccount(email: String, password: String) {
        val session = session()
        http.post(api("/api/v1/account/permanent-delete"), buildJsonObject { put("confirmEmail", email.trim().lowercase()); put("currentPassword", password) }, session.accessToken)
        sessions.clear()
    }

    private fun session() = sessions.current().also { check(it.isAuthenticated) }
    private fun api(path: String) = BuildConfig.API_BASE_URL.trimEnd('/') + path
    private fun encode(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())
}

private fun JsonObject.t(vararg keys: String) = keys.firstNotNullOfOrNull { key -> runCatching { this[key]?.jsonPrimitive?.content }.getOrNull()?.takeIf(String::isNotBlank) }.orEmpty()
private fun JsonObject.b(key: String): Boolean = runCatching { this[key]?.jsonPrimitive?.boolean }.getOrNull() ?: false
private fun JsonObject.bn(key: String): Boolean? = runCatching { this[key]?.jsonPrimitive?.boolean }.getOrNull()
private fun JsonObject.i(key: String): Int = runCatching { this[key]?.jsonPrimitive?.int }.getOrNull() ?: 0
private fun JsonObject.d(key: String): Double = runCatching { this[key]?.jsonPrimitive?.double }.getOrNull() ?: 0.0
private fun JsonObject.objectAt(key: String): JsonObject? = runCatching { this[key]?.jsonObject }.getOrNull()
private fun JsonObject.arrayAt(key: String): JsonArray? = runCatching { this[key]?.jsonArray }.getOrNull()
