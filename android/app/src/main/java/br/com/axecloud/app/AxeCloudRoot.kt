package br.com.axecloud.app

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import br.com.axecloud.app.feature.auth.AuthRoute
import br.com.axecloud.app.feature.auth.AuthViewModel
import br.com.axecloud.app.feature.home.HomeRoute

@Composable
fun AxeCloudRoot(
    notificationTarget: String? = null,
    onNotificationConsumed: () -> Unit = {},
) {
    val authViewModel: AuthViewModel = hiltViewModel()
    val authState by authViewModel.uiState.collectAsStateWithLifecycle()
    val session by authViewModel.session.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = AxeCloudThemeTokens.Canvas) {
        when {
            authState.booting -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AxeCloudThemeTokens.Forest)
            }
            session.isAuthenticated -> HomeRoute(
                onLogout = authViewModel::logout,
                notificationTarget = notificationTarget,
                onNotificationConsumed = onNotificationConsumed,
            )
            else -> AuthRoute(authViewModel)
        }
    }
}
