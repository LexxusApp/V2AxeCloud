package br.com.axecloud.app.feature.precepts

data class PreceptCounts(
    val total: Int = 0,
    val pending: Int = 0,
    val aware: Int = 0,
    val excused: Int = 0,
    val guidance: Int = 0,
)

data class PreceptParticipant(
    val id: String,
    val childId: String,
    val name: String,
    val role: String,
    val status: String,
)

data class PreceptCycle(
    val id: String,
    val title: String,
    val reason: String,
    val instructions: String,
    val audience: String,
    val targetRoles: List<String>,
    val startsAt: String,
    val endsAt: String,
    val status: String,
    val counts: PreceptCounts,
    val participants: List<PreceptParticipant> = emptyList(),
)

data class PreceptChild(val id: String, val name: String, val role: String, val active: Boolean)
data class PreceptFoundation(val id: String, val title: String, val category: String)

data class PreceptForm(
    val title: String = "",
    val reason: String = "",
    val instructions: String = "",
    val audience: String = "corrente",
    val targetRoles: Set<String> = emptySet(),
    val targetChildren: Set<String> = emptySet(),
    val excludedChildren: Set<String> = emptySet(),
    val foundationId: String = "",
    val startDate: String = "",
    val endDate: String = "",
    val publishNow: Boolean = true,
)

data class PreceptUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val cycles: List<PreceptCycle> = emptyList(),
    val children: List<PreceptChild> = emptyList(),
    val roles: List<String> = emptyList(),
    val foundations: List<PreceptFoundation> = emptyList(),
    val filter: String = "ativos",
    val editorOpen: Boolean = false,
    val detail: PreceptCycle? = null,
    val form: PreceptForm = PreceptForm(),
    val actionId: String? = null,
    val error: String? = null,
    val message: String? = null,
) {
    val visible: List<PreceptCycle>
        get() = when (filter) {
            "ativos" -> cycles.filter { it.status == "ativo" }
            "rascunhos" -> cycles.filter { it.status == "rascunho" }
            "encerrados" -> cycles.filter { it.status in setOf("encerrado", "cancelado") }
            else -> cycles
        }
}
