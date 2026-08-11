package br.com.axecloud.app.feature.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegistrationSheet(
    form: RegistrationForm,
    loading: Boolean,
    error: String?,
    onChange: (RegistrationForm) -> Unit,
    onDismiss: () -> Unit,
    onSubmit: () -> Unit,
) {
    var showPassword by rememberSaveable { mutableStateOf(false) }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = AxeCloudThemeTokens.Canvas,
        dragHandle = { BottomSheetDefaults.DragHandle(color = AxeCloudThemeTokens.Forest.copy(alpha = .35f)) },
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("COMECE SUA CASA", color = AxeCloudThemeTokens.Gold, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Text("AxéCloud desde o primeiro dia.", color = AxeCloudThemeTokens.ForestDeep, fontSize = 26.sp, fontWeight = FontWeight.Black)
            Text("Crie o terreiro, experimente todos os módulos por 30 dias e convide sua corrente quando estiver pronto.", color = AxeCloudThemeTokens.Muted, fontSize = 13.sp)

            RegistrationField(form.houseName, { onChange(form.copy(houseName = it)) }, "Nome do terreiro")
            RegistrationField(form.leaderName, { onChange(form.copy(leaderName = it)) }, "Seu nome na casa")
            RegistrationField(form.whatsapp, { onChange(form.copy(whatsapp = it.filter(Char::isDigit).take(15))) }, "WhatsApp", KeyboardType.Phone)
            RegistrationField(form.email, { onChange(form.copy(email = it)) }, "E-mail de acesso", KeyboardType.Email)
            OutlinedTextField(
                value = form.password,
                onValueChange = { onChange(form.copy(password = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Crie uma senha") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton({ showPassword = !showPassword }) {
                        Icon(if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (showPassword) "Ocultar senha" else "Mostrar senha")
                    }
                },
                enabled = !loading,
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
            )
            PasswordRules(form.password)

            Text("Depois do teste grátis", color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.ExtraBold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BillingChoice("Mensal", form.billingCycle == "monthly", Modifier.weight(1f)) { onChange(form.copy(billingCycle = "monthly")) }
                BillingChoice("Anual · economiza", form.billingCycle == "annual", Modifier.weight(1f)) { onChange(form.copy(billingCycle = "annual")) }
            }
            error?.let { Text(it, color = AxeCloudThemeTokens.Error, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
            Button(
                onClick = onSubmit,
                enabled = !loading,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(17.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest, contentColor = Color.White),
            ) {
                if (loading) CircularProgressIndicator(Modifier.size(21.dp), color = AxeCloudThemeTokens.Gold, strokeWidth = 2.dp)
                else Text("Criar minha casa · 30 dias grátis", fontWeight = FontWeight.Black)
            }
            Text("Ao continuar, você concorda com os Termos e a Política de Privacidade do AxéCloud.", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun RegistrationField(value: String, change: (String) -> Unit, label: String, keyboard: KeyboardType = KeyboardType.Text) =
    OutlinedTextField(value, change, Modifier.fillMaxWidth(), label = { Text(label) }, keyboardOptions = KeyboardOptions(keyboardType = keyboard), singleLine = true, shape = RoundedCornerShape(16.dp))

@Composable
private fun BillingChoice(label: String, selected: Boolean, modifier: Modifier = Modifier, click: () -> Unit) =
    FilterChip(selected, click, { Text(label, fontWeight = FontWeight.Bold) }, modifier = modifier, leadingIcon = if (selected) {{ Icon(Icons.Outlined.CheckCircle, null, Modifier.size(18.dp)) }} else null)

@Composable
private fun PasswordRules(password: String) {
    val rules = listOf(
        "8+ caracteres" to (password.length >= 8),
        "maiúscula e minúscula" to (password.any(Char::isUpperCase) && password.any(Char::isLowerCase)),
        "número e símbolo" to (password.any(Char::isDigit) && password.any { !it.isLetterOrDigit() }),
    )
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        rules.forEach { (label, ok) ->
            Surface(modifier = Modifier.weight(1f), shape = RoundedCornerShape(10.dp), color = if (ok) Color(0xFFE1F4E8) else Color.White) {
                Text(label, Modifier.padding(horizontal = 7.dp, vertical = 8.dp), color = if (ok) AxeCloudThemeTokens.Forest else AxeCloudThemeTokens.Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
