package br.com.axecloud.app.feature.notices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NoticesViewModel @Inject constructor(private val repository: NoticesRepository) : ViewModel() {
    private val mutableState = MutableStateFlow(NoticesUiState())
    val state = mutableState.asStateFlow()
    init { load() }
    fun load() = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching { repository.load() }.onSuccess { payload -> mutableState.update { it.copy(loading = false, isFilho = payload.isFilho, notices = payload.notices, logs = payload.logs) } }
            .onFailure { e -> mutableState.update { it.copy(loading = false, error = e.message) } }
    }
    fun query(value: String) = mutableState.update { it.copy(query = value) }
    fun category(value: String) = mutableState.update { it.copy(category = value) }
    fun section(value: String) = mutableState.update { it.copy(section = value) }
    fun select(value: HouseNotice?) = mutableState.update { it.copy(selected = value) }
    fun compose(form: NoticeForm = NoticeForm()) = mutableState.update { it.copy(composing = true, selected = null, draft = form) }
    fun closeComposer() = mutableState.update { it.copy(composing = false, draft = NoticeForm()) }
    fun consumeMessage() = mutableState.update { it.copy(message = null) }
    fun publish(form: NoticeForm) = viewModelScope.launch {
        mutableState.update { it.copy(publishing = true, error = null) }
        runCatching { require(form.title.isNotBlank()) { "Informe o título." }; require(form.content.isNotBlank()) { "Escreva a mensagem." }; repository.publish(form); repository.load() }
            .onSuccess { payload -> mutableState.update { it.copy(publishing = false, composing = false, draft = NoticeForm(), isFilho = payload.isFilho, notices = payload.notices, logs = payload.logs, message = "Comunicado publicado e enviado ao app.") } }
            .onFailure { e -> mutableState.update { it.copy(publishing = false, error = e.message) } }
    }
    fun delete(notice: HouseNotice) = viewModelScope.launch {
        mutableState.update { it.copy(actionId = notice.id, error = null) }
        runCatching { repository.delete(notice.id) }.onSuccess { mutableState.update { it.copy(actionId = null, selected = null, notices = it.notices.filterNot { row -> row.id == notice.id }, message = "Comunicado excluído.") } }
            .onFailure { e -> mutableState.update { it.copy(actionId = null, error = e.message) } }
    }
}
