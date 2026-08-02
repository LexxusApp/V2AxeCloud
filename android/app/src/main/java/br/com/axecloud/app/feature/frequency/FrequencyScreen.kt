package br.com.axecloud.app.feature.frequency

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Timeline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 18.dp),
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
                    Spacer(Modifier.height(12.dp)); OutlinedButton(viewModel::load) { Icon(Icons.Outlined.Refresh, null); Spacer(Modifier.width(6.dp)); Text("Tentar novamente") }
                }
            }
            state.visible.isEmpty() -> item { Text("Nenhum registro de frequência ainda.", Modifier.padding(28.dp), color = AxeCloudThemeTokens.Muted) }
            else -> items(state.visible, key = { it.id }) { FrequencyRow(it) }
        }
    }
}

@Composable
private fun FrequencyHeader(average: Int, members: Int) {
    Surface(shape = RoundedCornerShape(26.dp), color = AxeCloudThemeTokens.Forest) {
        Column(Modifier.fillMaxWidth().padding(22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(14.dp), color = AxeCloudThemeTokens.Gold) { Icon(Icons.Outlined.Timeline, null, Modifier.padding(11.dp), tint = AxeCloudThemeTokens.ForestDeep) }
                Spacer(Modifier.width(13.dp)); Column { Text("PRESENÇA DA CORRENTE", color = AxeCloudThemeTokens.Gold, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp); Text("Frequência", color = AxeCloudThemeTokens.Ivory, fontSize = 27.sp, fontWeight = FontWeight.Black) }
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
private fun FrequencyRow(member: FrequencyMember) {
    val progress by animateFloatAsState(member.attendance / 100f, label = "attendance")
    val accent = when { member.attendance >= 75 -> Color(0xFF27845D); member.attendance >= 50 -> Color(0xFFB47B1A); else -> Color(0xFFB64C45) }
    Surface(shape = RoundedCornerShape(20.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(Modifier.size(48.dp), shape = CircleShape, color = AxeCloudThemeTokens.Forest.copy(alpha = .08f)) {
                    if (member.photoUrl.isNotBlank()) AsyncImage(member.photoUrl, member.name, contentScale = ContentScale.Crop)
                    else Box(contentAlignment = Alignment.Center) { Text(member.name.take(1), fontWeight = FontWeight.Black, color = AxeCloudThemeTokens.Forest) }
                }
                Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(member.name, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold); Text("${member.present} presenças · ${member.absences} faltas · ${member.totalEvents} giras", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp) }
                Text("${member.attendance}%", color = accent, fontWeight = FontWeight.Black, fontSize = 18.sp)
            }
            Spacer(Modifier.height(11.dp))
            androidx.compose.material3.LinearProgressIndicator(progress = { progress }, Modifier.fillMaxWidth().height(7.dp), color = accent, trackColor = accent.copy(alpha = .1f), strokeCap = androidx.compose.ui.graphics.StrokeCap.Round)
        }
    }
}
