package br.com.axecloud.app.feature.support

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SupportViewModel @Inject constructor(private val repository: SupportRepository) : ViewModel() {
    private val mutableState = MutableStateFlow(SupportUiState())
    val state = mutableState.asStateFlow()

    init { load() }

    fun load() = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching { repository.load() }
            .onSuccess { form -> mutableState.update { it.copy(loading = false, form = form) } }
            .onFailure { error -> mutableState.update { it.copy(loading = false, error = error.message) } }
    }

    fun update(form: SupportForm) = mutableState.update { it.copy(form = form, error = null) }
    fun another() = mutableState.update { it.copy(sent = false, error = null) }

    fun send() {
        val form = mutableState.value.form
        val validation = when {
            form.leaderName.trim().length < 2 -> "Informe o nome do zelador(a)."
            form.houseName.trim().length < 2 -> "Informe o nome do terreiro."
            form.whatsapp.count(Char::isDigit) !in 10..13 -> "Informe WhatsApp com DDD + número."
            form.message.trim().length < 10 -> "Descreva o problema com pelo menos 10 caracteres."
            else -> null
        }
        if (validation != null) {
            mutableState.update { it.copy(error = validation) }
            return
        }
        viewModelScope.launch {
            mutableState.update { it.copy(sending = true, error = null) }
            runCatching { repository.send(form) }
                .onSuccess { mutableState.update { it.copy(sending = false, sent = true, form = it.form.copy(message = "")) } }
                .onFailure { error -> mutableState.update { it.copy(sending = false, error = error.message) } }
        }
    }
}
