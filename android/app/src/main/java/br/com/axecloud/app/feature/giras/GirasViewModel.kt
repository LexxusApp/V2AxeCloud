package br.com.axecloud.app.feature.giras

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GirasViewModel @Inject constructor(private val repository: GirasRepository) : ViewModel() {
    private val mutableState = MutableStateFlow(GirasUiState())
    val state = mutableState.asStateFlow()
    init { load() }
    fun load() = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching { repository.load() }.onSuccess { (filho, data) -> mutableState.update { it.copy(loading = false, isFilho = filho, events = data) } }
            .onFailure { e -> mutableState.update { it.copy(loading = false, error = e.message) } }
    }
    fun filter(value: GiraFilter) = mutableState.update { it.copy(filter = value) }
    fun select(value: GiraEvent?) = mutableState.update { it.copy(selected = value) }
    fun openOperations(event: GiraEvent) = viewModelScope.launch {
        mutableState.update { it.copy(selected = null, operationsEvent = event, operations = null, loadingOperations = true, error = null) }
        runCatching { repository.loadOperations(event.id) }
            .onSuccess { data -> mutableState.update { it.copy(loadingOperations = false, operations = data) } }
            .onFailure { e -> mutableState.update { it.copy(loadingOperations = false, error = e.message) } }
    }
    fun closeOperations() = mutableState.update { it.copy(operationsEvent = null, operations = null, error = null) }
    fun approve(participant: GiraParticipant) = viewModelScope.launch {
        val event = state.value.operationsEvent ?: return@launch
        mutableState.update { it.copy(actionId = participant.id, error = null) }
        runCatching { repository.approve(event.id, participant.id); repository.loadOperations(event.id) }
            .onSuccess { data -> mutableState.update { it.copy(actionId = null, operations = data, message = "Participação aprovada.") } }
            .onFailure { e -> mutableState.update { it.copy(actionId = null, error = e.message) } }
    }
    fun create() = mutableState.update { it.copy(creating = true, editing = null) }
    fun edit(value: GiraEvent) = mutableState.update { it.copy(editing = value, creating = false, selected = null) }
    fun closeEditor() = mutableState.update { it.copy(creating = false, editing = null) }
    fun consumeMessage() = mutableState.update { it.copy(message = null) }
    fun save(form: GiraForm) = action("save", "Gira salva na agenda.") {
        require(form.title.isNotBlank()) { "Informe o nome da gira." }
        require(Regex("\\d{4}-\\d{2}-\\d{2}").matches(form.date)) { "Use a data AAAA-MM-DD." }
        require(Regex("\\d{2}:\\d{2}").matches(form.time)) { "Use o horário HH:MM." }
        repository.save(state.value.editing?.id, form)
    }
    fun delete(event: GiraEvent) = action(event.id, "Gira excluída.") { repository.delete(event.id) }
    fun respond(event: GiraEvent, confirm: Boolean) = action(event.id, if (confirm) "Presença confirmada." else "Resposta registrada.") { repository.respond(event.id, if (confirm) "confirmar" else "declinar") }
    fun notify(event: GiraEvent) = action(event.id, "Notificação enviada à corrente.") { repository.notify(event.id, event.title, event.date, event.time) }
    private fun action(id: String, success: String, block: suspend () -> Unit) = viewModelScope.launch {
        mutableState.update { it.copy(actionId = id, error = null) }
        runCatching { block(); repository.load() }.onSuccess { (filho, data) -> mutableState.update { it.copy(actionId = null, isFilho = filho, events = data, selected = null, editing = null, creating = false, message = success) } }
            .onFailure { e -> mutableState.update { it.copy(actionId = null, error = e.message) } }
    }
}
