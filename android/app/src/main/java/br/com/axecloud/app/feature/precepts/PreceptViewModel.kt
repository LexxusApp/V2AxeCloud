package br.com.axecloud.app.feature.precepts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class PreceptViewModel @Inject constructor(private val repository: PreceptRepository) : ViewModel() {
    private val mutable = MutableStateFlow(PreceptUiState())
    val state = mutable.asStateFlow()

    init { load() }

    fun load() = viewModelScope.launch {
        mutable.update { it.copy(loading = true, error = null) }
        runCatching { repository.load() }
            .onSuccess { payload -> mutable.update { it.copy(loading = false, cycles = payload.cycles, children = payload.children, roles = payload.roles, foundations = payload.foundations) } }
            .onFailure { error -> mutable.update { it.copy(loading = false, error = error.message) } }
    }

    fun filter(value: String) = mutable.update { it.copy(filter = value) }
    fun form(value: PreceptForm) = mutable.update { it.copy(form = value, error = null) }
    fun editor(open: Boolean) = mutable.update {
        it.copy(
            editorOpen = open,
            form = if (open) PreceptForm(startDate = LocalDate.now().toString(), endDate = LocalDate.now().plusDays(7).toString()) else it.form,
            error = null,
        )
    }
    fun consume() = mutable.update { it.copy(message = null) }
    fun closeDetail() = mutable.update { it.copy(detail = null) }

    fun openDetail(id: String) = viewModelScope.launch {
        mutable.update { it.copy(actionId = id, error = null) }
        runCatching { repository.detail(id) }
            .onSuccess { detail -> mutable.update { it.copy(actionId = null, detail = detail) } }
            .onFailure { error -> mutable.update { it.copy(actionId = null, error = error.message) } }
    }

    fun save() {
        val form = mutable.value.form
        val error = when {
            form.title.trim().length < 3 -> "Dê um nome claro ao ciclo."
            form.instructions.trim().length < 3 -> "Escreva as orientações do preceito."
            form.startDate.isBlank() || form.endDate.isBlank() -> "Informe o início e o término."
            runCatching { LocalDate.parse(form.endDate) <= LocalDate.parse(form.startDate) }.getOrDefault(true) -> "O término precisa ser posterior ao início."
            form.audience == "cargo" && form.targetRoles.isEmpty() -> "Selecione ao menos uma função."
            form.audience == "individual" && form.targetChildren.isEmpty() -> "Selecione ao menos uma pessoa."
            else -> null
        }
        if (error != null) { mutable.update { it.copy(error = error) }; return }
        action("Ciclo salvo e a corrente foi atualizada.") { repository.create(form) }
    }

    fun status(cycle: PreceptCycle, status: String) = action(when (status) { "ativo" -> "Ciclo ativado para os participantes."; "encerrado" -> "Ciclo encerrado."; else -> "Ciclo cancelado." }) {
        repository.updateStatus(cycle.id, status)
    }

    fun participant(cycleId: String, participant: PreceptParticipant, status: String) = action("Participante atualizado.") {
        repository.updateParticipant(cycleId, participant.id, status)
    }

    private fun action(message: String, block: suspend () -> Unit) = viewModelScope.launch {
        mutable.update { it.copy(saving = true, error = null) }
        runCatching { block(); repository.load() }
            .onSuccess { payload -> mutable.update { it.copy(saving = false, editorOpen = false, detail = null, cycles = payload.cycles, children = payload.children, roles = payload.roles, foundations = payload.foundations, message = message) } }
            .onFailure { error -> mutable.update { it.copy(saving = false, error = error.message) } }
    }
}
