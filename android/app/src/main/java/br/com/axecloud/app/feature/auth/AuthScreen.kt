package br.com.axecloud.app.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.size
import br.com.axecloud.app.designsystem.component.AxeCloudBrand
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

@Composable
fun AuthScreen(
    state: AuthUiState,
    onProfileChange: (AccessProfile) -> Unit,
    onPrimaryChange: (String) -> Unit,
    onSecretChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(AxeCloudThemeTokens.Ivory, AxeCloudThemeTokens.Canvas)))
            .navigationBarsPadding()
            .imePadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(26.dp))
            AxeCloudBrand(centered = true)
            Spacer(Modifier.height(34.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = AxeCloudThemeTokens.Surface,
                shape = RoundedCornerShape(28.dp),
                shadowElevation = 10.dp,
            ) {
                Column(modifier = Modifier.padding(22.dp)) {
                    Text(
                        text = "Entre na sua casa",
                        color = AxeCloudThemeTokens.Forest,
                        fontSize = 25.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Sua corrente, sua rotina e sua memória em um só lugar.",
                        color = AxeCloudThemeTokens.Muted,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                    )
                    Spacer(Modifier.height(22.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(AxeCloudThemeTokens.Ivory, RoundedCornerShape(16.dp))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        ProfileButton(
                            text = "Sou zelador(a)",
                            selected = state.profile == AccessProfile.ZELADOR,
                            modifier = Modifier.weight(1f),
                        ) { onProfileChange(AccessProfile.ZELADOR) }
                        ProfileButton(
                            text = "Sou filho(a)",
                            selected = state.profile == AccessProfile.FILHO,
                            modifier = Modifier.weight(1f),
                        ) { onProfileChange(AccessProfile.FILHO) }
                    }

                    Spacer(Modifier.height(20.dp))
                    OutlinedTextField(
                        value = state.primary,
                        onValueChange = onPrimaryChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (state.profile == AccessProfile.ZELADOR) "E-mail" else "Registro AxéCloud") },
                        placeholder = {
                            Text(if (state.profile == AccessProfile.ZELADOR) "voce@terreiro.com" else "AXC-2026-ABCD")
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = if (state.profile == AccessProfile.ZELADOR) KeyboardType.Email else KeyboardType.Ascii,
                        ),
                        enabled = !state.loading,
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        colors = fieldColors(),
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = state.secret,
                        onValueChange = onSecretChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = {
                            Text(if (state.profile == AccessProfile.ZELADOR) "Senha" else "6 primeiros números do CPF")
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = if (state.profile == AccessProfile.ZELADOR) KeyboardType.Password else KeyboardType.NumberPassword,
                        ),
                        enabled = !state.loading,
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        shape = RoundedCornerShape(16.dp),
                        colors = fieldColors(),
                    )

                    state.error?.takeIf(String::isNotBlank)?.let { message ->
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = message,
                            color = AxeCloudThemeTokens.Error,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }

                    Spacer(Modifier.height(18.dp))
                    Button(
                        onClick = onSubmit,
                        enabled = !state.loading,
                        modifier = Modifier.fillMaxWidth().height(54.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AxeCloudThemeTokens.Forest,
                            contentColor = AxeCloudThemeTokens.Ivory,
                            disabledContainerColor = AxeCloudThemeTokens.Forest.copy(alpha = 0.7f),
                        ),
                    ) {
                        if (state.loading) {
                            CircularProgressIndicator(
                                color = AxeCloudThemeTokens.Gold,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(22.dp),
                            )
                        } else {
                            Text("Entrar no AxéCloud", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(Modifier.height(22.dp))
            Text(
                text = "Tecnologia a serviço da casa de axé.",
                color = AxeCloudThemeTokens.Muted,
                fontSize = 12.sp,
            )
        }
    }
}

@Composable
private fun ProfileButton(
    text: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    TextButton(
        onClick = onClick,
        modifier = modifier.height(44.dp),
        shape = RoundedCornerShape(13.dp),
        colors = ButtonDefaults.textButtonColors(
            containerColor = if (selected) AxeCloudThemeTokens.Gold else Color.Transparent,
            contentColor = AxeCloudThemeTokens.ForestDeep,
        ),
    ) {
        Text(text, fontWeight = FontWeight.Bold, fontSize = 12.sp)
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = AxeCloudThemeTokens.Forest,
    unfocusedBorderColor = AxeCloudThemeTokens.Outline,
    focusedLabelColor = AxeCloudThemeTokens.Forest,
    cursorColor = AxeCloudThemeTokens.Forest,
    focusedContainerColor = AxeCloudThemeTokens.Surface,
    unfocusedContainerColor = AxeCloudThemeTokens.Surface,
)
