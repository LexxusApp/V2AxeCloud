package br.com.axecloud.app.feature.settings

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

private val WaGreen = Color(0xFF17C786)
private val WaNight = Color(0xFF0C2920)

@Composable
fun WhatsAppSettingsPanel(state: SettingsUiState, viewModel: SettingsViewModel) {
    val value = state.whatsapp
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(shape = RoundedCornerShape(25.dp), color = WaNight, shadowElevation = 7.dp) {
            Box(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(WaNight, Color(0xFF123C30)))).padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(Modifier.size(48.dp), shape = RoundedCornerShape(16.dp), color = WaGreen) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Wifi, null, tint = WaNight) } }
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Text("CANAL OFICIAL AXÉCLOUD", color = WaGreen, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                        Text(if (value.connected) "WhatsApp conectado" else "Canal inicializando", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                        Text(value.channelMessage.ifBlank { "Mensagens oficiais da casa em um só lugar." }, color = Color.White.copy(alpha = .65f), fontSize = 10.sp)
                    }
                    Box(Modifier.size(12.dp).background(if (value.connected) WaGreen else Color(0xFF9CA3AF), CircleShape))
                }
            }
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            listOf("automacoes" to "Automações", "teste" to "Testar envio", "historico" to "Histórico").forEach { (key, label) -> FilterChip(state.whatsappView == key, { viewModel.whatsappView(key) }, label = { Text(label) }) }
        }
        when (state.whatsappView) {
            "teste" -> TestPanel(state, viewModel)
            "historico" -> HistoryPanel(value.logs)
            else -> AutomationsPanel(value.preferences, state.saving, viewModel::saveWhatsApp)
        }
    }
}

@Composable
private fun AutomationsPanel(value: WhatsAppPreferences, saving: Boolean, save: (WhatsAppPreferences) -> Unit) = Surface(shape = RoundedCornerShape(22.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text("AVISOS AUTOMÁTICOS", color = WaNight, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
        AutomationToggle("Notificação de gira", "Convoca a corrente quando uma gira é agendada.", value.giras, saving) { save(value.copy(giras = it)) }
        AutomationToggle("Comprovantes financeiros", "Envia confirmação após compensar mensalidades.", value.financeiro, saving) { save(value.copy(financeiro = it)) }
        AutomationToggle("Pedidos de reza", "Avisa a liderança e acolhe o fiel.", value.reza, saving) { save(value.copy(reza = it)) }
        AutomationToggle("Aniversários", "Lembra a casa dos aniversariantes do mês.", value.aniversarios, saving) { save(value.copy(aniversarios = it)) }
    }
}

@Composable
private fun AutomationToggle(title: String, detail: String, checked: Boolean, disabled: Boolean, change: (Boolean) -> Unit) = Row(Modifier.fillMaxWidth().background(AxeCloudThemeTokens.Canvas, RoundedCornerShape(16.dp)).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
    Surface(Modifier.size(38.dp), shape = RoundedCornerShape(12.dp), color = WaGreen.copy(alpha = .13f)) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Bolt, null, tint = WaGreen) } }
    Column(Modifier.weight(1f).padding(horizontal = 10.dp)) { Text(title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black, fontSize = 12.sp); Text(detail, color = AxeCloudThemeTokens.Muted, fontSize = 9.sp) }
    Switch(checked, change, enabled = !disabled)
}

@Composable
private fun TestPanel(state: SettingsUiState, viewModel: SettingsViewModel) = Surface(shape = RoundedCornerShape(22.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
    Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
        Text("Teste o canal oficial", color = AxeCloudThemeTokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Text("A mensagem chega pelo número oficial do AxéCloud, sem QR Code ou celular conectado.", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
        OutlinedTextField(state.whatsapp.testPhone, { viewModel.whatsapp(state.whatsapp.copy(testPhone = it.filter(Char::isDigit).take(13))) }, Modifier.fillMaxWidth(), label = { Text("Celular com DDD") }, singleLine = true, shape = RoundedCornerShape(16.dp))
        Button(viewModel::testWhatsApp, Modifier.fillMaxWidth().height(52.dp), enabled = !state.saving && state.whatsapp.connected, colors = ButtonDefaults.buttonColors(containerColor = WaNight), shape = RoundedCornerShape(16.dp)) { Icon(Icons.Outlined.Send, null); Spacer(Modifier.width(7.dp)); Text("Enviar mensagem de teste") }
    }
}

@Composable
private fun HistoryPanel(logs: List<WhatsAppLog>) = Surface(shape = RoundedCornerShape(22.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.History, null, tint = WaNight); Text("Envios recentes", Modifier.padding(start = 8.dp), color = AxeCloudThemeTokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Black) }
        if (logs.isEmpty()) Text("Nenhum envio registrado ainda.", color = AxeCloudThemeTokens.Muted, modifier = Modifier.padding(vertical = 22.dp))
        else logs.take(12).forEach { log ->
            Row(Modifier.fillMaxWidth().background(AxeCloudThemeTokens.Canvas, RoundedCornerShape(15.dp)).padding(11.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.CheckCircle, null, tint = if (log.status.lowercase() in setOf("failed", "falha")) MaterialTheme.colorScheme.error else WaGreen)
                Column(Modifier.weight(1f).padding(horizontal = 9.dp)) { Text(log.type.ifBlank { "Mensagem" }.replace('_', ' '), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold, fontSize = 11.sp); Text(log.message, color = AxeCloudThemeTokens.Muted, fontSize = 9.sp, maxLines = 2) }
                Text(log.createdAt.take(10), color = AxeCloudThemeTokens.Muted, fontSize = 8.sp)
            }
        }
    }
}
