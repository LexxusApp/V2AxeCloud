package br.com.axecloud.app.feature.giras

data class GiraEvent(
    val id: String,
    val title: String,
    val date: String,
    val time: String,
    val type: String,
    val description: String,
    val status: String,
    val bannerUrl: String = "",
    val isPublic: Boolean = false,
    val maxGuests: Int? = null,
    val ticketsEnabled: Boolean = false,
    val maxTickets: Int? = null,
    val participantStatus: String = "",
    val confirmedCount: Int = 0,
)

data class GiraForm(
    val title: String = "",
    val date: String = "",
    val time: String = "20:00",
    val type: String = "Gira",
    val description: String = "",
    val status: String = "Confirmado",
    val isPublic: Boolean = false,
    val maxGuests: String = "",
    val ticketsEnabled: Boolean = false,
    val maxTickets: String = "",
) {
    companion object {
        fun from(event: GiraEvent) = GiraForm(
            title = event.title, date = event.date, time = event.time.take(5), type = event.type,
            description = event.description, status = event.status, isPublic = event.isPublic,
            maxGuests = event.maxGuests?.toString().orEmpty(), ticketsEnabled = event.ticketsEnabled,
            maxTickets = event.maxTickets?.toString().orEmpty(),
        )
    }
}

enum class GiraFilter { UPCOMING, ALL, PAST }

data class GirasUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val actionId: String? = null,
    val events: List<GiraEvent> = emptyList(),
    val isFilho: Boolean = false,
    val filter: GiraFilter = GiraFilter.UPCOMING,
    val selected: GiraEvent? = null,
    val editing: GiraEvent? = null,
    val creating: Boolean = false,
    val error: String? = null,
    val message: String? = null,
) {
    val visible: List<GiraEvent> get() {
        val today = java.time.LocalDate.now().toString()
        return events.filter {
            when (filter) {
                GiraFilter.UPCOMING -> it.date >= today
                GiraFilter.PAST -> it.date < today
                GiraFilter.ALL -> true
            }
        }.sortedWith(compareBy<GiraEvent> { it.date }.thenBy { it.time }).let {
            if (filter == GiraFilter.PAST) it.reversed() else it
        }
    }
}
