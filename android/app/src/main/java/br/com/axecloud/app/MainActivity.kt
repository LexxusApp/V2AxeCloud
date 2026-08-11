package br.com.axecloud.app

import android.os.Bundle
import android.content.Intent
import androidx.activity.SystemBarStyle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import br.com.axecloud.app.designsystem.theme.AxeCloudTheme
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import androidx.compose.ui.graphics.toArgb
import dagger.hilt.android.AndroidEntryPoint
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private var notificationTarget by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        notificationTarget = intent.getStringExtra(EXTRA_NOTIFICATION_TARGET)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(
                scrim = AxeCloudThemeTokens.Canvas.toArgb(),
                darkScrim = AxeCloudThemeTokens.Canvas.toArgb(),
            ),
            navigationBarStyle = SystemBarStyle.dark(AxeCloudThemeTokens.Forest.toArgb()),
        )
        setContent {
            AxeCloudTheme {
                AxeCloudRoot(
                    notificationTarget = notificationTarget,
                    onNotificationConsumed = { notificationTarget = null },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        notificationTarget = intent.getStringExtra(EXTRA_NOTIFICATION_TARGET)
    }

    companion object {
        const val EXTRA_NOTIFICATION_TARGET = "axecloud.notification.target"
    }
}
