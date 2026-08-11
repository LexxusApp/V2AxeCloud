package br.com.axecloud.app.feature.home

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import javax.inject.Inject
import br.com.axecloud.app.core.network.ConnectivityObserver

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repository: HomeRepository,
    connectivity: ConnectivityObserver,
) : ViewModel() {
    private val mutableState = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = mutableState.asStateFlow()
    private val mutableInteraction = MutableStateFlow(InteractionUiState())
    val interaction: StateFlow<InteractionUiState> = mutableInteraction.asStateFlow()
    private var conversationRefresh: Job? = null
    private var lastLoadAt:Long=0
    private var wasOffline=false

    init { load();viewModelScope.launch{connectivity.connected.collect{online->val reconnect=wasOffline&&online;wasOffline=!online;mutableState.update{it.copy(offline=!online)};if(reconnect)load()}} }

    fun load() = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching { repository.load() }
            .onSuccess { value -> lastLoadAt=System.currentTimeMillis();mutableState.update{it.copy(loading=false,snapshot=value,error=null)} }
            .onFailure { error -> mutableState.update { it.copy(loading = false, error = if(it.snapshot.houseName.isBlank()) error.message ?: "Não foi possível carregar a casa." else null) } }
    }

    fun refreshIfStale(){if(System.currentTimeMillis()-lastLoadAt>15_000)load()}

    fun acknowledgePrecept(id: String) = runAction(id, "Ciência registrada.") {
        repository.acknowledgePrecept(id)
    }

    fun requestGuidance(id: String) = runAction(id, "Pedido de orientação enviado à zeladoria.") {
        repository.requestPreceptGuidance(id)
    }

    fun openConversation(id: String, title: String) = viewModelScope.launch {
        conversationRefresh?.cancel()
        mutableInteraction.update { it.copy(conversationId = id, conversationTitle = title, loadingMessages = true, feedback = null) }
        runCatching { repository.loadMessages(id) }
            .onSuccess { messages -> mutableInteraction.update { it.copy(messages = messages, loadingMessages = false) } }
            .onFailure { error -> mutableInteraction.update { it.copy(loadingMessages = false, feedback = error.message) } }
        conversationRefresh = viewModelScope.launch {
            while (isActive && mutableInteraction.value.conversationId == id) {
                delay(5_000)
                runCatching { repository.loadMessages(id) }.onSuccess { messages -> mutableInteraction.update { it.copy(messages = messages) } }
            }
        }
    }

    fun closeConversation() { conversationRefresh?.cancel(); conversationRefresh = null; mutableInteraction.update { InteractionUiState() } }

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

    fun sendMedia(uri: android.net.Uri) {
        val id = mutableInteraction.value.conversationId ?: return
        viewModelScope.launch {
            mutableInteraction.update { it.copy(sendingMessage = true, feedback = null) }
            runCatching { repository.sendMediaMessage(id, uri); repository.loadMessages(id) }
                .onSuccess { messages -> mutableInteraction.update { it.copy(messages = messages, sendingMessage = false) } }
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

    fun updatePrayerStatus(item: HomeFeedItem, status: String) = runAction(item.id, "Pedido atualizado.") {
        repository.updatePrayerStatus(item.id, status)
    }

    fun createAlbum(name: String, description: String) = runAction("new_album", "Álbum criado.") {
        require(name.isNotBlank()) { "Informe o nome do álbum." }
        repository.createAlbum(name, description)
    }

    fun addInventoryItem(name: String, category: String, current: String, minimum: String) =
        runAction("new_inventory", "Item adicionado ao almoxarifado.") {
            require(name.isNotBlank()) { "Informe o nome do item." }
            repository.addInventoryItem(name, category, current.toIntOrNull() ?: 0, minimum.toIntOrNull() ?: 0)
        }

    fun addStoreProduct(name: String, description: String, price: String, stock: String) =
        runAction("new_product", "Produto cadastrado na loja.") {
            require(name.isNotBlank()) { "Informe o nome do produto." }
            val parsedPrice = price.replace(',', '.').toDoubleOrNull() ?: 0.0
            repository.addStoreProduct(name, description, parsedPrice, stock.toIntOrNull() ?: 0)
        }

    fun uploadProfilePhoto(uri: Uri) = runAction("profile_photo", "Foto atualizada.") {
        repository.uploadProfilePhoto(uri)
    }

    fun validatePaymentReceipt(uri: Uri) = runAction("payment_receipt", "Comprovante validado. Mensalidade confirmada. Axé!") {
        repository.validatePaymentReceipt(uri)
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
