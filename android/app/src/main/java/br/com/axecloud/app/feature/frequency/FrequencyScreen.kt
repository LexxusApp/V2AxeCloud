package br.com.axecloud.app.feature.frequency

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import coil.compose.AsyncImage

@Composable
fun FrequencyRoute(viewModel: FrequencyViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { FrequencyHeader(state.average, state.members.size) }
        item {
            OutlinedTextField(
                state.query, viewModel::query, Modifier.fillMaxWidth(), singleLine = true,
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                placeholder = { Text("Buscar na corrente") }, shape = RoundedCornerShape(18.dp),
            )
        }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = AxeCloudThemeTokens.Forest) } }
            state.error != null -> item {
                Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(state.error ?: "Falha ao carregar", color = AxeCloudThemeTokens.Ink)
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(viewModel::load) { Icon(Icons.Outlined.Refresh, null); Spacer(Modifier.width(6.dp)); Text("Tentar novamente") }
                }
            }
            state.visible.isEmpty() -> item { Text("Nenhum registro de frequência ainda.", Modifier.padding(28.dp), color = AxeCloudThemeTokens.Muted) }
            else -> items(state.visible, key = { it.id }) { FrequencyRow(it) { viewModel.select(it) } }
        }
    }
    state.selected?.let { FrequencyHistorySheet(it) { viewModel.select(null) } }
}

@Composable
private fun FrequencyHeader(average: Int, members: Int) {
    Surface(shape = RoundedCornerShape(26.dp), color = AxeCloudThemeTokens.Forest) {
        Column(Modifier.fillMaxWidth().padding(22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(14.dp), color = AxeCloudThemeTokens.Gold) { Icon(Icons.Outlined.Timeline, null, Modifier.padding(11.dp), tint = AxeCloudThemeTokens.ForestDeep) }
                Spacer(Modifier.width(13.dp))
                Column { Text("PRESENÇA DA CORRENTE", color = AxeCloudThemeTokens.Gold, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp); Text("Frequência", color = AxeCloudThemeTokens.Ivory, fontSize = 27.sp, fontWeight = FontWeight.Black) }
            }
            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HeaderMetric("$average%", "média de assiduidade", Modifier.weight(1f))
                HeaderMetric(members.toString(), "pessoas acompanhadas", Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun HeaderMetric(value: String, label: String, modifier: Modifier) = Surface(modifier, shape = RoundedCornerShape(16.dp), color = Color.White.copy(alpha = .08f)) {
    Column(Modifier.padding(13.dp)) { Text(value, color = AxeCloudThemeTokens.Gold, fontSize = 23.sp, fontWeight = FontWeight.Black); Text(label, color = AxeCloudThemeTokens.Ivory.copy(alpha = .72f), fontSize = 10.sp) }
}

@Composable
private fun FrequencyRow(member: FrequencyMember, open: () -> Unit) {
    val progress by animateFloatAsState(member.attendance / 100f, label = "attendance")
    val accent = when { member.attendance >= 75 -> Color(0xFF27845D); member.attendance >= 50 -> Color(0xFFB47B1A); else -> Color(0xFFB64C45) }
    Surface(Modifier.clickable(onClick = open), shape = RoundedCornerShape(20.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(Modifier.size(48.dp), shape = CircleShape, color = AxeCloudThemeTokens.Forest.copy(alpha = .08f)) {
                    if (member.photoUrl.isNotBlank()) AsyncImage(member.photoUrl, member.name, contentScale = ContentScale.Crop)
                    else Box(contentAlignment = Alignment.Center) { Text(member.name.take(1), fontWeight = FontWeight.Black, color = AxeCloudThemeTokens.Forest) }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) { Text(member.name, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold); Text("${member.present} presenças · ${member.absences} faltas · ${member.totalEvents} giras", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp) }
                Text("${member.attendance}%", color = accent, fontWeight = FontWeight.Black, fontSize = 18.sp)
                Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.Muted, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.height(11.dp))
            LinearProgressIndicator(progress = { progress }, Modifier.fillMaxWidth().height(7.dp), color = accent, trackColor = accent.copy(alpha = .1f), strokeCap = androidx.compose.ui.graphics.StrokeCap.Round)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FrequencyHistorySheet(member: FrequencyMember, dismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = dismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        LazyColumn(contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(Modifier.size(54.dp), shape = CircleShape, color = AxeCloudThemeTokens.Forest.copy(alpha = .1f)) {
                        if (member.photoUrl.isNotBlank()) AsyncImage(member.photoUrl, member.name, contentScale = ContentScale.Crop)
                        else Box(contentAlignment = Alignment.Center) { Text(member.name.take(1), fontSize = 21.sp, fontWeight = FontWeight.Black, color = AxeCloudThemeTokens.Forest) }
                    }
                    Column(Modifier.padding(start = 13.dp).weight(1f)) {
                        Text(member.name, color = AxeCloudThemeTokens.Ink, fontSize = 21.sp, fontWeight = FontWeight.Black)
                        Text("${member.attendance}% de participação · ${member.role}", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
                    }
                }
            }
            item { HorizontalDivider(color = AxeCloudThemeTokens.Outline) }
            item { Text("HISTÓRICO POR GIRA", color = AxeCloudThemeTokens.Forest, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp) }
            if (member.history.isEmpty()) item { Text("Ainda não há giras vinculadas a esta pessoa.", color = AxeCloudThemeTokens.Muted, modifier = Modifier.padding(vertical = 28.dp)) }
            else items(member.history, key = { "${it.id}-${it.date}" }) { FrequencyEventRow(it) }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun FrequencyEventRow(event: FrequencyEvent) {
    val color = when (event.status) { "presente", "confirmado" -> Color(0xFF27845D); "recusado" -> Color(0xFFB64C45); else -> Color(0xFFB47B1A) }
    val label = when (event.status) { "presente" -> "Presente"; "confirmado" -> "Confirmado"; "recusado" -> "Falta justificada"; else -> "Aguardando" }
    Surface(shape = RoundedCornerShape(18.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(Modifier.size(42.dp), shape = RoundedCornerShape(13.dp), color = color.copy(alpha = .11f)) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.CalendarMonth, null, tint = color, modifier = Modifier.size(20.dp)) } }
            Column(Modifier.weight(1f).padding(horizontal = 11.dp)) { Text(event.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, maxLines = 1); Text(listOf(event.date, event.type).filter { it.isNotBlank() }.joinToString(" · "), color = AxeCloudThemeTokens.Muted, fontSize = 10.sp) }
            Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = .12f)) { Text(label, Modifier.padding(horizontal = 9.dp, vertical = 5.dp), color = color, fontSize = 9.sp, fontWeight = FontWeight.Black) }
        }
    }
}
