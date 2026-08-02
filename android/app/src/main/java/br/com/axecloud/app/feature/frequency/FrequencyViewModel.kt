package br.com.axecloud.app.feature.frequency

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class FrequencyViewModel @Inject constructor(private val repository: FrequencyRepository) : ViewModel() {
    private val mutableState = MutableStateFlow(FrequencyUiState())
    val state = mutableState.asStateFlow()
    init { load() }
    fun load() = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        runCatching { repository.load() }
            .onSuccess { data -> mutableState.update { it.copy(loading = false, members = data) } }
            .onFailure { error -> mutableState.update { it.copy(loading = false, error = error.message) } }
    }
    fun query(value: String) = mutableState.update { it.copy(query = value) }
}
