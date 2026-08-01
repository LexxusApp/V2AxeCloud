package br.com.axecloud.app.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.axecloud.app.core.session.SessionSnapshot
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val profile: AccessProfile = AccessProfile.ZELADOR,
    val primary: String = "",
    val secret: String = "",
    val loading: Boolean = false,
    val booting: Boolean = true,
    val error: String? = null,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repository: AuthRepository,
) : ViewModel() {
    private val mutableUiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = mutableUiState.asStateFlow()
    val session: StateFlow<SessionSnapshot> = repository.session.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        SessionSnapshot(),
    )

    init {
        viewModelScope.launch {
            repository.restore()
            mutableUiState.update { it.copy(booting = false) }
        }
    }

    fun setProfile(value: AccessProfile) = mutableUiState.update {
        it.copy(profile = value, primary = "", secret = "", error = null)
    }

    fun setPrimary(value: String) = mutableUiState.update { it.copy(primary = value, error = null) }

    fun setSecret(value: String) = mutableUiState.update {
        val normalized = if (it.profile == AccessProfile.FILHO) value.filter(Char::isDigit).take(6) else value
        it.copy(secret = normalized, error = null)
    }

    fun submit() {
        val state = mutableUiState.value
        val validation = validate(state)
        if (validation != null) {
            mutableUiState.update { it.copy(error = validation) }
            return
        }
        viewModelScope.launch {
            mutableUiState.update { it.copy(loading = true, error = null) }
            val result = when (state.profile) {
                AccessProfile.ZELADOR -> repository.loginZelador(state.primary, state.secret)
                AccessProfile.FILHO -> repository.loginFilho(state.primary, state.secret)
            }
            mutableUiState.update {
                when (result) {
                    AuthResult.Success -> it.copy(loading = false, error = null, secret = "")
                    is AuthResult.Error -> it.copy(loading = false, error = result.message)
                }
            }
        }
    }

    fun logout() = repository.logout()

    private fun validate(state: AuthUiState): String? = when (state.profile) {
        AccessProfile.ZELADOR -> when {
            !state.primary.contains('@') -> "Informe o e-mail cadastrado."
            state.secret.length < 6 -> "Informe sua senha."
            else -> null
        }
        AccessProfile.FILHO -> when {
            !state.primary.trim().uppercase().startsWith("AXC-") -> "Informe o registro completo, como AXC-2026-ABCD."
            state.secret.length != 6 -> "Digite os 6 primeiros números do CPF."
            else -> null
        }
    }
}
