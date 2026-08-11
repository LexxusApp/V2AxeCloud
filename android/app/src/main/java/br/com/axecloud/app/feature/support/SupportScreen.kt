package br.com.axecloud.app.feature.support

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

private val SupportBlue = Color(0xFF24556B)
private val SupportMint = Color(0xFF72D4BC)

@Composable
fun SupportRoute(viewModel: SupportViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    when {
        state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = SupportBlue) }
        else -> AnimatedContent(state.sent, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "support-state") { sent ->
            if (sent) SupportSuccess(state.form.whatsapp, viewModel::another)
            else SupportFormScreen(state, viewModel)
        }
    }
}

@Composable
private fun SupportFormScreen(state: SupportUiState, viewModel: SupportViewModel) {
    val form = state.form
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        Surface(shape = RoundedCornerShape(30.dp), color = SupportBlue, shadowElevation = 8.dp) {
            Box(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(SupportBlue, Color(0xFF123744)))).padding(22.dp)) {
                Column {
                    Surface(Modifier.size(48.dp), shape = RoundedCornerShape(16.dp), color = SupportMint) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.HeadsetMic, null, tint = SupportBlue) } }
                    Text("SUPORTE HUMANO AXÉCLOUD", color = SupportMint, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, modifier = Modifier.padding(top = 17.dp))
                    Text("Estamos aqui para resolver.", color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Black)
                    Text("Conte o que aconteceu. A equipe recebe o pedido e retorna pelo WhatsApp informado.", color = Color.White.copy(alpha = .7f), fontSize = 11.sp, modifier = Modifier.padding(top = 7.dp))
                }
            }
        }
        Surface(shape = RoundedCornerShape(23.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
            Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                SupportField(form.leaderName, { viewModel.update(form.copy(leaderName = it)) }, "Nome do zelador(a)")
                SupportField(form.houseName, { viewModel.update(form.copy(houseName = it)) }, "Nome do terreiro")
                SupportField(form.whatsapp, { viewModel.update(form.copy(whatsapp = it.filter(Char::isDigit).take(13))) }, "WhatsApp com DDD", KeyboardType.Phone)
                OutlinedTextField(form.message, { viewModel.update(form.copy(message = it.take(4000))) }, Modifier.fillMaxWidth(), label = { Text("Como podemos ajudar?") }, minLines = 5, maxLines = 9, supportingText = { Text("${form.message.length}/4000") }, shape = RoundedCornerShape(16.dp))
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                Button(viewModel::send, Modifier.fillMaxWidth().height(54.dp), enabled = !state.sending, colors = ButtonDefaults.buttonColors(containerColor = SupportBlue), shape = RoundedCornerShape(17.dp)) {
                    if (state.sending) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White) else Icon(Icons.Outlined.Send, null)
                    Spacer(Modifier.width(8.dp)); Text(if (state.sending) "Enviando pedido..." else "Enviar para o suporte")
                }
            }
        }
        Text("Por segurança, este canal está disponível somente para a liderança da casa.", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 6.dp))
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SupportField(value: String, change: (String) -> Unit, label: String, keyboard: KeyboardType = KeyboardType.Text) = OutlinedTextField(value, change, Modifier.fillMaxWidth(), label = { Text(label) }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = keyboard), shape = RoundedCornerShape(16.dp))

@Composable
private fun SupportSuccess(whatsapp: String, another: () -> Unit) = Column(Modifier.fillMaxSize().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
    Surface(Modifier.size(78.dp), shape = CircleShape, color = SupportMint.copy(alpha = .2f)) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.CheckCircle, null, Modifier.size(40.dp), tint = Color(0xFF28765F)) } }
    Text("Pedido recebido", color = AxeCloudThemeTokens.Ink, fontSize = 27.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 20.dp))
    Text("Nossa equipe retornará pelo WhatsApp $whatsapp.", color = AxeCloudThemeTokens.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
    OutlinedButton(another, Modifier.padding(top = 22.dp)) { Text("Enviar outro pedido") }
}
