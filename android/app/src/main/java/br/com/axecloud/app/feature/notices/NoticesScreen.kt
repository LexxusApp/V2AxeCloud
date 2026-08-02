package br.com.axecloud.app.feature.notices

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

@Composable
fun NoticesRoute(viewModel: NoticesViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.message) { state.message?.let { snackbar.showSnackbar(it); viewModel.consumeMessage() } }
    NoticesScreen(state, snackbar, viewModel)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NoticesScreen(state: NoticesUiState, snackbar: SnackbarHostState, viewModel: NoticesViewModel) {
    var deleteCandidate by remember { mutableStateOf<HouseNotice?>(null) }
    Scaffold(
        containerColor = AxeCloudThemeTokens.Canvas,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = { if (!state.isFilho) FloatingActionButton(viewModel::compose, containerColor = AxeCloudThemeTokens.Gold, contentColor = AxeCloudThemeTokens.ForestDeep, shape = RoundedCornerShape(18.dp)) { Icon(Icons.Outlined.Add, "Novo comunicado") } },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { NoticesHeader(state) }
            item { OutlinedTextField(state.query, viewModel::query, Modifier.fillMaxWidth(), singleLine = true, leadingIcon = { Icon(Icons.Outlined.Search, null) }, placeholder = { Text("Buscar comunicados") }, shape = RoundedCornerShape(18.dp)) }
            item { Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf("Todos", "Geral", "Urgente", "Festas", "Doutrina").forEach { FilterChip(state.category == it, { viewModel.category(it) }, label = { Text(it) }) } } }
            when {
                state.loading -> item { Box(Modifier.fillMaxWidth().padding(50.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = AxeCloudThemeTokens.Forest) } }
                state.error != null && state.notices.isEmpty() -> item { ErrorNotice(state.error, viewModel::load) }
                state.visible.isEmpty() -> item { EmptyNotices(state.isFilho, viewModel::compose) }
                else -> items(state.visible, key = { it.id }) { NoticeCard(it, state.actionId == it.id) { viewModel.select(it) } }
            }
            item { Spacer(Modifier.height(80.dp)) }
        }
    }
    state.selected?.let { notice -> NoticeDetailSheet(notice, state.isFilho, { viewModel.select(null) }, { deleteCandidate = notice }) }
    if (state.composing) ComposerSheet(state.publishing, state.error, viewModel::closeComposer, viewModel::publish)
    deleteCandidate?.let { notice -> AlertDialog(
        onDismissRequest = { deleteCandidate = null }, icon = { Icon(Icons.Outlined.WarningAmber, null, tint = MaterialTheme.colorScheme.error) }, title = { Text("Excluir este comunicado?") }, text = { Text(notice.title) },
        confirmButton = { Button(onClick = { deleteCandidate = null; viewModel.delete(notice) }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("Excluir") } },
        dismissButton = { TextButton(onClick = { deleteCandidate = null }) { Text("Cancelar") } },
    ) }
}

@Composable
private fun NoticesHeader(state: NoticesUiState) {
    val urgent = state.notices.count { it.category == "Urgente" }
    Surface(shape = RoundedCornerShape(27.dp), color = AxeCloudThemeTokens.Forest) {
        Column(Modifier.fillMaxWidth().padding(22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(14.dp), color = AxeCloudThemeTokens.Gold) { Icon(Icons.Outlined.Campaign, null, Modifier.padding(11.dp), tint = AxeCloudThemeTokens.ForestDeep) }
                Spacer(Modifier.width(13.dp)); Column { Text("A VOZ OFICIAL DA CASA", color = AxeCloudThemeTokens.Gold, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp); Text(if (state.isFilho) "Mural da casa" else "Comunicados", color = AxeCloudThemeTokens.Ivory, fontSize = 27.sp, fontWeight = FontWeight.Black) }
            }
            Spacer(Modifier.height(19.dp)); Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HeaderNumber(state.notices.size.toString(), "publicados", Modifier.weight(1f)); HeaderNumber(urgent.toString(), "urgentes", Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun HeaderNumber(value: String, label: String, modifier: Modifier) = Surface(modifier, shape = RoundedCornerShape(16.dp), color = Color.White.copy(alpha = .08f)) { Column(Modifier.padding(13.dp)) { Text(value, color = AxeCloudThemeTokens.Gold, fontSize = 23.sp, fontWeight = FontWeight.Black); Text(label, color = AxeCloudThemeTokens.Ivory.copy(alpha = .68f), fontSize = 10.sp) } }

@Composable
private fun NoticeCard(notice: HouseNotice, busy: Boolean, click: () -> Unit) {
    val accent = notice.category.categoryColor()
    Surface(Modifier.fillMaxWidth().clickable(onClick = click), shape = RoundedCornerShape(21.dp), color = Color.White, border = BorderStroke(1.dp, if (notice.category == "Urgente") accent.copy(alpha = .35f) else AxeCloudThemeTokens.Outline)) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.Top) {
            Surface(shape = RoundedCornerShape(14.dp), color = accent.copy(alpha = .1f)) { Icon(Icons.Outlined.Campaign, null, Modifier.padding(10.dp).size(21.dp), tint = accent) }
            Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) { Text(notice.category.uppercase(), color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = .8.sp); Spacer(Modifier.weight(1f)); Text(notice.publishedAt.dateLabel(), color = AxeCloudThemeTokens.Muted, fontSize = 10.sp) }
                Spacer(Modifier.height(4.dp)); Text(notice.title, color = AxeCloudThemeTokens.Ink, fontSize = 17.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(5.dp)); Text(notice.content, color = AxeCloudThemeTokens.Muted, fontSize = 12.sp, lineHeight = 17.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NoticeDetailSheet(notice: HouseNotice, isFilho: Boolean, dismiss: () -> Unit, delete: () -> Unit) {
    val context = LocalContext.current
    val share = {
        val text = "📢 ${notice.title}\n\n${notice.content}\n\nAxéCloud"
        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }, "Compartilhar comunicado"))
    }
    ModalBottomSheet(onDismissRequest = dismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        Column(Modifier.navigationBarsPadding().padding(horizontal = 22.dp).padding(bottom = 24.dp)) {
            Text(notice.category.uppercase(), color = notice.category.categoryColor(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Spacer(Modifier.height(5.dp)); Text(notice.title, color = AxeCloudThemeTokens.Ink, fontSize = 24.sp, lineHeight = 28.sp, fontWeight = FontWeight.Black)
            Text("Publicado ${notice.publishedAt.dateLabel()}", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
            Spacer(Modifier.height(18.dp)); HorizontalDivider(color = AxeCloudThemeTokens.Outline); Spacer(Modifier.height(18.dp))
            Text(notice.content, color = AxeCloudThemeTokens.Ink, fontSize = 15.sp, lineHeight = 23.sp)
            Spacer(Modifier.height(23.dp)); Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (!isFilho) OutlinedButton(delete, Modifier.weight(1f)) { Icon(Icons.Outlined.DeleteOutline, null); Spacer(Modifier.width(6.dp)); Text("Excluir") }
                Button(onClick = share, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Icon(Icons.Outlined.Share, null); Spacer(Modifier.width(6.dp)); Text("Compartilhar") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ComposerSheet(publishing: Boolean, error: String?, dismiss: () -> Unit, publish: (NoticeForm) -> Unit) {
    var form by rememberSaveable { mutableStateOf(NoticeForm()) }
    ModalBottomSheet(onDismissRequest = dismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 22.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { Text("Novo comunicado", color = AxeCloudThemeTokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Black); Text("Escreva com clareza. O app avisa a corrente.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp) }
            item { OutlinedTextField(form.title, { form = form.copy(title = it) }, Modifier.fillMaxWidth(), label = { Text("Título") }, singleLine = true, shape = RoundedCornerShape(15.dp)) }
            item { OutlinedTextField(form.content, { form = form.copy(content = it) }, Modifier.fillMaxWidth(), label = { Text("Mensagem") }, minLines = 5, shape = RoundedCornerShape(15.dp)) }
            item { Text("Categoria", color = AxeCloudThemeTokens.Muted, fontWeight = FontWeight.Bold, fontSize = 12.sp); Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf("Geral", "Urgente", "Festas", "Doutrina").forEach { FilterChip(form.category == it, { form = form.copy(category = it) }, label = { Text(it) }) } } }
            item { OutlinedTextField(form.expiresAt, { form = form.copy(expiresAt = it) }, Modifier.fillMaxWidth(), label = { Text("Expira em (opcional)") }, placeholder = { Text("AAAA-MM-DD") }, singleLine = true, shape = RoundedCornerShape(15.dp)) }
            if (error != null) item { Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            item { Button(onClick = { publish(form) }, Modifier.fillMaxWidth().height(54.dp), enabled = !publishing && form.title.isNotBlank() && form.content.isNotBlank(), shape = RoundedCornerShape(17.dp), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { if (publishing) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp) else { Icon(Icons.Outlined.Send, null); Spacer(Modifier.width(7.dp)); Text("Publicar para a corrente", fontWeight = FontWeight.Bold) } }; Spacer(Modifier.height(28.dp)) }
        }
    }
}

@Composable private fun ErrorNotice(message: String, retry: () -> Unit) = Column(Modifier.fillMaxWidth().padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(message, color = AxeCloudThemeTokens.Ink); Spacer(Modifier.height(10.dp)); OutlinedButton(retry) { Icon(Icons.Outlined.Refresh, null); Spacer(Modifier.width(6.dp)); Text("Tentar novamente") } }
@Composable private fun EmptyNotices(filho: Boolean, create: () -> Unit) = Surface(shape = RoundedCornerShape(22.dp), color = AxeCloudThemeTokens.Forest.copy(alpha = .06f), border = BorderStroke(1.dp, AxeCloudThemeTokens.Forest.copy(alpha = .14f))) { Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Outlined.Campaign, null, Modifier.size(36.dp), tint = AxeCloudThemeTokens.Forest); Spacer(Modifier.height(9.dp)); Text("O mural está em silêncio", color = AxeCloudThemeTokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Black); Text(if (filho) "Os recados da casa aparecerão aqui." else "Publique o primeiro recado para a corrente.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp); if (!filho) { Spacer(Modifier.height(13.dp)); Button(create, colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Icon(Icons.Outlined.Add, null); Spacer(Modifier.width(6.dp)); Text("Novo comunicado") } } } }

private fun String.categoryColor() = when (this) { "Urgente" -> Color(0xFFB5443F); "Festas" -> Color(0xFFC17D18); "Doutrina" -> Color(0xFF416BA3); else -> Color(0xFF4F6D5A) }
private fun String.dateLabel(): String { val date = take(10); return if (Regex("\\d{4}-\\d{2}-\\d{2}").matches(date)) "${date.takeLast(2)}/${date.substring(5, 7)}/${date.take(4)}" else date }
