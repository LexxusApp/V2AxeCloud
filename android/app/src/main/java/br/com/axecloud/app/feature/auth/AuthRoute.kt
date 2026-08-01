package br.com.axecloud.app.feature.auth

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun AuthRoute(viewModel: AuthViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    AuthScreen(
        state = state,
        onProfileChange = viewModel::setProfile,
        onPrimaryChange = viewModel::setPrimary,
        onSecretChange = viewModel::setSecret,
        onSubmit = viewModel::submit,
    )
}
