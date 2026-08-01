package br.com.axecloud.app

import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import br.com.axecloud.app.designsystem.theme.AxeCloudTheme
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import androidx.compose.ui.graphics.toArgb
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(
                scrim = AxeCloudThemeTokens.Canvas.toArgb(),
                darkScrim = AxeCloudThemeTokens.Canvas.toArgb(),
            ),
            navigationBarStyle = SystemBarStyle.dark(AxeCloudThemeTokens.Forest.toArgb()),
        )
        setContent {
            AxeCloudTheme { AxeCloudRoot() }
        }
    }
}
