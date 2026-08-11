package br.com.axecloud.app.feature.giras

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.EventAvailable
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Schedule
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
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import coil.compose.AsyncImage

@Composable
fun GirasRoute(viewModel: GirasViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.message) { state.message?.let { snackbar.showSnackbar(it); viewModel.consumeMessage() } }
    GirasScreen(state, snackbar, viewModel)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GirasScreen(state: GirasUiState, snackbar: SnackbarHostState, viewModel: GirasViewModel) {
    var deleteCandidate by remember { mutableStateOf<GiraEvent?>(null) }
    Scaffold(
        containerColor = AxeCloudThemeTokens.Canvas,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            if (!state.isFilho) FloatingActionButton(viewModel::create, containerColor = AxeCloudThemeTokens.Gold, contentColor = AxeCloudThemeTokens.ForestDeep, shape = RoundedCornerShape(18.dp)) { Icon(Icons.Outlined.Add, "Criar gira") }
        },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { GirasHeader(state) }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GiraFilter.entries.forEach { filter -> FilterChip(
                        selected = state.filter == filter, onClick = { viewModel.filter(filter) },
                        label = { Text(when (filter) { GiraFilter.UPCOMING -> "Próximas"; GiraFilter.ALL -> "Todas"; GiraFilter.PAST -> "Realizadas" }) },
                    ) }
                }
            }
            when {
                state.loading -> item { Box(Modifier.fillMaxWidth().padding(50.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = AxeCloudThemeTokens.Forest) } }
                state.error != null && state.events.isEmpty() -> item { ErrorCard(state.error, viewModel::load) }
                state.visible.isEmpty() -> item { EmptyAgenda(state.isFilho, viewModel::create) }
                else -> items(state.visible, key = { it.id }) { event -> GiraCard(event, state.actionId == event.id) { viewModel.select(event) } }
            }
            item { Spacer(Modifier.height(80.dp)) }
        }
    }
    state.selected?.let { event ->
        GiraDetailSheet(event, state.isFilho, state.actionId == event.id, { viewModel.select(null) }, { viewModel.edit(event) }, { deleteCandidate = event }, { viewModel.respond(event, it) }, { viewModel.notify(event) }, { viewModel.openOperations(event) })
    }
    state.operationsEvent?.let { event -> GiraOperationsSheet(
        event = event, operations = state.operations, loading = state.loadingOperations,
        actionId = state.actionId, error = state.error, onDismiss = viewModel::closeOperations,
        onApprove = viewModel::approve,
        onIssueTicket = viewModel::issueTicket, onUpdateTicket = viewModel::updateTicket, onSaveCandles = viewModel::saveCandles,
    ) }
    if (state.creating || state.editing != null) GiraEditorSheet(state.editing, state.actionId == "save", state.error, viewModel::closeEditor, viewModel::save)
    deleteCandidate?.let { event -> AlertDialog(
        onDismissRequest = { deleteCandidate = null }, icon = { Icon(Icons.Outlined.WarningAmber, null, tint = MaterialTheme.colorScheme.error) },
        title = { Text("Excluir ${event.title}?") }, text = { Text("A gira, as confirmações e os vínculos de presença serão removidos.") },
        confirmButton = { Button(onClick = { deleteCandidate = null; viewModel.delete(event) }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("Excluir gira") } },
        dismissButton = { TextButton(onClick = { deleteCandidate = null }) { Text("Cancelar") } },
    ) }
}

@Composable
private fun GirasHeader(state: GirasUiState) {
    val next = state.events.filter { it.date >= java.time.LocalDate.now().toString() }.minByOrNull { it.date + it.time }
    Surface(shape = RoundedCornerShape(27.dp), color = AxeCloudThemeTokens.Forest) {
        Column(Modifier.fillMaxWidth().padding(22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(14.dp), color = AxeCloudThemeTokens.Gold) { Icon(Icons.Outlined.EventAvailable, null, Modifier.padding(11.dp), tint = AxeCloudThemeTokens.ForestDeep) }
                Spacer(Modifier.width(13.dp)); Column { Text("MOVIMENTOS DA CASA", color = AxeCloudThemeTokens.Gold, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp); Text(if (state.isFilho) "Minha agenda" else "Giras", color = AxeCloudThemeTokens.Ivory, fontSize = 27.sp, fontWeight = FontWeight.Black) }
            }
            Spacer(Modifier.height(20.dp))
            Surface(shape = RoundedCornerShape(17.dp), color = Color.White.copy(alpha = .08f), border = BorderStroke(1.dp, Color.White.copy(alpha = .08f))) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.CalendarMonth, null, tint = AxeCloudThemeTokens.Gold); Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f)) { Text("PRÓXIMO MOVIMENTO", color = AxeCloudThemeTokens.Ivory.copy(alpha = .6f), fontSize = 9.sp, fontWeight = FontWeight.Bold); Text(next?.title ?: "Agenda livre", color = AxeCloudThemeTokens.Ivory, fontWeight = FontWeight.Black); if (next != null) Text("${next.date.brDate()} · ${next.time}", color = AxeCloudThemeTokens.Ivory.copy(alpha = .7f), fontSize = 11.sp) }
                    Text(state.events.size.toString(), color = AxeCloudThemeTokens.Gold, fontSize = 24.sp, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
private fun GiraCard(event: GiraEvent, busy: Boolean, onClick: () -> Unit) {
    val passed = event.date < java.time.LocalDate.now().toString()
    Surface(Modifier.fillMaxWidth().clickable(onClick = onClick), shape = RoundedCornerShape(21.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline), shadowElevation = 1.dp) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = RoundedCornerShape(16.dp), color = if (passed) Color(0xFFECE9E2) else AxeCloudThemeTokens.Gold.copy(alpha = .18f)) {
                Column(Modifier.size(60.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Text(event.date.takeLast(2), color = AxeCloudThemeTokens.Forest, fontSize = 23.sp, fontWeight = FontWeight.Black)
                    Text(event.date.monthLabel(), color = AxeCloudThemeTokens.Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.width(13.dp)); Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) { Text(event.title, Modifier.weight(1f), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis); if (event.participantStatus.isNotBlank()) ParticipationPill(event.participantStatus) }
                Text("${event.time} · ${event.type}", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
                if (event.confirmedCount > 0) { Spacer(Modifier.height(6.dp)); Text("${event.confirmedCount} confirmado(s)", color = Color(0xFF247C58), fontSize = 11.sp, fontWeight = FontWeight.Bold) }
            }
            if (busy) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp) else Icon(Icons.Outlined.Schedule, null, tint = AxeCloudThemeTokens.Forest.copy(alpha = .55f))
        }
    }
}

@Composable
private fun ParticipationPill(status: String) {
    val color = when (status) { "confirmado", "presente" -> Color(0xFF198754); "recusado" -> Color(0xFFB44943); else -> Color(0xFFB27A1F) }
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = .1f)) { Text(status.replaceFirstChar(Char::uppercase), Modifier.padding(horizontal = 8.dp, vertical = 3.dp), color = color, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GiraDetailSheet(event: GiraEvent, isFilho: Boolean, busy: Boolean, dismiss: () -> Unit, edit: () -> Unit, delete: () -> Unit, respond: (Boolean) -> Unit, notify: () -> Unit, operations: () -> Unit) {
    ModalBottomSheet(onDismissRequest = dismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        Column(Modifier.navigationBarsPadding().padding(horizontal = 22.dp).padding(bottom = 24.dp)) {
            if (event.bannerUrl.isNotBlank()) AsyncImage(event.bannerUrl, event.title, Modifier.fillMaxWidth().height(150.dp).background(AxeCloudThemeTokens.Forest, RoundedCornerShape(20.dp)), contentScale = ContentScale.Crop)
            Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text(event.type.uppercase(), color = AxeCloudThemeTokens.GoldStrong, fontSize = 10.sp, fontWeight = FontWeight.Black); Text(event.title, color = AxeCloudThemeTokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Black) }
                if (!isFilho) IconButton(edit) { Icon(Icons.Outlined.Edit, "Editar") }
            }
            Text("${event.date.brDate()} às ${event.time}", color = AxeCloudThemeTokens.Forest, fontWeight = FontWeight.Bold)
            if (event.description.isNotBlank()) { Spacer(Modifier.height(13.dp)); Text(event.description, color = AxeCloudThemeTokens.Muted, lineHeight = 20.sp) }
            Spacer(Modifier.height(16.dp)); HorizontalDivider(color = AxeCloudThemeTokens.Outline); Spacer(Modifier.height(14.dp))
            if (isFilho) {
                Text("Você vai participar?", color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(10.dp)); Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = { respond(false) }, Modifier.weight(1f), enabled = !busy) { Icon(Icons.Outlined.Close, null); Spacer(Modifier.width(5.dp)); Text("Não poderei") }
                    Button(onClick = { respond(true) }, Modifier.weight(1f), enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Icon(Icons.Outlined.Check, null); Spacer(Modifier.width(5.dp)); Text("Confirmar") }
                }
            } else {
                Button(operations, Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Gold, contentColor = AxeCloudThemeTokens.ForestDeep)) {
                    Icon(Icons.Outlined.Groups, null); Spacer(Modifier.width(6.dp)); Text("Abrir central da gira", fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(9.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    OutlinedButton(delete, Modifier.weight(1f)) { Icon(Icons.Outlined.DeleteOutline, null); Spacer(Modifier.width(5.dp)); Text("Excluir") }
                    OutlinedButton(notify, Modifier.weight(1f), enabled = !busy) { Icon(Icons.Outlined.NotificationsActive, null); Spacer(Modifier.width(5.dp)); Text("Lembrar") }
                    Button(edit, Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Icon(Icons.Outlined.Edit, null); Spacer(Modifier.width(5.dp)); Text("Editar") }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GiraEditorSheet(event: GiraEvent?, saving: Boolean, error: String?, dismiss: () -> Unit, save: (GiraForm) -> Unit) {
    var form by rememberSaveable(event?.id) { mutableStateOf(event?.let(GiraForm::from) ?: GiraForm(date = java.time.LocalDate.now().plusDays(7).toString())) }
    ModalBottomSheet(onDismissRequest = dismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 22.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            item { Text(if (event == null) "Criar nova gira" else "Editar gira", color = AxeCloudThemeTokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Black) }
            item { GiraField("Nome da gira", form.title) { form = form.copy(title = it) } }
            item { Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) { Box(Modifier.weight(1f)) { GiraField("Data", form.date, "AAAA-MM-DD") { form = form.copy(date = it) } }; Box(Modifier.weight(1f)) { GiraField("Horário", form.time, "HH:MM") { form = form.copy(time = it) } } } }
            item { GiraField("Tipo", form.type) { form = form.copy(type = it) } }
            item { GiraField("Descrição", form.description) { form = form.copy(description = it) } }
            item { ToggleLine("Evento público", "Permite divulgar a gira fora da corrente.", form.isPublic) { form = form.copy(isPublic = it) } }
            item { ToggleLine("Senhas para visitantes", "Organiza o acolhimento na portaria.", form.ticketsEnabled) { form = form.copy(ticketsEnabled = it) } }
            if (form.ticketsEnabled) item { GiraField("Limite de senhas", form.maxTickets, "Sem limite") { form = form.copy(maxTickets = it) } }
            item { GiraField("Limite de participantes", form.maxGuests, "Sem limite") { form = form.copy(maxGuests = it) } }
            if (error != null) item { Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            item { Button(onClick = { save(form) }, Modifier.fillMaxWidth().height(54.dp), enabled = !saving && form.title.isNotBlank(), shape = RoundedCornerShape(17.dp), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { if (saving) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp) else { Icon(Icons.Outlined.EventAvailable, null); Spacer(Modifier.width(7.dp)); Text("Salvar na agenda", fontWeight = FontWeight.Bold) } }; Spacer(Modifier.height(28.dp)) }
        }
    }
}

@Composable
private fun GiraField(label: String, value: String, placeholder: String = "", change: (String) -> Unit) = OutlinedTextField(value, change, Modifier.fillMaxWidth(), label = { Text(label) }, placeholder = { Text(placeholder) }, singleLine = label != "Descrição", minLines = if (label == "Descrição") 3 else 1, shape = RoundedCornerShape(15.dp))

@Composable
private fun ToggleLine(title: String, detail: String, checked: Boolean, change: (Boolean) -> Unit) = Surface(shape = RoundedCornerShape(17.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
    Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text(title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold); Text(detail, color = AxeCloudThemeTokens.Muted, fontSize = 10.sp) }; Switch(checked, change) }
}

@Composable
private fun ErrorCard(message: String, retry: () -> Unit) = Column(Modifier.fillMaxWidth().padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(message, color = AxeCloudThemeTokens.Ink); Spacer(Modifier.height(10.dp)); OutlinedButton(retry) { Icon(Icons.Outlined.Refresh, null); Spacer(Modifier.width(6.dp)); Text("Tentar novamente") } }

@Composable
private fun EmptyAgenda(isFilho: Boolean, create: () -> Unit) = Surface(shape = RoundedCornerShape(22.dp), color = AxeCloudThemeTokens.Forest.copy(alpha = .06f), border = BorderStroke(1.dp, AxeCloudThemeTokens.Forest.copy(alpha = .14f))) {
    Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(36.dp), tint = AxeCloudThemeTokens.Forest); Spacer(Modifier.height(9.dp)); Text("A agenda está livre", color = AxeCloudThemeTokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Black); Text(if (isFilho) "Quando a casa marcar uma gira, ela aparecerá aqui." else "Comece organizando o próximo movimento da casa.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp); if (!isFilho) { Spacer(Modifier.height(13.dp)); Button(create, colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Icon(Icons.Outlined.Add, null); Spacer(Modifier.width(6.dp)); Text("Criar primeira gira") } } }
}

private fun String.brDate() = takeIf { Regex("\\d{4}-\\d{2}-\\d{2}").matches(it) }?.let { "${it.takeLast(2)}/${it.substring(5, 7)}/${it.take(4)}" } ?: this
private fun String.monthLabel() = when (substring(5, 7)) { "01" -> "JAN"; "02" -> "FEV"; "03" -> "MAR"; "04" -> "ABR"; "05" -> "MAI"; "06" -> "JUN"; "07" -> "JUL"; "08" -> "AGO"; "09" -> "SET"; "10" -> "OUT"; "11" -> "NOV"; "12" -> "DEZ"; else -> "" }
