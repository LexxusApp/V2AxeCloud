package br.com.axecloud.app.feature.frequency

data class FrequencyMember(
    val id: String,
    val name: String,
    val role: String,
    val photoUrl: String,
    val totalEvents: Int,
    val present: Int,
    val absences: Int,
    val attendance: Int,
)

data class FrequencyUiState(
    val loading: Boolean = true,
    val members: List<FrequencyMember> = emptyList(),
    val query: String = "",
    val error: String? = null,
) {
    val visible: List<FrequencyMember> get() = members.filter {
        query.isBlank() || it.name.contains(query.trim(), true) || it.role.contains(query.trim(), true)
    }
    val average: Int get() = members.map { it.attendance }.takeIf { it.isNotEmpty() }?.average()?.toInt() ?: 0
}
