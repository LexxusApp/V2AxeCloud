package br.com.axecloud.app.feature.support

data class SupportForm(
    val leaderName: String = "",
    val houseName: String = "",
    val whatsapp: String = "",
    val message: String = "",
)

data class SupportUiState(
    val loading: Boolean = true,
    val sending: Boolean = false,
    val sent: Boolean = false,
    val form: SupportForm = SupportForm(),
    val error: String? = null,
)
