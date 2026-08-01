package br.com.axecloud.app.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val AxeCloudColorScheme = lightColorScheme(
    primary = AxeCloudThemeTokens.Forest,
    onPrimary = AxeCloudThemeTokens.Ivory,
    secondary = AxeCloudThemeTokens.Gold,
    onSecondary = AxeCloudThemeTokens.ForestDeep,
    background = AxeCloudThemeTokens.Canvas,
    onBackground = AxeCloudThemeTokens.Ink,
    surface = AxeCloudThemeTokens.Surface,
    onSurface = AxeCloudThemeTokens.Ink,
    outline = AxeCloudThemeTokens.Outline,
    error = AxeCloudThemeTokens.Error,
)

@Composable
fun AxeCloudTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = AxeCloudColorScheme, typography = AxeCloudTypography, content = content)
}
