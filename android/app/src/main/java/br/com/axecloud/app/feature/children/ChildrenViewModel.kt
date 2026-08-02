package br.com.axecloud.app.feature.children

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ChildrenViewModel @Inject constructor(
    private val repository: ChildrenRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(ChildrenUiState())
    val state: StateFlow<ChildrenUiState> = mutableState.asStateFlow()

    init { load() }

    fun load() = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching { repository.list() }
            .onSuccess { children -> mutableState.update { it.copy(loading = false, children = children) } }
            .onFailure { error -> mutableState.update { it.copy(loading = false, error = error.message ?: "Não foi possível carregar a corrente.") } }
    }

    fun setQuery(query: String) = mutableState.update { it.copy(query = query) }
    fun setFilter(filter: ChildStatusFilter) = mutableState.update { it.copy(filter = filter) }
    fun select(child: ChildOfSaint?) = mutableState.update { it.copy(selected = child) }
    fun create() = mutableState.update { it.copy(creating = true, editing = null) }
    fun edit(child: ChildOfSaint) = mutableState.update { it.copy(editing = child, creating = false, selected = null) }
    fun closeEditor() = mutableState.update { it.copy(creating = false, editing = null) }
    fun consumeMessage() = mutableState.update { it.copy(message = null) }

    fun save(form: ChildForm) {
        require(form.name.isNotBlank()) { "Informe o nome." }
        viewModelScope.launch {
            val editing = state.value.editing
            mutableState.update { it.copy(saving = true, error = null) }
            runCatching {
                if (editing == null) repository.create(form) else repository.update(editing.id, form)
                repository.list()
            }.onSuccess { children ->
                mutableState.update {
                    it.copy(
                        saving = false,
                        creating = false,
                        editing = null,
                        children = children,
                        message = if (editing == null) "Pessoa adicionada à corrente." else "Cadastro atualizado.",
                    )
                }
            }.onFailure { error -> mutableState.update { it.copy(saving = false, error = error.message) } }
        }
    }

    fun delete(child: ChildOfSaint) = viewModelScope.launch {
        mutableState.update { it.copy(deletingId = child.id, error = null) }
        runCatching { repository.delete(child.id) }
            .onSuccess {
                mutableState.update {
                    it.copy(
                        deletingId = null,
                        selected = null,
                        children = it.children.filterNot { person -> person.id == child.id },
                        message = "Cadastro excluído.",
                    )
                }
            }
            .onFailure { error -> mutableState.update { it.copy(deletingId = null, error = error.message) } }
    }
}
