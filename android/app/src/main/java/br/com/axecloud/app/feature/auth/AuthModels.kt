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

sealed interface AuthResult {
    data object Success : AuthResult
    data class Error(val message: String) : AuthResult
}
