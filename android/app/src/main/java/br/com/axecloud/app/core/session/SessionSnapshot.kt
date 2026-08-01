package br.com.axecloud.app.core.session

data class SessionSnapshot(
    val accessToken: String = "",
    val refreshToken: String = "",
    val userId: String = "",
    val email: String = "",
    val role: String = "",
    val tenantId: String = "",
    val houseName: String = "",
    val plan: String = "",
    val profilePhotoUrl: String = "",
    val expiresAtEpochSeconds: Long = 0,
) {
    val isAuthenticated: Boolean get() = accessToken.isNotBlank() && userId.isNotBlank()
    val isFilho: Boolean get() = role.equals("filho", ignoreCase = true)
}
