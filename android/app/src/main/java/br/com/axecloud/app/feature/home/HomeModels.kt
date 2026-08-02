package br.com.axecloud.app.feature.home

data class HomeSnapshot(
    val greetingName: String = "",
    val houseName: String = "",
    val isFilho: Boolean = false,
    val primaryMetric: String = "0",
    val primaryLabel: String = "Filhos ativos",
    val secondaryMetric: String = "0",
    val secondaryLabel: String = "Pendências",
    val notices: Int = 0,
    val events: Int = 0,
    val nextAction: String = "Organize o próximo movimento da casa",
    val financialMessage: String = "Em dia",
    val eventItems: List<HomeFeedItem> = emptyList(),
    val noticeItems: List<HomeFeedItem> = emptyList(),
    val preceptItems: List<HomeFeedItem> = emptyList(),
    val libraryItems: List<HomeFeedItem> = emptyList(),
    val conversationItems: List<HomeFeedItem> = emptyList(),
    val monthlyActive: Boolean = false,
    val monthlyValue: Double = 0.0,
    val monthlyDueDay: Int = 10,
    val pixPayload: String = "",
    val pixBeneficiary: String = "",
    val monthlyItems: List<HomeFeedItem> = emptyList(),
)

data class HomeFeedItem(
    val id: String = "",
    val title: String,
    val detail: String = "",
    val url: String = "",
    val status: String = "",
    val amount: Double = 0.0,
)

data class ChatMessage(
    val id: String,
    val body: String,
    val senderName: String,
    val createdAt: String,
    val isOwn: Boolean,
)

data class InteractionUiState(
    val conversationId: String? = null,
    val conversationTitle: String = "",
    val messages: List<ChatMessage> = emptyList(),
    val loadingMessages: Boolean = false,
    val sendingMessage: Boolean = false,
    val actionInProgress: String? = null,
    val feedback: String? = null,
)

data class HomeUiState(
    val loading: Boolean = true,
    val snapshot: HomeSnapshot = HomeSnapshot(),
    val error: String? = null,
)
