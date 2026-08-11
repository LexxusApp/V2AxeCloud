package br.com.axecloud.app.feature.notices

data class HouseNotice(
    val id: String,
    val title: String,
    val content: String,
    val category: String,
    val publishedAt: String,
    val expiresAt: String,
)

data class NoticeForm(val title: String = "", val content: String = "", val category: String = "Geral", val expiresAt: String = "")

data class BroadcastLog(
    val id: String,
    val message: String,
    val recipient: String,
    val status: String,
    val createdAt: String,
) {
    val failed: Boolean get() = status.lowercase() in setOf("failed", "falha", "error", "erro")
}

data class NoticesPayload(val isFilho: Boolean, val notices: List<HouseNotice>, val logs: List<BroadcastLog>)

data class NoticesUiState(
    val loading: Boolean = true,
    val publishing: Boolean = false,
    val notices: List<HouseNotice> = emptyList(),
    val logs: List<BroadcastLog> = emptyList(),
    val isFilho: Boolean = false,
    val query: String = "",
    val category: String = "Todos",
    val section: String = "Mural",
    val selected: HouseNotice? = null,
    val composing: Boolean = false,
    val draft: NoticeForm = NoticeForm(),
    val actionId: String? = null,
    val message: String? = null,
    val error: String? = null,
) {
    val visible: List<HouseNotice> get() = notices.filter { notice ->
        (category == "Todos" || notice.category == category) &&
            (query.isBlank() || notice.title.contains(query.trim(), true) || notice.content.contains(query.trim(), true))
    }.sortedWith(compareByDescending<HouseNotice> { it.category == "Urgente" }.thenByDescending { it.publishedAt })
}
