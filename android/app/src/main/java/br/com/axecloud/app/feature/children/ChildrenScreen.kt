package br.com.axecloud.app.feature.children

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Send
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

@Composable
fun ChildrenRoute(viewModel: ChildrenViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    ChildrenScreen(
        state = state,
        onQuery = viewModel::setQuery,
        onFilter = viewModel::setFilter,
        onSort = viewModel::setSort,
        onSelect = viewModel::select,
        onCreate = viewModel::create,
        onEdit = viewModel::edit,
        onCloseEditor = viewModel::closeEditor,
        onSave = viewModel::save,
        onDelete = viewModel::delete,
        onSendAccess = viewModel::sendAccess,
        onResendAll = viewModel::resendAllAccess,
        onRetry = viewModel::load,
        onMessageConsumed = viewModel::consumeMessage,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChildrenScreen(
    state: ChildrenUiState,
    onQuery: (String) -> Unit,
    onFilter: (ChildStatusFilter) -> Unit,
    onSort: (ChildSort) -> Unit,
    onSelect: (ChildOfSaint?) -> Unit,
    onCreate: () -> Unit,
    onEdit: (ChildOfSaint) -> Unit,
    onCloseEditor: () -> Unit,
    onSave: (ChildForm) -> Unit,
    onDelete: (ChildOfSaint) -> Unit,
    onSendAccess: (ChildOfSaint) -> Unit,
    onResendAll: () -> Unit,
    onRetry: () -> Unit,
    onMessageConsumed: () -> Unit,
) {
    val snackbar = remember { SnackbarHostState() }
    var deleteCandidate by remember { mutableStateOf<ChildOfSaint?>(null) }
    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it); onMessageConsumed() }
    }
    Scaffold(
        containerColor = AxeCloudThemeTokens.Canvas,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreate,
                containerColor = AxeCloudThemeTokens.Gold,
                contentColor = AxeCloudThemeTokens.ForestDeep,
                shape = RoundedCornerShape(18.dp),
            ) { Icon(Icons.Outlined.PersonAdd, "Cadastrar filho de santo") }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 18.dp, end = 18.dp, top = 10.dp, bottom = 100.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { ChildrenHeader(state.activeCount, state.children.size, state.pendingMonthlyCount) }
            item {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = onQuery,
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(18.dp),
                    leadingIcon = { Icon(Icons.Outlined.Search, null) },
                    trailingIcon = if (state.query.isNotBlank()) ({ IconButton(onClick = { onQuery("") }) { Icon(Icons.Outlined.Close, "Limpar busca") } }) else null,
                    placeholder = { Text("Buscar por nome, cargo, orixá ou telefone") },
                )
            }
            item {
                Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ChildStatusFilter.entries.forEach { filter ->
                        FilterChip(
                            selected = state.filter == filter,
                            onClick = { onFilter(filter) },
                            label = { Text(filter.label) },
                        )
                    }
                }
            }
            item {
                Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
                    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)){Text("Ordenar:",color=AxeCloudThemeTokens.Muted,fontSize=11.sp,modifier=Modifier.align(Alignment.CenterVertically));ChildSort.entries.forEach{sort->FilterChip(state.sort==sort,{onSort(sort)},label={Text(sort.label)})}}
                    OutlinedButton(onResendAll,Modifier.fillMaxWidth(),enabled=!state.saving&&state.children.isNotEmpty()){if(state.saving)CircularProgressIndicator(Modifier.size(17.dp),strokeWidth=2.dp)else Icon(Icons.Outlined.Send,null);Spacer(Modifier.width(7.dp));Text("Enviar acesso para a corrente")}
                }
            }
            when {
                state.loading -> item { LoadingCurrent() }
                state.error != null && state.children.isEmpty() -> item { ChildrenError(state.error, onRetry) }
                state.visibleChildren.isEmpty() -> item { EmptyCurrent(onCreate, state.query.isNotBlank()) }
                else -> items(state.visibleChildren, key = { it.id }) { child ->
                    ChildRow(child = child, busy = state.deletingId == child.id, onClick = { onSelect(child) })
                }
            }
        }
    }

    state.selected?.let { child ->
        ChildDetailSheet(
            child = child,
            onDismiss = { onSelect(null) },
            onEdit = { onEdit(child) },
            onDelete = { deleteCandidate = child },
            onSendAccess = { onSendAccess(child) },
            busy = state.deletingId == child.id,
        )
    }
    if (state.creating || state.editing != null) {
        ChildEditorSheet(
            child = state.editing,
            saving = state.saving,
            error = state.error,
            onDismiss = onCloseEditor,
            onSave = onSave,
        )
    }
    deleteCandidate?.let { child ->
        AlertDialog(
            onDismissRequest = { deleteCandidate = null },
            icon = { Icon(Icons.Outlined.WarningAmber, null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Excluir ${child.name}?") },
            text = { Text("O perfil e os dados vinculados serão removidos. Esta ação não pode ser desfeita.") },
            confirmButton = {
                Button(
                    onClick = { deleteCandidate = null; onDelete(child) },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) { Text("Excluir cadastro") }
            },
            dismissButton = { TextButton(onClick = { deleteCandidate = null }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun ChildrenHeader(active: Int, total: Int, pending: Int) {
    Column(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = RoundedCornerShape(15.dp), color = AxeCloudThemeTokens.Forest) {
                Icon(Icons.Outlined.Groups, null, Modifier.padding(12.dp).size(25.dp), tint = AxeCloudThemeTokens.Gold)
            }
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f)) {
                Text("Sua corrente", color = AxeCloudThemeTokens.GoldStrong, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                Text("Filhos de Santo", color = AxeCloudThemeTokens.Ink, fontSize = 27.sp, lineHeight = 30.sp, fontWeight = FontWeight.Black)
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            CurrentMetric(active.toString(), "ativos", Color(0xFF2E7D5A), Modifier.weight(1f))
            CurrentMetric(total.toString(), "na corrente", AxeCloudThemeTokens.Forest, Modifier.weight(1f))
            CurrentMetric(pending.toString(), "mensais", Color(0xFFB26A28), Modifier.weight(1f))
        }
    }
}

@Composable
private fun CurrentMetric(value: String, label: String, color: Color, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(17.dp), color = color.copy(alpha = .09f), border = BorderStroke(1.dp, color.copy(alpha = .14f))) {
        Column(Modifier.padding(13.dp)) {
            Text(value, color = color, fontSize = 23.sp, fontWeight = FontWeight.Black)
            Text(label, color = AxeCloudThemeTokens.Muted, fontSize = 10.sp, maxLines = 1)
        }
    }
}

@Composable
private fun ChildRow(child: ChildOfSaint, busy: Boolean, onClick: () -> Unit) {
    val haptic = LocalHapticFeedback.current
    AnimatedVisibility(visible = true, enter = fadeIn() + slideInVertically(spring(stiffness = 500f)) { it / 3 }) {
        Surface(
            modifier = Modifier.fillMaxWidth().animateContentSize().clickable { haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove); onClick() },
            shape = RoundedCornerShape(20.dp),
            color = Color.White,
            border = BorderStroke(1.dp, Color(0xFFE5DED0)),
            shadowElevation = 1.dp,
        ) {
            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                PersonAvatar(child, 52)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(child.name, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(listOf(child.role, child.frontOrisha).filter(String::isNotBlank).joinToString(" · "), color = AxeCloudThemeTokens.Muted, fontSize = 12.sp, maxLines = 1)
                    Spacer(Modifier.height(6.dp))
                    StatusPill(child.status)
                }
                if (busy) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                else Icon(Icons.Outlined.ArrowForward, null, tint = AxeCloudThemeTokens.Forest.copy(alpha = .65f), modifier = Modifier.size(19.dp))
            }
        }
    }
}

@Composable
private fun PersonAvatar(child: ChildOfSaint, size: Int) {
    Surface(Modifier.size(size.dp), shape = CircleShape, color = AxeCloudThemeTokens.Forest.copy(alpha = .09f)) {
        if (child.photoUrl.isNotBlank()) AsyncImage(child.photoUrl, child.name, contentScale = ContentScale.Crop)
        else Box(contentAlignment = Alignment.Center) { Text(child.name.trim().take(1).uppercase().ifBlank { "A" }, color = AxeCloudThemeTokens.Forest, fontSize = (size * .38f).sp, fontWeight = FontWeight.Black) }
    }
}

@Composable
private fun StatusPill(status: String) {
    val color = when (status.lowercase()) {
        "ativo" -> Color(0xFF198754)
        "pendente" -> Color(0xFFC17B18)
        else -> Color(0xFF7A7F87)
    }
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = .1f)) {
        Text(status, Modifier.padding(horizontal = 9.dp, vertical = 3.dp), color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChildDetailSheet(child: ChildOfSaint, onDismiss: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit,onSendAccess:()->Unit,busy:Boolean) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 22.dp).padding(bottom = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PersonAvatar(child, 68)
                Spacer(Modifier.width(15.dp))
                Column(Modifier.weight(1f)) {
                    Text(child.name, color = AxeCloudThemeTokens.Ink, fontSize = 21.sp, fontWeight = FontWeight.Black)
                    Text(child.role.ifBlank { "Filho de Santo" }, color = AxeCloudThemeTokens.Muted)
                    Spacer(Modifier.height(6.dp)); StatusPill(child.status)
                }
                IconButton(onClick = onEdit) { Icon(Icons.Outlined.Edit, "Editar") }
            }
            Spacer(Modifier.height(21.dp))
            DetailLine(Icons.Outlined.Badge, "Orixá de frente", child.frontOrisha.ifBlank { "Não informado" })
            DetailLine(Icons.Outlined.CalendarMonth, "Entrada na casa", child.entryDate.asDate())
            DetailLine(Icons.Outlined.CalendarMonth, "Nascimento", child.birthDate.asDate())
            DetailLine(Icons.Outlined.Phone, "Contato", child.whatsapp.ifBlank { child.phone }.ifBlank { "Não informado" })
            DetailLine(Icons.Outlined.AccountBalanceWallet,"Mensalidade",if(child.monthlyPending)"Pagamento pendente" else "Em dia")
            DetailLine(Icons.Outlined.CheckCircle,"Acesso ao aplicativo",if(child.accessReady)"Conta vinculada" else "Ainda não entrou")
            Button(onSendAccess,Modifier.fillMaxWidth().padding(top=8.dp),enabled=!busy,colors=ButtonDefaults.buttonColors(containerColor=Color(0xFF1E6B4D))){if(busy)CircularProgressIndicator(Modifier.size(18.dp),strokeWidth=2.dp,color=Color.White)else Icon(Icons.Outlined.Send,null);Spacer(Modifier.width(7.dp));Text("Enviar dados de acesso")}
            HorizontalDivider(Modifier.padding(vertical = 14.dp), color = Color(0xFFE1DACD))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = onDelete, modifier = Modifier.weight(1f)) { Icon(Icons.Outlined.DeleteOutline, null); Spacer(Modifier.width(6.dp)); Text("Excluir") }
                Button(onClick = onEdit, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Icon(Icons.Outlined.Edit, null); Spacer(Modifier.width(6.dp)); Text("Editar perfil") }
            }
        }
    }
}

@Composable
private fun DetailLine(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(shape = RoundedCornerShape(12.dp), color = AxeCloudThemeTokens.Forest.copy(alpha = .08f)) { Icon(icon, null, Modifier.padding(10.dp).size(19.dp), tint = AxeCloudThemeTokens.Forest) }
        Spacer(Modifier.width(12.dp)); Column { Text(label, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp); Text(value, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChildEditorSheet(child: ChildOfSaint?, saving: Boolean, error: String?, onDismiss: () -> Unit, onSave: (ChildForm) -> Unit) {
    var form by rememberSaveable(child?.id) { mutableStateOf(child?.let(ChildForm::from) ?: ChildForm()) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 22.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { Text(if (child == null) "Nova pessoa na corrente" else "Editar cadastro", color = AxeCloudThemeTokens.Ink, fontSize = 23.sp, fontWeight = FontWeight.Black) }
            item { FormField("Nome completo", form.name) { form = form.copy(name = it) } }
            item { FormField("Cargo ou função", form.role) { form = form.copy(role = it) } }
            item { FormField("Orixá de frente", form.frontOrisha) { form = form.copy(frontOrisha = it) } }
            item { FormField("WhatsApp", form.whatsapp) { form = form.copy(whatsapp = it) } }
            item { FormField("CPF", form.cpf) { form = form.copy(cpf = it) } }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.weight(1f)) { FormField("Nascimento", form.birthDate, "AAAA-MM-DD") { form = form.copy(birthDate = it) } }
                    Box(Modifier.weight(1f)) { FormField("Entrada", form.entryDate, "AAAA-MM-DD") { form = form.copy(entryDate = it) } }
                }
            }
            item {
                Text("Situação", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("Ativo", "Pendente", "Inativo").forEach { status ->
                        FilterChip(selected = form.status == status, onClick = { form = form.copy(status = status) }, label = { Text(status) })
                    }
                }
            }
            if (error != null) item { Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            item {
                Button(
                    onClick = { onSave(form) },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    enabled = !saving && form.name.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest),
                    shape = RoundedCornerShape(17.dp),
                ) {
                    if (saving) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    else { Icon(Icons.Outlined.CheckCircle, null); Spacer(Modifier.width(8.dp)); Text(if (child == null) "Adicionar à corrente" else "Salvar alterações", fontWeight = FontWeight.Bold) }
                }
                Spacer(Modifier.height(28.dp))
            }
        }
    }
}

@Composable
private fun FormField(label: String, value: String, placeholder: String = "", onValue: (String) -> Unit) {
    OutlinedTextField(value, onValue, Modifier.fillMaxWidth(), label = { Text(label) }, placeholder = { Text(placeholder) }, singleLine = true, shape = RoundedCornerShape(15.dp))
}

@Composable
private fun LoadingCurrent() = Column(Modifier.fillMaxWidth().padding(44.dp), horizontalAlignment = Alignment.CenterHorizontally) {
    CircularProgressIndicator(color = AxeCloudThemeTokens.Forest); Spacer(Modifier.height(12.dp)); Text("Reunindo sua corrente…", color = AxeCloudThemeTokens.Muted)
}

@Composable
private fun ChildrenError(message: String, retry: () -> Unit) = Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), color = Color.White) {
    Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Outlined.WarningAmber, null, tint = MaterialTheme.colorScheme.error); Spacer(Modifier.height(8.dp)); Text(message, color = AxeCloudThemeTokens.Ink); Spacer(Modifier.height(12.dp)); OutlinedButton(onClick = retry) { Icon(Icons.Outlined.Refresh, null); Spacer(Modifier.width(6.dp)); Text("Tentar novamente") }
    }
}

@Composable
private fun EmptyCurrent(create: () -> Unit, searching: Boolean) = Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), color = AxeCloudThemeTokens.Forest.copy(alpha = .06f), border = BorderStroke(1.dp, AxeCloudThemeTokens.Forest.copy(alpha = .12f))) {
    Column(Modifier.padding(26.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(if (searching) Icons.Outlined.Search else Icons.Outlined.PersonAdd, null, Modifier.size(34.dp), tint = AxeCloudThemeTokens.Forest)
        Spacer(Modifier.height(10.dp)); Text(if (searching) "Nenhuma pessoa encontrada" else "A corrente começa aqui", color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black, fontSize = 18.sp)
        Text(if (searching) "Ajuste a busca ou os filtros." else "Cadastre a primeira pessoa e acompanhe sua caminhada pela casa.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
        if (!searching) { Spacer(Modifier.height(14.dp)); Button(onClick = create, colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Icon(Icons.Outlined.Add, null); Spacer(Modifier.width(6.dp)); Text("Cadastrar pessoa") } }
    }
}

private fun String.asDate(): String {
    val date = take(10)
    if (!Regex("\\d{4}-\\d{2}-\\d{2}").matches(date)) return ifBlank { "Não informado" }
    return "${date.substring(8, 10)}/${date.substring(5, 7)}/${date.substring(0, 4)}"
}
