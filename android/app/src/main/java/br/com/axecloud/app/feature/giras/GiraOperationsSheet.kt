package br.com.axecloud.app.feature.giras

import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.HowToReg
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.ConfirmationNumber
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.IconButton
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import coil.compose.AsyncImage
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun GiraOperationsSheet(
    event: GiraEvent,
    operations: GiraOperations?,
    loading: Boolean,
    actionId: String?,
    error: String?,
    onDismiss: () -> Unit,
    onApprove: (GiraParticipant) -> Unit,
    onIssueTicket: (String, String) -> Unit,
    onUpdateTicket: (GiraTicket, String) -> Unit,
    onSaveCandles: (List<GiraCandle>) -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    var tab by rememberSaveable(event.id) { mutableStateOf("Corrente") }
    var candleDraft by remember(operations?.candles) { mutableStateOf(operations?.candles.orEmpty()) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AxeCloudThemeTokens.Canvas, dragHandle = null) {
        Column(Modifier.fillMaxHeight(.92f).navigationBarsPadding()) {
            Surface(color = AxeCloudThemeTokens.Forest) {
                Column(Modifier.fillMaxWidth().padding(20.dp)) {
                    Text("CENTRAL DA GIRA", color = AxeCloudThemeTokens.Gold, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    Text(event.title, color = AxeCloudThemeTokens.Ivory, fontSize = 25.sp, fontWeight = FontWeight.Black)
                    Text("${event.date.brDateOps()} às ${event.time}", color = AxeCloudThemeTokens.Ivory.copy(alpha = .72f), fontSize = 12.sp)
                    if (operations != null) {
                        Spacer(Modifier.height(15.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OperationMetric(operations.total.toString(), "corrente", Icons.Outlined.Groups, Modifier.weight(1f))
                            OperationMetric(operations.confirmed.toString(), "confirmados", Icons.Outlined.CheckCircle, Modifier.weight(1f))
                            OperationMetric(operations.remaining?.toString() ?: "∞", "vagas", Icons.Outlined.HowToReg, Modifier.weight(1f))
                        }
                    }
                }
            }
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("Corrente", "Senhas", "Velas", "Portaria").forEach { value -> FilterChip(tab == value, { tab = value }, label = { Text(value) }, leadingIcon = { Icon(when(value) { "Senhas" -> Icons.Outlined.ConfirmationNumber; "Velas" -> Icons.Outlined.LocalFireDepartment; "Portaria" -> Icons.Outlined.QrCode2; else -> Icons.Outlined.Groups }, null, Modifier.size(17.dp)) }) }
            }
            when {
                loading -> Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = AxeCloudThemeTokens.Forest) }
                operations == null -> Box(Modifier.fillMaxWidth().weight(1f).padding(28.dp), contentAlignment = Alignment.Center) { Text(error ?: "Não foi possível abrir a operação da gira.", color = AxeCloudThemeTokens.Ink) }
                else -> LazyColumn(
                    Modifier.weight(1f),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 15.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    when (tab) {
                        "Portaria" -> item { PortariaCard(operations.checkinUrl, operations.publicUrl, { clipboard.setText(AnnotatedString(it)) }) { url -> context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, url) }, "Compartilhar acesso da gira")) } }
                        "Senhas" -> {
                            item { TicketIssueCard(actionId == "ticket", onIssueTicket) }
                            if (operations.tickets.isEmpty()) item { EmptyOperation("Nenhuma senha emitida", "Emita uma senha para visitantes ou compartilhe a página pública.", Icons.Outlined.ConfirmationNumber) }
                            else items(operations.tickets, key = { it.id }) { ticket -> TicketRow(ticket, actionId == ticket.id) { onUpdateTicket(ticket, it) } }
                        }
                        "Velas" -> {
                            item { Text("MAPA DE VELAS", color = AxeCloudThemeTokens.GoldStrong, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = .9.sp); Text("Obrigações preparadas por filho", color = AxeCloudThemeTokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Black) }
                            if (candleDraft.isEmpty()) item { EmptyOperation("Nenhum membro disponível", "Cadastre a corrente para organizar as velas desta gira.", Icons.Outlined.LocalFireDepartment) }
                            else items(candleDraft, key = { it.childId }) { candle -> CandleRow(candle) { changed -> candleDraft = candleDraft.map { if (it.childId == changed.childId) changed else it } } }
                            if (candleDraft.isNotEmpty()) item { Button({ onSaveCandles(candleDraft) }, Modifier.fillMaxWidth().height(52.dp), enabled = actionId != "candles" && candleDraft.any { !it.color.isNullOrBlank() }, colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { if (actionId == "candles") CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White) else Text("Salvar mapa de velas") } }
                        }
                        else -> {
                            item { Text("CORRENTE DA GIRA", color = AxeCloudThemeTokens.GoldStrong, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = .9.sp); Text("Confirmações e pedidos de participação", color = AxeCloudThemeTokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Black) }
                            if (operations.participants.isEmpty()) item { EmptyParticipants() }
                            else items(operations.participants.sortedWith(compareBy<GiraParticipant> { statusOrder(it.status) }.thenBy { it.name }), key = { it.id }) { participant -> ParticipantRow(participant, actionId == participant.id) { onApprove(participant) } }
                        }
                    }
                    if (error != null) item { Text(error, color = androidx.compose.material3.MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                    item { Spacer(Modifier.height(12.dp)) }
                }
            }
        }
    }
}

@Composable
private fun OperationMetric(value: String, label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(14.dp), color = Color.White.copy(alpha = .08f)) {
        Column(Modifier.padding(10.dp)) {
            Icon(icon, null, Modifier.size(17.dp), tint = AxeCloudThemeTokens.Gold)
            Text(value, color = AxeCloudThemeTokens.Ivory, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Text(label, color = AxeCloudThemeTokens.Ivory.copy(alpha = .62f), fontSize = 9.sp)
        }
    }
}

@Composable
private fun PortariaCard(checkinUrl: String, publicUrl: String, copy: (String) -> Unit, share: (String) -> Unit) {
    Surface(shape = RoundedCornerShape(21.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.fillMaxWidth().padding(15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(12.dp), color = AxeCloudThemeTokens.Gold.copy(alpha = .18f)) { Icon(Icons.Outlined.QrCode2, null, Modifier.padding(9.dp), tint = AxeCloudThemeTokens.Forest) }
                Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text("Portaria digital", color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black); Text("QR exclusivo para o check-in desta gira", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp) }
            }
            if (checkinUrl.isNotBlank()) {
                val qr = remember(checkinUrl) { qrBitmap(checkinUrl) }
                Spacer(Modifier.height(13.dp))
                Image(qr.asImageBitmap(), "QR Code da portaria", Modifier.size(155.dp).align(Alignment.CenterHorizontally))
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton({ copy(checkinUrl) }, Modifier.weight(1f)) { Icon(Icons.Outlined.ContentCopy, null); Spacer(Modifier.width(5.dp)); Text("Copiar") }
                    Button({ share(publicUrl.ifBlank { checkinUrl }) }, Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Icon(Icons.Outlined.Share, null); Spacer(Modifier.width(5.dp)); Text("Compartilhar") }
                }
            } else {
                Spacer(Modifier.height(12.dp)); Text("O QR será gerado quando a operação da gira estiver disponível.", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun ParticipantRow(participant: GiraParticipant, busy: Boolean, approve: () -> Unit) {
    val statusColor = when (participant.status) { "confirmado", "presente" -> Color(0xFF1B7C55); "recusado" -> Color(0xFFB14A48); else -> Color(0xFFB37A1C) }
    Surface(shape = RoundedCornerShape(18.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(Modifier.size(43.dp), shape = CircleShape, color = statusColor.copy(alpha = .1f)) {
                if (participant.photoUrl.isNotBlank()) AsyncImage(participant.photoUrl, participant.name, contentScale = ContentScale.Crop)
                else Icon(Icons.Outlined.Groups, null, Modifier.padding(10.dp), tint = statusColor)
            }
            Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) {
                Text(participant.name, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(participant.role.ifBlank { "Filho de Santo" }, color = AxeCloudThemeTokens.Muted, fontSize = 10.sp)
                if (participant.justification.isNotBlank()) Text(participant.justification, color = statusColor, fontSize = 9.sp, maxLines = 1)
            }
            if (participant.status == "pendente") Button(approve, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) {
                if (busy) CircularProgressIndicator(Modifier.size(17.dp), strokeWidth = 2.dp, color = Color.White) else Text("Aprovar", fontSize = 10.sp)
            } else Surface(shape = RoundedCornerShape(50), color = statusColor.copy(alpha = .1f)) { Text(participant.status.replaceFirstChar(Char::uppercase), Modifier.padding(horizontal = 9.dp, vertical = 5.dp), color = statusColor, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun TicketIssueCard(busy: Boolean, issue: (String, String) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    Surface(shape = RoundedCornerShape(20.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Emitir senha de visitante", color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black)
            OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text("Nome") }, singleLine = true, shape = RoundedCornerShape(14.dp))
            OutlinedTextField(phone, { phone = it }, Modifier.fillMaxWidth(), label = { Text("WhatsApp (opcional)") }, singleLine = true, shape = RoundedCornerShape(14.dp))
            Button({ issue(name, phone); name = ""; phone = "" }, Modifier.fillMaxWidth(), enabled = !busy && name.isNotBlank(), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { if (busy) CircularProgressIndicator(Modifier.size(17.dp), strokeWidth = 2.dp, color = Color.White) else Text("Emitir senha") }
        }
    }
}

@Composable
private fun TicketRow(ticket: GiraTicket, busy: Boolean, update: (String) -> Unit) {
    val next = when (ticket.status) { "aguardando" -> "chamado"; "chamado", "presente" -> "atendido"; else -> "aguardando" }
    val action = when (next) { "chamado" -> "Chamar"; "atendido" -> "Atender"; else -> "Reabrir" }
    Surface(shape = RoundedCornerShape(18.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = CircleShape, color = AxeCloudThemeTokens.Gold.copy(alpha = .2f)) { Text("#${ticket.number}", Modifier.padding(horizontal = 10.dp, vertical = 9.dp), color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Black) }
            Column(Modifier.weight(1f).padding(horizontal = 10.dp)) { Text(ticket.name, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black); Text(ticket.status.replaceFirstChar(Char::uppercase), color = AxeCloudThemeTokens.Muted, fontSize = 10.sp) }
            OutlinedButton({ update(next) }, enabled = !busy) { if (busy) CircularProgressIndicator(Modifier.size(15.dp), strokeWidth = 2.dp) else Text(action, fontSize = 10.sp) }
        }
    }
}

private val candleColors = listOf<String?>(null, "Branca", "Azul", "Amarela", "Verde", "Vermelha", "Roxa", "Rosa", "Preta")

@Composable
private fun CandleRow(candle: GiraCandle, change: (GiraCandle) -> Unit) {
    val currentIndex = candleColors.indexOf(candle.color).coerceAtLeast(0)
    Surface(shape = RoundedCornerShape(18.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.fillMaxWidth().padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(Modifier.size(39.dp), shape = CircleShape, color = candleTone(candle.color).copy(alpha = .16f)) { if (candle.photoUrl.isNotBlank()) AsyncImage(candle.photoUrl, candle.name, contentScale = ContentScale.Crop) else Icon(Icons.Outlined.LocalFireDepartment, null, Modifier.padding(9.dp), tint = candleTone(candle.color)) }
                Column(Modifier.weight(1f).padding(horizontal = 9.dp)) { Text(candle.name, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis); Text(candle.role.ifBlank { "Filho de Santo" }, color = AxeCloudThemeTokens.Muted, fontSize = 9.sp) }
                Checkbox(candle.delivered, { change(candle.copy(delivered = it)) }, enabled = !candle.color.isNullOrBlank())
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton({ change(candle.copy(color = candleColors[(currentIndex + 1) % candleColors.size])) }, Modifier.weight(1f)) { Icon(Icons.Outlined.LocalFireDepartment, null, tint = candleTone(candle.color)); Spacer(Modifier.width(5.dp)); Text(candle.color ?: "Definir vela", fontSize = 10.sp) }
                IconButton({ change(candle.copy(quantity = (candle.quantity - 1).coerceAtLeast(1))) }) { Icon(Icons.Outlined.Remove, "Diminuir") }
                Text(candle.quantity.toString(), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black)
                IconButton({ change(candle.copy(quantity = candle.quantity + 1)) }) { Icon(Icons.Outlined.Add, "Aumentar") }
            }
        }
    }
}

@Composable
private fun EmptyOperation(title: String, detail: String, icon: androidx.compose.ui.graphics.vector.ImageVector) = Surface(shape = RoundedCornerShape(18.dp), color = AxeCloudThemeTokens.Forest.copy(alpha = .05f)) {
    Column(Modifier.fillMaxWidth().padding(25.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(icon, null, Modifier.size(34.dp), tint = AxeCloudThemeTokens.Forest); Text(title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black); Text(detail, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp) }
}

private fun candleTone(color: String?) = when (color) { "Azul" -> Color(0xFF3E75B5); "Amarela" -> Color(0xFFD5A322); "Verde" -> Color(0xFF39805A); "Vermelha" -> Color(0xFFB84842); "Roxa" -> Color(0xFF77539A); "Rosa" -> Color(0xFFC66A85); "Preta" -> Color(0xFF252525); else -> Color(0xFF9C8B65) }

@Composable
private fun EmptyParticipants() = Surface(shape = RoundedCornerShape(18.dp), color = AxeCloudThemeTokens.Forest.copy(alpha = .05f)) {
    Column(Modifier.fillMaxWidth().padding(25.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Outlined.Groups, null, Modifier.size(34.dp), tint = AxeCloudThemeTokens.Forest)
        Text("Aguardando a corrente", color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black)
        Text("As confirmações aparecerão aqui em tempo real.", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
    }
}

private fun statusOrder(status: String) = when (status) { "pendente" -> 0; "confirmado" -> 1; "presente" -> 2; else -> 3 }
private fun String.brDateOps() = takeIf { Regex("\\d{4}-\\d{2}-\\d{2}").matches(it) }?.let { "${it.takeLast(2)}/${it.substring(5, 7)}/${it.take(4)}" } ?: this

private fun qrBitmap(content: String): Bitmap {
    val matrix = MultiFormatWriter().encode(content, BarcodeFormat.QR_CODE, 480, 480)
    return Bitmap.createBitmap(480, 480, Bitmap.Config.ARGB_8888).also { bitmap ->
        for (x in 0 until 480) for (y in 0 until 480) bitmap.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.rgb(8, 38, 26) else android.graphics.Color.WHITE)
    }
}
