package br.com.axecloud.app.feature.precepts

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

private val PreceptWine = Color(0xFF5A2937)
private val PreceptGold = Color(0xFFE6BC4C)
private val PreceptGreen = Color(0xFF174633)
private val PreceptPaper = Color(0xFFFFF9EE)

@Composable
fun PreceptRoute(viewModel: PreceptViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.message) { state.message?.let { snackbar.showSnackbar(it); viewModel.consume() } }
    PreceptScreen(state, snackbar, viewModel)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PreceptScreen(state: PreceptUiState, snackbar: SnackbarHostState, viewModel: PreceptViewModel) {
    Scaffold(
        containerColor = AxeCloudThemeTokens.Canvas,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { viewModel.editor(true) },
                containerColor = PreceptGold,
                contentColor = PreceptWine,
            ) { Icon(Icons.Outlined.LocalFireDepartment, null); Spacer(Modifier.width(7.dp)); Text("Novo ciclo", fontWeight = FontWeight.Bold) }
        },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(horizontal = 17.dp, vertical = 15.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { PreceptHero(state) }
            item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("ativos" to "Ativos", "rascunhos" to "Rascunhos", "encerrados" to "Histórico", "todos" to "Todos").forEach { (key, label) ->
                        FilterChip(selected = state.filter == key, onClick = { viewModel.filter(key) }, label = { Text(label) })
                    }
                }
            }
            state.error?.let { item { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) } }
            when {
                state.loading -> item { Box(Modifier.fillMaxWidth().padding(55.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = PreceptWine) } }
                state.visible.isEmpty() -> item { EmptyPrecepts(state.filter) { viewModel.editor(true) } }
                else -> items(state.visible, key = { it.id }) { cycle -> PreceptCard(cycle, state.actionId == cycle.id) { viewModel.openDetail(cycle.id) } }
            }
            item { Spacer(Modifier.height(80.dp)) }
        }
    }
    if (state.editorOpen) PreceptEditor(state, viewModel)
    state.detail?.let { PreceptDetail(it, state.saving, viewModel) }
}

@Composable
private fun PreceptHero(state: PreceptUiState) = Surface(shape = RoundedCornerShape(31.dp), color = PreceptWine, shadowElevation = 9.dp) {
    Box(Modifier.background(Brush.linearGradient(listOf(PreceptWine, Color(0xFF301B28))))) {
        Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(49.dp).background(PreceptGold, RoundedCornerShape(17.dp)), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.LocalFireDepartment, null, tint = PreceptWine) }
                Column(Modifier.padding(start = 12.dp)) {
                    Text("CUIDADO COLETIVO", color = PreceptGold, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    Text("Preceitos da casa", color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Black)
                }
            }
            Text("Oriente a corrente com clareza, acompanhe a ciência e acolha quem precisa conversar.", color = Color.White.copy(.72f), fontSize = 12.sp, lineHeight = 18.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HeroMetric(state.cycles.count { it.status == "ativo" }.toString(), "ativos", Modifier.weight(1f))
                HeroMetric(state.cycles.sumOf { it.counts.pending }.toString(), "aguardando", Modifier.weight(1f))
                HeroMetric(state.cycles.sumOf { it.counts.guidance }.toString(), "orientações", Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun HeroMetric(value: String, label: String, modifier: Modifier) = Surface(modifier, shape = RoundedCornerShape(15.dp), color = Color.White.copy(.08f)) {
    Column(Modifier.padding(11.dp)) { Text(value, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black); Text(label, color = Color.White.copy(.6f), fontSize = 9.sp) }
}

@Composable
private fun PreceptCard(cycle: PreceptCycle, busy: Boolean, open: () -> Unit) = Surface(
    Modifier.fillMaxWidth().clickable(onClick = open),
    shape = RoundedCornerShape(23.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline),
) {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(45.dp).background(statusColor(cycle.status).copy(.14f), RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) {
                if (busy) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = PreceptWine) else Icon(Icons.Outlined.SelfImprovement, null, tint = statusColor(cycle.status))
            }
            Column(Modifier.weight(1f).padding(horizontal = 11.dp)) {
                Text(cycle.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${audienceLabel(cycle.audience)} · ${dateLabel(cycle.startsAt)} até ${dateLabel(cycle.endsAt)}", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp)
            }
            AssistChip(onClick = open, label = { Text(statusLabel(cycle.status), fontSize = 9.sp) })
        }
        if (cycle.status == "ativo" && cycle.counts.total > 0) {
            LinearProgressIndicator(
                progress = { cycle.counts.aware.toFloat() / cycle.counts.total.coerceAtLeast(1) },
                modifier = Modifier.fillMaxWidth().height(7.dp), color = PreceptGreen, trackColor = Color(0xFFE9E3D8),
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${cycle.counts.aware} cientes de ${cycle.counts.total}", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp)
                if (cycle.counts.guidance > 0) Text("${cycle.counts.guidance} pediram orientação", color = PreceptWine, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun EmptyPrecepts(filter: String, create: () -> Unit) = Surface(shape = RoundedCornerShape(24.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
    Column(Modifier.fillMaxWidth().padding(36.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Outlined.SelfImprovement, null, Modifier.size(44.dp), tint = PreceptWine)
        Text(if (filter == "ativos") "A corrente está sem ciclo ativo" else "Nada por aqui ainda", color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 10.dp))
        Text("Crie uma orientação, escolha quem participa e acompanhe tudo pelo aplicativo.", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp))
        Button(create, Modifier.padding(top = 15.dp), colors = ButtonDefaults.buttonColors(containerColor = PreceptWine)) { Text("Criar primeiro ciclo") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PreceptEditor(state: PreceptUiState, viewModel: PreceptViewModel) {
    val form = state.form
    ModalBottomSheet(onDismissRequest = { viewModel.editor(false) }, containerColor = PreceptPaper) {
        Column(Modifier.navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Novo ciclo de preceito", color = PreceptWine, fontSize = 25.sp, fontWeight = FontWeight.Black)
            Text("A orientação chega somente às pessoas escolhidas.", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
            Input(form.title, { viewModel.form(form.copy(title = it)) }, "Nome do ciclo")
            Input(form.reason, { viewModel.form(form.copy(reason = it)) }, "Motivo ou contexto")
            Input(form.instructions, { viewModel.form(form.copy(instructions = it)) }, "Orientações", 4)
            Text("Quem participa", fontWeight = FontWeight.Black, color = AxeCloudThemeTokens.Ink)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("corrente" to "Toda a corrente", "cargo" to "Por função", "individual" to "Pessoas específicas").forEach { (key, label) ->
                    FilterChip(form.audience == key, { viewModel.form(form.copy(audience = key, targetRoles = emptySet(), targetChildren = emptySet())) }, label = { Text(label) })
                }
            }
            AnimatedContent(form.audience, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "audience") { audience ->
                when (audience) {
                    "cargo" -> SelectionStrings(state.roles, form.targetRoles) { value -> viewModel.form(form.copy(targetRoles = form.targetRoles.toggle(value))) }
                    "individual" -> SelectionWrap(state.children.filter { it.active }.map { it.id to "${it.name}${it.role.takeIf(String::isNotBlank)?.let { role -> " · $role" } ?: ""}" }, form.targetChildren) { id -> viewModel.form(form.copy(targetChildren = form.targetChildren.toggle(id))) }
                    else -> ExclusionList(state.children.filter { it.active }, form.excludedChildren) { id -> viewModel.form(form.copy(excludedChildren = form.excludedChildren.toggle(id))) }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DateField("Início", form.startDate, Modifier.weight(1f)) { viewModel.form(form.copy(startDate = it)) }
                DateField("Término", form.endDate, Modifier.weight(1f)) { viewModel.form(form.copy(endDate = it)) }
            }
            if (state.foundations.isNotEmpty()) {
                Text("Vincular fundamento (opcional)", fontWeight = FontWeight.Black, color = AxeCloudThemeTokens.Ink)
                SelectionWrap(listOf("" to "Nenhum") + state.foundations.map { it.id to it.title }, setOf(form.foundationId)) { id -> viewModel.form(form.copy(foundationId = id)) }
            }
            Surface(shape = RoundedCornerShape(18.dp), color = Color.White) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.NotificationsActive, null, tint = PreceptWine)
                    Column(Modifier.weight(1f).padding(horizontal = 10.dp)) { Text("Publicar agora", fontWeight = FontWeight.Bold); Text("Participantes recebem o ciclo imediatamente.", color = AxeCloudThemeTokens.Muted, fontSize = 9.sp) }
                    Switch(form.publishNow, { viewModel.form(form.copy(publishNow = it)) })
                }
            }
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            Button(viewModel::save, Modifier.fillMaxWidth().height(54.dp), enabled = !state.saving, colors = ButtonDefaults.buttonColors(containerColor = PreceptWine)) {
                if (state.saving) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Color.White) else Text(if (form.publishNow) "Ativar para a corrente" else "Salvar rascunho", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PreceptDetail(cycle: PreceptCycle, busy: Boolean, viewModel: PreceptViewModel) {
    ModalBottomSheet(onDismissRequest = viewModel::closeDetail, containerColor = PreceptPaper) {
        LazyColumn(Modifier.navigationBarsPadding(), contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(50.dp).background(PreceptGold, RoundedCornerShape(17.dp)), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.SelfImprovement, null, tint = PreceptWine) }
                    Column(Modifier.weight(1f).padding(start = 12.dp)) { Text(cycle.title, color = PreceptWine, fontSize = 23.sp, fontWeight = FontWeight.Black); Text("${audienceLabel(cycle.audience)} · ${statusLabel(cycle.status)}", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp) }
                }
            }
            if (cycle.reason.isNotBlank()) item { DetailBlock("POR QUE ESTE CICLO", cycle.reason) }
            item { DetailBlock("ORIENTAÇÕES", cycle.instructions.ifBlank { "Orientações não informadas." }) }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    DetailMetric(cycle.counts.pending.toString(), "pendentes", Modifier.weight(1f))
                    DetailMetric(cycle.counts.aware.toString(), "cientes", Modifier.weight(1f))
                    DetailMetric(cycle.counts.guidance.toString(), "orientação", Modifier.weight(1f))
                }
            }
            if (cycle.participants.isNotEmpty()) {
                item { Text("CORRENTE NESTE CICLO", color = PreceptWine, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp) }
                items(cycle.participants, key = { it.id }) { participant -> ParticipantRow(cycle, participant, busy, viewModel) }
            }
            if (cycle.status == "rascunho") item {
                Button({ viewModel.status(cycle, "ativo") }, Modifier.fillMaxWidth().height(52.dp), enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = PreceptGreen)) {
                    Icon(Icons.Outlined.NotificationsActive, null); Spacer(Modifier.width(7.dp)); Text("Ativar agora", fontWeight = FontWeight.Bold)
                }
            }
            if (cycle.status == "ativo") item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton({ viewModel.status(cycle, "cancelado") }, Modifier.weight(1f), enabled = !busy) { Text("Cancelar") }
                    Button({ viewModel.status(cycle, "encerrado") }, Modifier.weight(1f), enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = PreceptGreen)) { Text("Encerrar ciclo") }
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun ParticipantRow(cycle: PreceptCycle, participant: PreceptParticipant, busy: Boolean, viewModel: PreceptViewModel) = Surface(shape = RoundedCornerShape(18.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
    Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(38.dp).background(statusColor(participant.status).copy(.13f), CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Person, null, tint = statusColor(participant.status)) }
        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) { Text(participant.name, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold); Text("${participant.role.ifBlank { "Corrente" }} · ${participantLabel(participant.status)}", color = AxeCloudThemeTokens.Muted, fontSize = 9.sp) }
        if (cycle.status == "ativo") {
            if (participant.status == "dispensado") TextButton({ viewModel.participant(cycle.id, participant, "pendente") }, enabled = !busy) { Text("Reintegrar") }
            else TextButton({ viewModel.participant(cycle.id, participant, "dispensado") }, enabled = !busy) { Text("Dispensar") }
        }
    }
}

@Composable private fun DetailBlock(label: String, value: String) = Surface(shape = RoundedCornerShape(18.dp), color = Color.White) { Column(Modifier.padding(15.dp)) { Text(label, color = PreceptWine, fontSize = 9.sp, fontWeight = FontWeight.Black); Text(value, color = AxeCloudThemeTokens.Ink, fontSize = 13.sp, lineHeight = 20.sp, modifier = Modifier.padding(top = 5.dp)) } }
@Composable private fun DetailMetric(value: String, label: String, modifier: Modifier) = Surface(modifier, shape = RoundedCornerShape(16.dp), color = Color.White) { Column(Modifier.padding(12.dp)) { Text(value, color = PreceptWine, fontSize = 20.sp, fontWeight = FontWeight.Black); Text(label, color = AxeCloudThemeTokens.Muted, fontSize = 9.sp) } }

@Composable private fun Input(value: String, change: (String) -> Unit, label: String, lines: Int = 1) = OutlinedTextField(value, change, Modifier.fillMaxWidth(), label = { Text(label) }, minLines = lines, maxLines = if (lines == 1) 1 else 7, shape = RoundedCornerShape(16.dp))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateField(label: String, value: String, modifier: Modifier, change: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    OutlinedTextField(value, {}, modifier.clickable { open = true }, readOnly = true, enabled = false, label = { Text(label) }, trailingIcon = { Icon(Icons.Outlined.CalendarMonth, null) }, colors = OutlinedTextFieldDefaults.colors(disabledTextColor = AxeCloudThemeTokens.Ink, disabledBorderColor = AxeCloudThemeTokens.Outline, disabledLabelColor = AxeCloudThemeTokens.Muted, disabledTrailingIconColor = PreceptWine), shape = RoundedCornerShape(16.dp))
    if (open) {
        val initial = runCatching { LocalDate.parse(value).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli() }.getOrNull()
        val picker = rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(onDismissRequest = { open = false }, confirmButton = { TextButton({ picker.selectedDateMillis?.let { change(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()) }; open = false }) { Text("Confirmar") } }, dismissButton = { TextButton({ open = false }) { Text("Cancelar") } }) { DatePicker(picker) }
    }
}

@Composable private fun SelectionStrings(items: List<String>, selected: Set<String>, toggle: (String) -> Unit) = SelectionWrap(items.map { it to it }, selected, toggle)
@Composable private fun SelectionWrap(items: List<Pair<String, String>>, selected: Set<String>, toggle: (String) -> Unit) { Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) { items.forEach { (id, label) -> FilterChip(selected.contains(id), { toggle(id) }, label = { Text(label) }, leadingIcon = if (selected.contains(id)) ({ Icon(Icons.Outlined.Check, null, Modifier.size(16.dp)) }) else null) } } }
@Composable private fun ExclusionList(children: List<PreceptChild>, excluded: Set<String>, toggle: (String) -> Unit) { Column(verticalArrangement = Arrangement.spacedBy(7.dp)) { Text("Todos os ativos participarão. Toque para dispensar antes da publicação:", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp); SelectionWrap(children.map { it.id to it.name }, excluded, toggle) } }

private fun Set<String>.toggle(value: String) = if (contains(value)) this - value else this + value
private fun dateLabel(value: String) = runCatching { LocalDate.parse(value.take(10)).let { "%02d/%02d/%04d".format(it.dayOfMonth, it.monthValue, it.year) } }.getOrDefault("—")
private fun audienceLabel(value: String) = when (value) { "cargo" -> "Funções selecionadas"; "individual" -> "Pessoas específicas"; else -> "Toda a corrente" }
private fun statusLabel(value: String) = when (value) { "ativo" -> "Ativo"; "rascunho" -> "Rascunho"; "encerrado" -> "Encerrado"; "cancelado" -> "Cancelado"; else -> value }
private fun participantLabel(value: String) = when (value) { "ciente" -> "Ciente"; "dispensado" -> "Dispensado"; "orientacao_solicitada" -> "Pediu orientação"; else -> "Aguardando ciência" }
private fun statusColor(value: String) = when (value) { "ativo", "ciente" -> PreceptGreen; "orientacao_solicitada" -> PreceptWine; "cancelado", "dispensado" -> Color(0xFF9B4949); else -> Color(0xFF8C6B24) }
