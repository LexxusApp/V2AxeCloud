package br.com.axecloud.app.feature.children

data class ChildOfSaint(
    val id: String = "",
    val name: String = "",
    val photoUrl: String = "",
    val frontOrisha: String = "",
    val role: String = "",
    val cpf: String = "",
    val birthDate: String = "",
    val entryDate: String = "",
    val status: String = "Ativo",
    val whatsapp: String = "",
    val phone: String = "",
    val restrictions: List<String> = emptyList(),
)

data class ChildForm(
    val name: String = "",
    val frontOrisha: String = "",
    val role: String = "Filho de Santo",
    val cpf: String = "",
    val birthDate: String = "",
    val entryDate: String = "",
    val status: String = "Ativo",
    val whatsapp: String = "",
) {
    companion object {
        fun from(child: ChildOfSaint) = ChildForm(
            name = child.name,
            frontOrisha = child.frontOrisha,
            role = child.role,
            cpf = child.cpf,
            birthDate = child.birthDate,
            entryDate = child.entryDate,
            status = child.status,
            whatsapp = child.whatsapp.ifBlank { child.phone },
        )
    }
}

enum class ChildStatusFilter(val label: String) {
    ALL("Todos"), ACTIVE("Ativos"), PENDING("Pendentes"), INACTIVE("Inativos")
}

data class ChildrenUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val deletingId: String? = null,
    val children: List<ChildOfSaint> = emptyList(),
    val query: String = "",
    val filter: ChildStatusFilter = ChildStatusFilter.ALL,
    val selected: ChildOfSaint? = null,
    val editing: ChildOfSaint? = null,
    val creating: Boolean = false,
    val message: String? = null,
    val error: String? = null,
) {
    val visibleChildren: List<ChildOfSaint>
        get() = children.filter { child ->
            val statusMatches = when (filter) {
                ChildStatusFilter.ALL -> true
                ChildStatusFilter.ACTIVE -> child.status.equals("Ativo", true)
                ChildStatusFilter.PENDING -> child.status.equals("Pendente", true)
                ChildStatusFilter.INACTIVE -> child.status.equals("Inativo", true)
            }
            val needle = query.trim().lowercase()
            val queryMatches = needle.isBlank() || listOf(
                child.name, child.role, child.frontOrisha, child.whatsapp, child.phone,
            ).any { it.lowercase().contains(needle) }
            statusMatches && queryMatches
        }.sortedBy { it.name.lowercase() }

    val activeCount: Int get() = children.count { it.status.equals("Ativo", true) }
    val incompleteCount: Int get() = children.count { it.whatsapp.isBlank() || it.birthDate.isBlank() }
}
