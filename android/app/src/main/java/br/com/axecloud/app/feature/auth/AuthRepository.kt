package br.com.axecloud.app.feature.auth

import android.util.Base64
import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionSnapshot
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.net.URLEncoder
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val http: AxeCloudHttpClient,
    private val sessionStore: SessionStore,
) {
    val session = sessionStore.session

    suspend fun loginZelador(email: String, password: String): AuthResult = authenticate {
        requireConfiguration()
        val response = http.post(
            url = "${BuildConfig.SUPABASE_URL}/auth/v1/token?grant_type=password",
            body = buildJsonObject {
                put("email", email.trim())
                put("password", password)
            },
            headers = supabaseHeaders(),
        )
        persistAndBootstrap(
            token = http.json.decodeFromString(response.toString()),
            emailHint = email.trim(),
            roleHint = "admin",
        )
    }

    suspend fun loginFilho(registration: String, cpfPrefix: String): AuthResult = authenticate {
        val response = http.post(
            url = "${BuildConfig.API_BASE_URL.trimEnd('/')}/api/auth/filho-login",
            body = buildJsonObject {
                put("childId", registration.trim().uppercase())
                put("cpfPrefix", cpfPrefix.filter(Char::isDigit).take(6))
            },
        )
        persistAndBootstrap(
            token = http.json.decodeFromString(response.toString()),
            emailHint = "",
            roleHint = "filho",
        )
    }

    suspend fun restore(): AuthResult {
        val current = sessionStore.current()
        if (!current.isAuthenticated) return AuthResult.Error("")
        return authenticate {
            val now = Instant.now().epochSecond
            val valid = current.expiresAtEpochSeconds > now + 90
            if (valid) {
                bootstrap(current)
            } else {
                refresh(current)
            }
        }
    }

    fun logout() = sessionStore.clear()

    private suspend fun refresh(current: SessionSnapshot) {
        requireConfiguration()
        if (current.refreshToken.isBlank()) error("Sua sessão expirou. Entre novamente.")
        val response = http.post(
            url = "${BuildConfig.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token",
            body = buildJsonObject { put("refresh_token", current.refreshToken) },
            headers = supabaseHeaders(),
        )
        persistAndBootstrap(
            token = http.json.decodeFromString(response.toString()),
            emailHint = current.email,
            roleHint = current.role,
        )
    }

    private suspend fun persistAndBootstrap(
        token: AuthTokenResponse,
        emailHint: String,
        roleHint: String,
    ) {
        if (token.accessToken.isBlank() || token.refreshToken.isBlank()) {
            error("O servidor não devolveu uma sessão válida.")
        }
        val jwt = readJwtPayload(token.accessToken)
        val userId = token.user?.id?.takeIf(String::isNotBlank)
            ?: jwt["sub"]?.jsonPrimitive?.content.orEmpty()
        val email = token.user?.email?.takeIf(String::isNotBlank)
            ?: jwt["email"]?.jsonPrimitive?.content
            ?: emailHint
        if (userId.isBlank()) error("Não foi possível identificar o usuário.")

        val provisional = SessionSnapshot(
            accessToken = token.accessToken,
            refreshToken = token.refreshToken,
            userId = userId,
            email = email,
            role = roleHint,
            tenantId = userId,
            expiresAtEpochSeconds = Instant.now().epochSecond + token.expiresIn,
        )
        bootstrap(provisional)
    }

    private suspend fun bootstrap(session: SessionSnapshot) {
        val url = "${BuildConfig.API_BASE_URL.trimEnd('/')}/api/tenant-info" +
            "?userId=${encode(session.userId)}&email=${encode(session.email)}"
        val response = http.get(url, session.accessToken)
        val tenant = http.json.decodeFromString<TenantInfoResponse>(response.toString())
        val resolvedRole = tenant.role?.takeIf(String::isNotBlank) ?: session.role.ifBlank { "admin" }
        sessionStore.save(
            session.copy(
                role = resolvedRole,
                tenantId = tenant.tenantId?.takeIf(String::isNotBlank) ?: session.userId,
                houseName = tenant.houseName.orEmpty(),
                plan = tenant.plan.orEmpty(),
                profilePhotoUrl = tenant.photoUrl.orEmpty(),
            )
        )
    }

    private suspend fun authenticate(block: suspend () -> Unit): AuthResult = try {
        block()
        AuthResult.Success
    } catch (error: Exception) {
        AuthResult.Error(error.message ?: "Não foi possível entrar no AxéCloud.")
    }

    private fun requireConfiguration() {
        if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            error("Configuração de autenticação ausente neste APK.")
        }
    }

    private fun supabaseHeaders() = mapOf(
        "apikey" to BuildConfig.SUPABASE_ANON_KEY,
        "Authorization" to "Bearer ${BuildConfig.SUPABASE_ANON_KEY}",
    )

    private fun readJwtPayload(token: String): JsonObject {
        val payload = token.split('.').getOrNull(1) ?: return JsonObject(emptyMap())
        return runCatching {
            val decoded = Base64.decode(payload, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            http.json.parseToJsonElement(String(decoded)).jsonObject
        }.getOrDefault(JsonObject(emptyMap()))
    }

    private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
}
