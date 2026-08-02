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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
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
) {
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
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
            when {
                loading -> Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = AxeCloudThemeTokens.Forest) }
                operations == null -> Box(Modifier.fillMaxWidth().weight(1f).padding(28.dp), contentAlignment = Alignment.Center) { Text(error ?: "Não foi possível abrir a operação da gira.", color = AxeCloudThemeTokens.Ink) }
                else -> LazyColumn(
                    Modifier.weight(1f),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 15.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item { PortariaCard(operations.checkinUrl, operations.publicUrl, { clipboard.setText(AnnotatedString(it)) }) { url ->
                        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, url) }, "Compartilhar acesso da gira"))
                    } }
                    item { Text("CORRENTE DA GIRA", color = AxeCloudThemeTokens.GoldStrong, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = .9.sp); Text("Confirmações e pedidos de participação", color = AxeCloudThemeTokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Black) }
                    if (operations.participants.isEmpty()) item { EmptyParticipants() }
                    else items(operations.participants.sortedWith(compareBy<GiraParticipant> { statusOrder(it.status) }.thenBy { it.name }), key = { it.id }) { participant ->
                        ParticipantRow(participant, actionId == participant.id) { onApprove(participant) }
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
