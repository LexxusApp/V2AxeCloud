package br.com.axecloud.app.feature.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.VolunteerActivism
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Security
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import coil.compose.AsyncImage
import android.net.Uri
import android.content.Intent
import android.provider.Settings

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
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AxeCloudThemeTokens.Canvas, modifier = Modifier.navigationBarsPadding()) {
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
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AxeCloudThemeTokens.Canvas, modifier = Modifier.navigationBarsPadding()) {
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
        ModalBottomSheet(onDismissRequest = { selected = null }, containerColor = AxeCloudThemeTokens.Canvas, modifier = Modifier.navigationBarsPadding()) {
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
    onReceipt: (Uri) -> Unit,
) {
    var filter by rememberSaveable { mutableStateOf("Pendentes") }
    var selected by remember { mutableStateOf<HomeFeedItem?>(null) }
    val clipboard = LocalClipboardManager.current
    val receiptPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) onReceipt(uri) }
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
                    PixPaymentCard(
                        data = data,
                        busy = interaction.actionInProgress == "payment_receipt",
                        onCopy = { clipboard.setText(AnnotatedString(data.pixPayload)) },
                        onReceipt = { receiptPicker.launch("image/*") },
                    )
                }
            }
            if (data.transactionItems.isNotEmpty()) {
                item { Text("Histórico recente", color = AxeCloudThemeTokens.Ink, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold) }
                items(data.transactionItems.take(8), key = { it.id.ifBlank { it.title + it.detail } }) { transaction ->
                    TransactionRow(transaction)
                }
            }
        } else {
            item { ChipRow(listOf("Pendentes", "Pagas"), filter) { filter = it } }
            if (filter == "Pagas" && data.paidMonthlyItems.isEmpty()) {
                item { NativeEmptyState(Icons.Outlined.CheckCircle, "Nenhum pagamento nesta visão", "As mensalidades confirmadas aparecerão aqui automaticamente.") }
            } else if (filter == "Pagas") {
                items(data.paidMonthlyItems, key = { it.id.ifBlank { it.title + it.detail } }) { monthly -> MonthlyPaidRow(monthly) }
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
        ModalBottomSheet(onDismissRequest = { selected = null }, containerColor = AxeCloudThemeTokens.Canvas, modifier = Modifier.navigationBarsPadding()) {
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
private fun PixPaymentCard(data: HomeSnapshot, busy: Boolean, onCopy: () -> Unit, onReceipt: () -> Unit) {
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
            OutlinedButton(onClick = onReceipt, enabled = !busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp).height(50.dp)) {
                if (busy) {
                    androidx.compose.material3.CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = NativeGreen)
                    Spacer(Modifier.size(8.dp))
                    Text("Validando...")
                } else {
                    Icon(Icons.Outlined.PhotoCamera, null)
                    Spacer(Modifier.size(8.dp))
                    Text("Enviar comprovante", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun MonthlyPaidRow(item: HomeFeedItem) {
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp), color = AxeCloudThemeTokens.Surface, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).background(NativeGreenSoft, CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.CheckCircle, null, tint = NativeGreen) }
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(item.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(item.detail.ifBlank { "Pagamento confirmado" }, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
            }
            Text(item.amount.asMoney(), color = NativeGreen, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun TransactionRow(item: HomeFeedItem) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.Payments, null, tint = NativeGreen, modifier = Modifier.size(22.dp))
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(item.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(item.detail, color = AxeCloudThemeTokens.Muted, fontSize = 10.sp)
        }
        Text(item.amount.asMoney(), color = NativeGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp)
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
    Column(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).background(background, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = accent, modifier = Modifier.size(22.dp))
            }
            Text(eyebrow, Modifier.padding(start = 12.dp).weight(1f), color = AxeCloudThemeTokens.Muted, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
            Surface(shape = RoundedCornerShape(50), color = background.copy(alpha = .08f)) {
                Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(metric, color = AxeCloudThemeTokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Black)
                    Text("  $metricLabel", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp)
                }
            }
        }
        Spacer(Modifier.height(18.dp))
        Text(title, color = AxeCloudThemeTokens.Ink, fontSize = 30.sp, lineHeight = 33.sp, fontWeight = FontWeight.Black)
        Text(subtitle, Modifier.padding(top = 7.dp), color = AxeCloudThemeTokens.Muted, fontSize = 13.sp, lineHeight = 19.sp)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeJourneyScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onAcknowledge: (String) -> Unit,
    onGuidance: (String) -> Unit,
    onOpenConversation: (String, String) -> Unit,
) {
    var section by rememberSaveable { mutableStateOf(if (data.preceptItems.isNotEmpty()) "Preceitos" else "Acervo") }
    var selected by remember { mutableStateOf<HomeFeedItem?>(null) }
    val uriHandler = LocalUriHandler.current
    val current = when (section) {
        "Preceitos" -> data.preceptItems
        "Conversas" -> data.conversationItems
        else -> data.libraryItems
    }
    val currentIcon = when (section) {
        "Preceitos" -> Icons.Outlined.LocalFireDepartment
        "Conversas" -> Icons.Outlined.ChatBubbleOutline
        else -> Icons.Outlined.MenuBook
    }

    LazyColumn(contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            NativePageHeader(
                eyebrow = "CAMINHADA E FUNDAMENTO",
                title = if (data.isFilho) "Seu axé, no seu tempo" else "Memória viva da casa",
                subtitle = "Orientações, estudos e conversas com acesso responsável.",
                icon = Icons.Outlined.MenuBook,
                metric = (data.preceptItems.size + data.libraryItems.size).toString(),
                metricLabel = "conteúdos",
                background = Color(0xFF3A2F21),
                accent = Color(0xFFE8BC60),
            )
        }
        interaction.feedback?.let { item { NativeFeedback(it) } }
        item { ChipRow(listOf("Preceitos", "Acervo", "Conversas"), section) { section = it } }
        if (current.isEmpty()) {
            item {
                NativeEmptyState(
                    currentIcon,
                    when (section) {
                        "Preceitos" -> "Nenhum preceito ativo"
                        "Conversas" -> "Nenhuma conversa iniciada"
                        else -> "Acervo em preparação"
                    },
                    when (section) {
                        "Preceitos" -> "Quando houver uma orientação para sua caminhada, ela aparecerá aqui."
                        "Conversas" -> "A comunicação privada com a liderança ficará reunida neste espaço."
                        else -> "Banhos, ervas, cantigas e fundamentos publicados pela casa aparecerão aqui."
                    },
                )
            }
        } else {
            items(current, key = { it.id.ifBlank { it.title } }) { item ->
                JourneyNativeRow(item, currentIcon, section) {
                    when (section) {
                        "Conversas" -> onOpenConversation(item.id, item.title)
                        "Acervo" -> if (item.url.isNotBlank()) uriHandler.openUri(item.url) else selected = item
                        else -> selected = item
                    }
                }
            }
        }
    }

    selected?.let { item ->
        ModalBottomSheet(onDismissRequest = { selected = null }, containerColor = AxeCloudThemeTokens.Canvas, modifier = Modifier.navigationBarsPadding()) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                SheetTitle(currentIcon, item.title, item.status.replace('_', ' ').ifBlank { section })
                Text(item.detail.ifBlank { "A casa ainda não adicionou detalhes a este conteúdo." }, color = AxeCloudThemeTokens.Ink, fontSize = 14.sp, lineHeight = 21.sp)
                if (section == "Preceitos" && data.isFilho && item.status.lowercase() != "ciente") {
                    Button(
                        onClick = { onAcknowledge(item.id); selected = null },
                        enabled = interaction.actionInProgress == null,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = NativeGreen),
                    ) { Text("Marcar que estou ciente", fontWeight = FontWeight.Bold) }
                    OutlinedButton(
                        onClick = { onGuidance(item.id); selected = null },
                        enabled = interaction.actionInProgress == null,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Pedir orientação à casa") }
                } else {
                    Button(onClick = { selected = null }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = NativeGreen)) { Text("Fechar") }
                }
            }
        }
    }
}

@Composable
private fun JourneyNativeRow(item: HomeFeedItem, icon: ImageVector, section: String, onClick: () -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick), shape = RoundedCornerShape(21.dp), color = AxeCloudThemeTokens.Surface, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).background(Color(0xFFF3E8D4), RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Color(0xFF73542B)) }
            Column(Modifier.weight(1f).padding(horizontal = 13.dp)) {
                Text(item.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(item.detail.ifBlank { "Toque para acessar" }, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (item.status.isNotBlank()) Text(item.status.replace('_', ' ').uppercase(), color = Color(0xFF9A722D), fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Icon(if (section == "Acervo" && item.url.isNotBlank()) Icons.Outlined.MenuBook else Icons.Outlined.ChevronRight, null, tint = Color(0xFF9A722D))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeManagementScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onPrayerStatus: (HomeFeedItem, String) -> Unit,
    onCreateAlbum: (String, String) -> Unit,
    onAddInventory: (String, String, String, String) -> Unit,
    onAddProduct: (String, String, String, String) -> Unit,
) {
    val sections = if (data.isFilho) listOf("Galeria", "Loja") else listOf("Pedidos", "Galeria", "Estoque", "Loja")
    var section by rememberSaveable { mutableStateOf(sections.first()) }
    var showCreate by rememberSaveable { mutableStateOf(false) }
    var selected by remember { mutableStateOf<HomeFeedItem?>(null) }
    val current = when (section) {
        "Pedidos" -> data.prayerItems
        "Galeria" -> data.galleryItems
        "Estoque" -> data.inventoryItems
        else -> data.storeItems
    }
    val icon = managementIcon(section)

    Box(Modifier.fillMaxSize()) {
        LazyColumn(contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 104.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                NativePageHeader(
                    eyebrow = "GESTÃO EM MOVIMENTO",
                    title = if (data.isFilho) "Espaços da casa" else "A casa na palma da mão",
                    subtitle = if (data.isFilho) "Memórias e produtos da sua comunidade." else "Acolhimentos, acervo, estoque e loja sem perder o contexto.",
                    icon = Icons.Outlined.VolunteerActivism,
                    metric = current.size.toString(),
                    metricLabel = section.lowercase(),
                    background = Color(0xFF173A30),
                    accent = Color(0xFF62D8AA),
                )
            }
            interaction.feedback?.let { item { NativeFeedback(it) } }
            item { ChipRow(sections, section) { section = it } }
            if (current.isEmpty()) {
                item { NativeEmptyState(icon, "Nenhum item em ${section.lowercase()}", managementEmptyText(section, data.isFilho)) }
            } else {
                items(current, key = { it.id.ifBlank { it.title } }) { item ->
                    ManagementNativeRow(item, icon, section) { selected = item }
                }
            }
        }
        if (!data.isFilho && section != "Pedidos") {
            ExtendedFloatingActionButton(
                onClick = { showCreate = true },
                modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp),
                containerColor = NativeGold,
                contentColor = AxeCloudThemeTokens.ForestDeep,
                icon = { Icon(Icons.Outlined.Add, null) },
                text = { Text(when (section) { "Galeria" -> "Novo álbum"; "Estoque" -> "Novo item"; else -> "Novo produto" }, fontWeight = FontWeight.Bold) },
            )
        }
    }

    if (showCreate) {
        ManagementCreateSheet(
            section = section,
            busy = interaction.actionInProgress != null,
            onDismiss = { showCreate = false },
            onAlbum = { name, description -> onCreateAlbum(name, description); showCreate = false },
            onInventory = { name, category, currentValue, minimum -> onAddInventory(name, category, currentValue, minimum); showCreate = false },
            onProduct = { name, description, price, stock -> onAddProduct(name, description, price, stock); showCreate = false },
        )
    }
    selected?.let { item ->
        ModalBottomSheet(onDismissRequest = { selected = null }, containerColor = AxeCloudThemeTokens.Canvas, modifier = Modifier.navigationBarsPadding()) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                SheetTitle(icon, item.title, section)
                Text(item.detail.ifBlank { "Sem informações adicionais." }, color = AxeCloudThemeTokens.Ink, fontSize = 14.sp, lineHeight = 21.sp)
                if (item.amount > 0) NativeInfoBand("Valor", item.amount.asMoney(), Icons.Outlined.Payments)
                if (section == "Pedidos" && !data.isFilho) {
                    Button(onClick = { onPrayerStatus(item, "acolhido"); selected = null }, enabled = interaction.actionInProgress == null, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = NativeGreen)) { Text("Marcar como acolhido") }
                    OutlinedButton(onClick = { onPrayerStatus(item, "em_oracao"); selected = null }, enabled = interaction.actionInProgress == null, modifier = Modifier.fillMaxWidth()) { Text("Colocar em oração") }
                } else Button(onClick = { selected = null }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = NativeGreen)) { Text("Fechar") }
            }
        }
    }
}

@Composable
private fun ManagementNativeRow(item: HomeFeedItem, icon: ImageVector, section: String, onClick: () -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick), shape = RoundedCornerShape(21.dp), color = AxeCloudThemeTokens.Surface, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).background(NativeGreenSoft, RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = NativeGreen) }
            Column(Modifier.weight(1f).padding(horizontal = 13.dp)) {
                Text(item.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(item.detail.ifBlank { section }, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            if (item.amount > 0) Text(item.amount.asMoney(), color = NativeGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            else Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.Muted)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManagementCreateSheet(
    section: String,
    busy: Boolean,
    onDismiss: () -> Unit,
    onAlbum: (String, String) -> Unit,
    onInventory: (String, String, String, String) -> Unit,
    onProduct: (String, String, String, String) -> Unit,
) {
    var name by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var valueOne by rememberSaveable { mutableStateOf("") }
    var valueTwo by rememberSaveable { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AxeCloudThemeTokens.Canvas, modifier = Modifier.navigationBarsPadding()) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SheetTitle(managementIcon(section), when (section) { "Galeria" -> "Criar álbum"; "Estoque" -> "Adicionar ao estoque"; else -> "Cadastrar produto" }, "Preencha somente as informações essenciais.")
            NativeField(name, { name = it }, when (section) { "Galeria" -> "Nome do álbum"; "Estoque" -> "Nome do item"; else -> "Nome do produto" })
            NativeField(description, { description = it }, if (section == "Estoque") "Categoria" else "Descrição", minLines = if (section == "Estoque") 1 else 2)
            if (section != "Galeria") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    NativeField(valueOne, { valueOne = it }, if (section == "Estoque") "Quantidade" else "Preço", Modifier.weight(1f))
                    NativeField(valueTwo, { valueTwo = it }, if (section == "Estoque") "Estoque mínimo" else "Estoque", Modifier.weight(1f))
                }
            }
            Button(
                onClick = {
                    when (section) {
                        "Galeria" -> onAlbum(name, description)
                        "Estoque" -> onInventory(name, description, valueOne, valueTwo)
                        else -> onProduct(name, description, valueOne, valueTwo)
                    }
                },
                enabled = name.isNotBlank() && !busy,
                modifier = Modifier.fillMaxWidth().height(54.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NativeGreen),
            ) { Text("Salvar", fontWeight = FontWeight.Bold) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeProfileScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onUploadPhoto: (Uri) -> Unit,
    onLogout: () -> Unit,
) {
    val context = LocalContext.current
    var showSecurity by rememberSaveable { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) onUploadPhoto(uri) }
    LazyColumn(contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = CircleShape, color = NativeGreen, border = BorderStroke(3.dp, NativeGold)) {
                    if (data.profilePhotoUrl.isNotBlank()) AsyncImage(model = data.profilePhotoUrl, contentDescription = "Foto de perfil", modifier = Modifier.size(88.dp), contentScale = ContentScale.Crop)
                    else Box(Modifier.size(88.dp), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Person, null, tint = NativeGold, modifier = Modifier.size(42.dp)) }
                }
                Column(Modifier.weight(1f).padding(start = 18.dp)) {
                    Text("CONTA AXÉCLOUD", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
                    Text(data.greetingName, Modifier.padding(top = 6.dp), color = AxeCloudThemeTokens.Ink, fontSize = 25.sp, fontWeight = FontWeight.Black)
                    Text(data.houseName.ifBlank { "AxéCloud" }, color = AxeCloudThemeTokens.Muted, fontSize = 13.sp)
                    Surface(Modifier.padding(top = 9.dp), shape = RoundedCornerShape(50), color = NativeGreenSoft) {
                        Text(if (data.isFilho) "FILHO DE SANTO" else "GESTÃO DA CASA", Modifier.padding(horizontal = 11.dp, vertical = 6.dp), color = NativeGreen, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        interaction.feedback?.let { item { NativeFeedback(it) } }
        item {
            ProfileAction(
                Icons.Outlined.PhotoCamera,
                if (data.isFilho) "Trocar minha foto" else "Trocar foto da casa",
                if (data.isFilho) "Atualize sua identificação nas conversas e no perfil." else "A nova imagem será usada no menu e na identidade administrativa.",
            ) { picker.launch("image/*") }
        }
        item {
            ProfileAction(Icons.Outlined.Notifications, "Notificações", "Abra as permissões de aviso deste aplicativo.") {
                context.startActivity(
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                )
            }
        }
        item { ProfileAction(Icons.Outlined.Security, "Privacidade e acesso", "Veja como sua sessão fica protegida neste aparelho.") { showSecurity = true } }
        item {
            Surface(shape = RoundedCornerShape(20.dp), color = AxeCloudThemeTokens.Surface, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
                Column(Modifier.fillMaxWidth().padding(18.dp)) {
                    Text("SOBRE O APLICATIVO", color = AxeCloudThemeTokens.Muted, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                    Text("AxéCloud para Android", Modifier.padding(top = 8.dp), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold)
                    Text("Aplicativo nativo · versão de desenvolvimento", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
                }
            }
        }
        item {
            OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth().height(54.dp), border = BorderStroke(1.dp, AxeCloudThemeTokens.Error)) {
                Icon(Icons.Outlined.Logout, null, tint = AxeCloudThemeTokens.Error)
                Spacer(Modifier.size(8.dp))
                Text("Sair desta conta", color = AxeCloudThemeTokens.Error, fontWeight = FontWeight.Bold)
            }
        }
        item { Spacer(Modifier.height(12.dp)) }
    }
    if (showSecurity) {
        ModalBottomSheet(onDismissRequest = { showSecurity = false }, containerColor = AxeCloudThemeTokens.Canvas, modifier = Modifier.navigationBarsPadding()) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                SheetTitle(Icons.Outlined.Security, "Proteção da conta", "Segurança integrada ao Android")
                NativeInfoBand("Credenciais", "Tokens mantidos no armazenamento criptografado do aparelho.", Icons.Outlined.Security)
                NativeInfoBand("Comunicação", "Conexões protegidas por HTTPS com o AxéCloud.", Icons.Outlined.CheckCircle)
                Text("Ao sair da conta, as credenciais locais são removidas deste aparelho.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
                Button(onClick = { showSecurity = false }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = NativeGreen)) { Text("Entendi") }
            }
        }
    }
}

@Composable
private fun ProfileAction(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick), shape = RoundedCornerShape(20.dp), color = AxeCloudThemeTokens.Surface, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(46.dp).background(NativeGreenSoft, CircleShape), contentAlignment = Alignment.Center) { Icon(icon, null, tint = NativeGreen) }
            Column(Modifier.weight(1f).padding(horizontal = 13.dp)) {
                Text(title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold)
                Text(subtitle, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
            }
            Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.Muted)
        }
    }
}

private fun managementIcon(section: String): ImageVector = when (section) {
    "Pedidos" -> Icons.Outlined.VolunteerActivism
    "Galeria" -> Icons.Outlined.PhotoLibrary
    "Estoque" -> Icons.Outlined.Inventory2
    else -> Icons.Outlined.Storefront
}

private fun managementEmptyText(section: String, isFilho: Boolean): String = when (section) {
    "Pedidos" -> "Quando alguém pedir acolhimento, a solicitação aparecerá aqui."
    "Galeria" -> if (isFilho) "As memórias publicadas pela casa aparecerão aqui." else "Crie o primeiro álbum para começar a memória visual da casa."
    "Estoque" -> "Cadastre os itens usados na rotina e acompanhe o que precisa de reposição."
    else -> if (isFilho) "Os produtos publicados pelo terreiro aparecerão nesta vitrine." else "Cadastre o primeiro produto para abrir a vitrine da casa."
}
