package br.com.axecloud.app.feature.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.EventAvailable
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

private val NativeGreen = Color(0xFF123E2C)
private val NativeGreenSoft = Color(0xFFE6F2EC)
private val NativeGold = Color(0xFFFFC928)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeAgendaScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onCreate: (String, String, String, String, String) -> Unit,
) {
    var showCreate by rememberSaveable { mutableStateOf(false) }
    var selectedEvent by remember { mutableStateOf<HomeFeedItem?>(null) }
    var filter by rememberSaveable { mutableStateOf("Todos") }
    val events = data.eventItems.filter { item ->
        filter == "Todos" || item.title.contains(filter, true) || item.detail.contains(filter, true)
    }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 104.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                NativePageHeader(
                    eyebrow = "AGENDA DA CASA",
                    title = if (data.isFilho) "Seus próximos movimentos" else "Ritmo e organização",
                    subtitle = if (data.isFilho) "Giras, festas e compromissos da corrente." else "Planeje a casa e mantenha todos no mesmo caminho.",
                    icon = Icons.Outlined.CalendarMonth,
                    metric = data.eventItems.size.toString(),
                    metricLabel = "agendados",
                )
            }
            interaction.feedback?.let { item { NativeFeedback(it) } }
            item {
                ChipRow(listOf("Todos", "Gira", "Festa", "Reunião"), filter) { filter = it }
            }
            if (events.isEmpty()) {
                item {
                    NativeEmptyState(
                        icon = Icons.Outlined.EventAvailable,
                        title = if (filter == "Todos") "Agenda livre" else "Nenhum resultado",
                        text = if (data.isFilho) "Quando a casa marcar um movimento, você verá todos os detalhes aqui." else "Crie a próxima gira pelo botão abaixo e organize a corrente.",
                    )
                }
            } else {
                items(events, key = { it.id.ifBlank { it.title } }) { event ->
                    AgendaEventRow(event) { selectedEvent = event }
                }
            }
        }
        if (!data.isFilho) {
            ExtendedFloatingActionButton(
                onClick = { showCreate = true },
                modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp),
                containerColor = NativeGold,
                contentColor = AxeCloudThemeTokens.ForestDeep,
                icon = { Icon(Icons.Outlined.Add, null) },
                text = { Text("Nova gira", fontWeight = FontWeight.Bold) },
            )
        }
    }

    if (showCreate) {
        CreateEventSheet(
            busy = interaction.actionInProgress != null,
            onDismiss = { showCreate = false },
            onCreate = { title, date, time, type, description ->
                onCreate(title, date, time, type, description)
                showCreate = false
            },
        )
    }
    selectedEvent?.let { event ->
        EventDetailSheet(event, onDismiss = { selectedEvent = null })
    }
}

@Composable
private fun AgendaEventRow(event: HomeFeedItem, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        color = AxeCloudThemeTokens.Surface,
        border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = RoundedCornerShape(16.dp), color = NativeGreenSoft) {
                Column(Modifier.size(58.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Icon(Icons.Outlined.CalendarMonth, null, tint = NativeGreen, modifier = Modifier.size(21.dp))
                    Text(event.detail.take(5).ifBlank { "AXÉ" }, color = NativeGreen, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold)
                }
            }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                Text(event.title, color = AxeCloudThemeTokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(event.detail.ifBlank { "Data e horário a confirmar" }, color = AxeCloudThemeTokens.Muted, fontSize = 12.sp, maxLines = 2)
                if (event.status.isNotBlank()) Text(event.status.replace('_', ' '), color = NativeGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
            Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.Muted)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateEventSheet(
    busy: Boolean,
    onDismiss: () -> Unit,
    onCreate: (String, String, String, String, String) -> Unit,
) {
    var title by rememberSaveable { mutableStateOf("") }
    var date by rememberSaveable { mutableStateOf("") }
    var time by rememberSaveable { mutableStateOf("") }
    var type by rememberSaveable { mutableStateOf("Gira") }
    var description by rememberSaveable { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SheetTitle(Icons.Outlined.Add, "Criar movimento", "As informações serão compartilhadas com a corrente.")
            ChipRow(listOf("Gira", "Festa", "Reunião", "Obrigação"), type) { type = it }
            NativeField(title, { title = it }, "Nome do movimento")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                NativeField(date, { date = it.take(10) }, "AAAA-MM-DD", Modifier.weight(1f))
                NativeField(time, { time = it.take(5) }, "HH:MM", Modifier.weight(1f))
            }
            NativeField(description, { description = it }, "Orientações para a corrente", minLines = 3)
            Button(
                onClick = { onCreate(title.trim(), date, time, type, description.trim()) },
                enabled = title.isNotBlank() && date.length == 10 && !busy,
                modifier = Modifier.fillMaxWidth().height(54.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NativeGreen),
            ) { Text("Publicar na agenda", fontWeight = FontWeight.Bold) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EventDetailSheet(event: HomeFeedItem, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
            SheetTitle(Icons.Outlined.CalendarMonth, event.title, event.detail.ifBlank { "Detalhes do movimento da casa" })
            NativeInfoBand("Situação", event.status.ifBlank { "Agendado" }, Icons.Outlined.Schedule)
            if (event.detail.isNotBlank()) NativeInfoBand("Quando", event.detail, Icons.Outlined.EventAvailable)
            Button(onClick = onDismiss, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = NativeGreen)) { Text("Entendi") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeNoticesScreen(items: List<HomeFeedItem>) {
    var filter by rememberSaveable { mutableStateOf("Todos") }
    var selected by remember { mutableStateOf<HomeFeedItem?>(null) }
    val filtered = items.filter { item ->
        when (filter) {
            "Urgentes" -> item.status.contains("urgent", true) || item.title.contains("urgent", true)
            "Eventos" -> item.detail.contains("gira", true) || item.detail.contains("evento", true)
            else -> true
        }
    }
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            NativePageHeader(
                eyebrow = "MURAL OFICIAL",
                title = "A voz da casa",
                subtitle = "Recados organizados para ninguém perder o que importa.",
                icon = Icons.Outlined.Campaign,
                metric = items.size.toString(),
                metricLabel = "avisos",
                background = Color(0xFF3A281F),
                accent = Color(0xFFFFB36B),
            )
        }
        item { ChipRow(listOf("Todos", "Urgentes", "Eventos"), filter) { filter = it } }
        if (filtered.isEmpty()) {
            item { NativeEmptyState(Icons.Outlined.Notifications, "Nenhum aviso por aqui", "Quando a liderança publicar um recado, ele aparecerá neste mural.") }
        } else {
            items(filtered, key = { it.id.ifBlank { it.title } }) { notice ->
                NoticeRow(notice) { selected = notice }
            }
        }
    }
    selected?.let { notice ->
        ModalBottomSheet(onDismissRequest = { selected = null }, containerColor = AxeCloudThemeTokens.Canvas) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                SheetTitle(Icons.Outlined.Campaign, notice.title, "Comunicado oficial da casa")
                Text(notice.detail.ifBlank { "Este aviso não possui informações adicionais." }, color = AxeCloudThemeTokens.Ink, fontSize = 15.sp, lineHeight = 22.sp)
                if (notice.status.isNotBlank()) NativeInfoBand("Categoria", notice.status.replace('_', ' '), Icons.Outlined.Notifications)
                Button(onClick = { selected = null }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3A281F))) { Text("Fechar aviso") }
            }
        }
    }
}

@Composable
private fun NoticeRow(notice: HomeFeedItem, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        color = AxeCloudThemeTokens.Surface,
        border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline),
    ) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(46.dp).background(Color(0xFFFFE9D8), CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Campaign, null, tint = Color(0xFF9B5428))
            }
            Column(Modifier.weight(1f).padding(horizontal = 13.dp)) {
                Text(notice.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
                Text(notice.detail.ifBlank { "Toque para abrir o comunicado" }, color = AxeCloudThemeTokens.Muted, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Outlined.ChevronRight, null, tint = Color(0xFF9B5428))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeFinanceScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onSettle: (HomeFeedItem) -> Unit,
) {
    var filter by rememberSaveable { mutableStateOf("Pendentes") }
    var selected by remember { mutableStateOf<HomeFeedItem?>(null) }
    val clipboard = LocalClipboardManager.current
    val total = data.monthlyItems.sumOf { it.amount }
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            NativePageHeader(
                eyebrow = if (data.isFilho) "MINHA CONTRIBUIÇÃO" else "FINANCEIRO DA CASA",
                title = if (data.isFilho) "Mensalidade simples" else "Receber com clareza",
                subtitle = if (data.isFilho) "PIX, vencimento e situação em uma única tela." else "Pendências da corrente prontas para ação.",
                icon = Icons.Outlined.AccountBalanceWallet,
                metric = if (data.isFilho) data.monthlyValue.asMoney() else total.asMoney(),
                metricLabel = if (data.isFilho) "mensalidade" else "a receber",
                background = Color(0xFF0D3022),
                accent = Color(0xFF65DDA7),
            )
        }
        interaction.feedback?.let { item { NativeFeedback(it) } }
        if (data.isFilho) {
            when {
                !data.monthlyActive -> item { NativeEmptyState(Icons.Outlined.Payments, "Cobrança desativada", "A casa não utiliza mensalidade no momento.") }
                data.pixPayload.isBlank() -> item { NativeEmptyState(Icons.Outlined.WarningAmber, "PIX não configurado", "Peça à liderança para configurar os dados de recebimento.") }
                else -> item {
                    PixPaymentCard(data) { clipboard.setText(AnnotatedString(data.pixPayload)) }
                }
            }
        } else {
            item { ChipRow(listOf("Pendentes", "Pagas"), filter) { filter = it } }
            if (filter == "Pagas") {
                item { NativeEmptyState(Icons.Outlined.CheckCircle, "Histórico em preparação", "As mensalidades baixadas serão reunidas aqui na próxima conexão do histórico financeiro.") }
            } else if (data.monthlyItems.isEmpty()) {
                item { NativeEmptyState(Icons.Outlined.CheckCircle, "Tudo recebido", "Não há mensalidades pendentes para esta competência.") }
            } else {
                items(data.monthlyItems, key = { it.id.ifBlank { it.title } }) { monthly ->
                    MonthlyRow(monthly) { selected = monthly }
                }
            }
        }
    }
    selected?.let { monthly ->
        ModalBottomSheet(onDismissRequest = { selected = null }, containerColor = AxeCloudThemeTokens.Canvas) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                SheetTitle(Icons.Outlined.Payments, monthly.title, monthly.detail.ifBlank { "Mensalidade pendente" })
                NativeInfoBand("Valor a receber", monthly.amount.asMoney(), Icons.Outlined.AccountBalanceWallet)
                Text("Confirme somente depois de identificar o pagamento. Essa ação atualiza a situação financeira da pessoa.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
                Button(
                    onClick = { onSettle(monthly); selected = null },
                    enabled = interaction.actionInProgress == null,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = NativeGreen),
                ) { Text("Confirmar recebimento", fontWeight = FontWeight.Bold) }
                OutlinedButton(onClick = { selected = null }, modifier = Modifier.fillMaxWidth()) { Text("Agora não") }
            }
        }
    }
}

@Composable
private fun PixPaymentCard(data: HomeSnapshot, onCopy: () -> Unit) {
    Surface(shape = RoundedCornerShape(26.dp), color = AxeCloudThemeTokens.Surface, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("PIX DA CASA", color = NativeGreen, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, letterSpacing = 1.sp)
                    Text(data.monthlyValue.asMoney(), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black, fontSize = 30.sp)
                    Text("Vence todo dia ${data.monthlyDueDay}", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
                }
                Icon(Icons.Outlined.Payments, null, tint = NativeGreen, modifier = Modifier.size(38.dp))
            }
            Spacer(Modifier.height(20.dp))
            Surface(shape = RoundedCornerShape(20.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
                QrCode(data.pixPayload, Modifier.padding(12.dp).size(196.dp))
            }
            Spacer(Modifier.height(14.dp))
            Text(data.pixBeneficiary, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold)
            Button(onClick = onCopy, modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(52.dp), colors = ButtonDefaults.buttonColors(containerColor = NativeGold, contentColor = AxeCloudThemeTokens.ForestDeep)) {
                Icon(Icons.Outlined.ContentCopy, null)
                Spacer(Modifier.size(8.dp))
                Text("Copiar código PIX", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun MonthlyRow(item: HomeFeedItem, onClick: () -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick), shape = RoundedCornerShape(20.dp), color = AxeCloudThemeTokens.Surface, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).background(NativeGreenSoft, CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Payments, null, tint = NativeGreen) }
            Column(Modifier.weight(1f).padding(horizontal = 13.dp)) {
                Text(item.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(item.detail.ifBlank { "Mensalidade pendente" }, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, maxLines = 1)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(item.amount.asMoney(), color = NativeGreen, fontWeight = FontWeight.Black)
                Text("RECEBER", color = AxeCloudThemeTokens.GoldStrong, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun NativePageHeader(
    eyebrow: String,
    title: String,
    subtitle: String,
    icon: ImageVector,
    metric: String,
    metricLabel: String,
    background: Color = NativeGreen,
    accent: Color = NativeGold,
) {
    Surface(shape = RoundedCornerShape(28.dp), color = background, shadowElevation = 5.dp) {
        Column(Modifier.fillMaxWidth().padding(22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(42.dp).background(accent.copy(alpha = .16f), CircleShape), contentAlignment = Alignment.Center) { Icon(icon, null, tint = accent) }
                Text(eyebrow, Modifier.padding(start = 12.dp).weight(1f), color = accent, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
                Column(horizontalAlignment = Alignment.End) {
                    Text(metric, color = AxeCloudThemeTokens.Ivory, fontSize = 18.sp, fontWeight = FontWeight.Black)
                    Text(metricLabel, color = AxeCloudThemeTokens.Ivory.copy(alpha = .58f), fontSize = 9.sp)
                }
            }
            Spacer(Modifier.height(20.dp))
            Text(title, color = AxeCloudThemeTokens.Ivory, fontSize = 27.sp, lineHeight = 30.sp, fontWeight = FontWeight.Black)
            Text(subtitle, Modifier.padding(top = 7.dp), color = AxeCloudThemeTokens.Ivory.copy(alpha = .68f), fontSize = 13.sp, lineHeight = 18.sp)
        }
    }
}

@Composable
private fun ChipRow(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            FilterChip(
                selected = option == selected,
                onClick = { onSelect(option) },
                label = { Text(option, fontWeight = if (option == selected) FontWeight.Bold else FontWeight.Medium) },
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = NativeGold, selectedLabelColor = AxeCloudThemeTokens.ForestDeep),
            )
        }
    }
}

@Composable
private fun NativeEmptyState(icon: ImageVector, title: String, text: String) {
    Surface(shape = RoundedCornerShape(24.dp), color = AxeCloudThemeTokens.Surface, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.fillMaxWidth().padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(58.dp).background(NativeGreenSoft, CircleShape), contentAlignment = Alignment.Center) { Icon(icon, null, tint = NativeGreen, modifier = Modifier.size(28.dp)) }
            Text(title, Modifier.padding(top = 14.dp), color = AxeCloudThemeTokens.Ink, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
            Text(text, Modifier.padding(top = 6.dp), color = AxeCloudThemeTokens.Muted, fontSize = 12.sp, lineHeight = 17.sp)
        }
    }
}

@Composable
private fun NativeFeedback(message: String) {
    Surface(shape = RoundedCornerShape(16.dp), color = NativeGreenSoft) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CheckCircle, null, tint = NativeGreen)
            Text(message, Modifier.padding(start = 10.dp), color = NativeGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
    }
}

@Composable
private fun SheetTitle(icon: ImageVector, title: String, subtitle: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(48.dp).background(NativeGreenSoft, CircleShape), contentAlignment = Alignment.Center) { Icon(icon, null, tint = NativeGreen) }
        Column(Modifier.padding(start = 13.dp)) {
            Text(title, color = AxeCloudThemeTokens.Ink, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun NativeInfoBand(label: String, value: String, icon: ImageVector) {
    Surface(shape = RoundedCornerShape(17.dp), color = NativeGreenSoft) {
        Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = NativeGreen)
            Column(Modifier.padding(start = 12.dp)) {
                Text(label.uppercase(), color = NativeGreen, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = .7.sp)
                Text(value, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun NativeField(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier.fillMaxWidth(),
    minLines: Int = 1,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = modifier,
        label = { Text(label) },
        minLines = minLines,
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = AxeCloudThemeTokens.Surface,
            unfocusedContainerColor = AxeCloudThemeTokens.Surface,
            focusedTextColor = AxeCloudThemeTokens.Ink,
            unfocusedTextColor = AxeCloudThemeTokens.Ink,
            focusedBorderColor = NativeGreen,
        ),
    )
}
