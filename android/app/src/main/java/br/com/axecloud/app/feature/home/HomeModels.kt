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
)

data class HomeFeedItem(
    val title: String,
    val detail: String = "",
)

data class HomeUiState(
    val loading: Boolean = true,
    val snapshot: HomeSnapshot = HomeSnapshot(),
    val error: String? = null,
)
