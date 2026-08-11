package br.com.axecloud.app.feature.auth

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SupabaseUser(
    val id: String = "",
    val email: String? = null,
)

@Serializable
data class AuthTokenResponse(
    @SerialName("access_token") val accessToken: String = "",
    @SerialName("refresh_token") val refreshToken: String = "",
    @SerialName("expires_in") val expiresIn: Long = 3600,
    @SerialName("token_type") val tokenType: String = "bearer",
    val user: SupabaseUser? = null,
)

@Serializable
data class TenantInfoResponse(
    @SerialName("nome_terreiro") val houseName: String? = null,
    val role: String? = null,
    @SerialName("tenant_id") val tenantId: String? = null,
    val plan: String? = null,
    @SerialName("foto_url") val photoUrl: String? = null,
    val status: String? = null,
)

enum class AccessProfile { ZELADOR, FILHO }

data class RegistrationForm(
    val houseName: String = "",
    val leaderName: String = "",
    val whatsapp: String = "",
    val email: String = "",
    val password: String = "",
    val billingCycle: String = "monthly",
)

sealed interface AuthResult {
    data object Success : AuthResult
    data class Error(val message: String) : AuthResult
}

internal fun isRecoveryEmailValid(value: String): Boolean {
    val normalized = value.trim()
    val at = normalized.indexOf('@')
    return at > 0 && at < normalized.lastIndex && normalized.substring(at + 1).contains('.')
}

internal fun registrationValidation(form: RegistrationForm): String? = when {
    form.houseName.trim().length < 3 -> "Informe o nome completo do terreiro."
    form.leaderName.trim().length < 2 -> "Informe como o zelador é conhecido na casa."
    !isRecoveryEmailValid(form.email) -> "Informe um e-mail válido."
    form.password.length < 8 -> "A senha deve ter pelo menos 8 caracteres."
    !form.password.any(Char::isLowerCase) -> "Inclua uma letra minúscula na senha."
    !form.password.any(Char::isUpperCase) -> "Inclua uma letra maiúscula na senha."
    !form.password.any(Char::isDigit) -> "Inclua um número na senha."
    form.password.all(Char::isLetterOrDigit) -> "Inclua um símbolo na senha, como @, # ou !."
    form.billingCycle !in setOf("monthly", "annual") -> "Escolha o ciclo da assinatura."
    else -> null
}
