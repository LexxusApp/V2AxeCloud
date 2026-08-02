package br.com.axecloud.app.feature.home

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
class HomeViewModel @Inject constructor(
    private val repository: HomeRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = mutableState.asStateFlow()
    private val mutableInteraction = MutableStateFlow(InteractionUiState())
    val interaction: StateFlow<InteractionUiState> = mutableInteraction.asStateFlow()

    init { load() }

    fun load() = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching { repository.load() }
            .onSuccess { value -> mutableState.value = HomeUiState(loading = false, snapshot = value) }
            .onFailure { error -> mutableState.update { it.copy(loading = false, error = error.message ?: "Não foi possível carregar a casa.") } }
    }

    fun acknowledgePrecept(id: String) = runAction(id, "Ciência registrada.") {
        repository.acknowledgePrecept(id)
    }

    fun requestGuidance(id: String) = runAction(id, "Pedido de orientação enviado à zeladoria.") {
        repository.requestPreceptGuidance(id)
    }

    fun openConversation(id: String, title: String) = viewModelScope.launch {
        mutableInteraction.update { it.copy(conversationId = id, conversationTitle = title, loadingMessages = true, feedback = null) }
        runCatching { repository.loadMessages(id) }
            .onSuccess { messages -> mutableInteraction.update { it.copy(messages = messages, loadingMessages = false) } }
            .onFailure { error -> mutableInteraction.update { it.copy(loadingMessages = false, feedback = error.message) } }
    }

    fun closeConversation() = mutableInteraction.update { InteractionUiState() }

    fun sendMessage(text: String) {
        val id = mutableInteraction.value.conversationId ?: return
        if (text.isBlank() || mutableInteraction.value.sendingMessage) return
        viewModelScope.launch {
            mutableInteraction.update { it.copy(sendingMessage = true, feedback = null) }
            runCatching { repository.sendTextMessage(id, text) }
                .onSuccess {
                    val messages = repository.loadMessages(id)
                    mutableInteraction.update { it.copy(messages = messages, sendingMessage = false) }
                }
                .onFailure { error -> mutableInteraction.update { it.copy(sendingMessage = false, feedback = error.message) } }
        }
    }

    fun clearFeedback() = mutableInteraction.update { it.copy(feedback = null) }

    fun settleMonthlyPayment(item: HomeFeedItem) = runAction(item.id, "Mensalidade marcada como paga.") {
        repository.settleMonthlyPayment(item.id, item.amount)
    }

    fun createEvent(title: String, date: String, time: String, type: String, description: String) =
        runAction("new_event", "Gira criada e adicionada à agenda.") {
            require(title.isNotBlank()) { "Informe o nome da gira." }
            require(Regex("\\d{4}-\\d{2}-\\d{2}").matches(date)) { "Use a data no formato AAAA-MM-DD." }
            require(Regex("\\d{2}:\\d{2}").matches(time)) { "Use o horário no formato HH:MM." }
            repository.createEvent(title, date, time, type, description)
        }

    private fun runAction(id: String, success: String, block: suspend () -> Unit) = viewModelScope.launch {
        mutableInteraction.update { it.copy(actionInProgress = id, feedback = null) }
        runCatching { block() }
            .onSuccess {
                mutableInteraction.update { it.copy(actionInProgress = null, feedback = success) }
                load()
            }
            .onFailure { error -> mutableInteraction.update { it.copy(actionInProgress = null, feedback = error.message) } }
    }
}
