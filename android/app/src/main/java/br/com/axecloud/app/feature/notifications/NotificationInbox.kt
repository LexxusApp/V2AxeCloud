package br.com.axecloud.app.feature.notifications

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material.icons.outlined.VolunteerActivism
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import br.com.axecloud.app.feature.home.HomeFeedItem
import br.com.axecloud.app.feature.home.HomeSnapshot
import java.time.LocalDate

private const val PREFS_NAME = "axecloud_native_notifications"

private enum class NotificationKind(val label: String, val icon: ImageVector, val color: Color) {
    PAYMENT("Financeiro", Icons.Outlined.Payments, Color(0xFF267A55)),
    PRAYER("Acolhimento", Icons.Outlined.VolunteerActivism, Color(0xFFB15055)),
    EVENT("Agenda", Icons.Outlined.CalendarMonth, Color(0xFF24728B)),
    PRECEPT("Obrigação", Icons.Outlined.TaskAlt, Color(0xFF8B5BB4)),
    INVENTORY("Estoque", Icons.Outlined.Inventory2, Color(0xFFB47A20)),
    INFO("AxéCloud", Icons.Outlined.NotificationsNone, AxeCloudThemeTokens.Forest),
}

private data class InboxNotification(
    val id: String,
    val kind: NotificationKind,
    val title: String,
    val body: String,
    val target: String,
    val priority: Int = 0,
    val sourceId: String? = null,
    val serverRead: Boolean = false,
)

internal fun nativeUnreadCount(context: Context, data: HomeSnapshot): Int {
    val inbox = buildInbox(data)
    val read = readIds(context, data) + inbox.filter { it.serverRead }.map { it.id }
    return inbox.count { it.id !in read }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NotificationInbox(
    data: HomeSnapshot,
    onDismiss: () -> Unit,
    onMarkRead: (String?) -> Unit,
    onNavigate: (String) -> Unit,
) {
    val context = LocalContext.current
    val allItems = remember(data) { buildInbox(data) }
    var readIds by remember(data) { mutableStateOf(readIds(context, data) + allItems.filter { it.serverRead }.map { it.id }) }
    var unreadOnly by remember { mutableStateOf(false) }
    val visible = if (unreadOnly) allItems.filter { it.id !in readIds } else allItems

    fun markRead(id: String) {
        readIds = (readIds + id).toList().takeLast(300).toSet()
        saveIds(context, data, readIds)
        allItems.find { it.id == id }?.sourceId?.let(onMarkRead)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = AxeCloudThemeTokens.Canvas,
        dragHandle = null,
    ) {
        Column(Modifier.navigationBarsPadding().padding(top = 18.dp)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(shape = CircleShape, color = AxeCloudThemeTokens.Gold) {
                    Icon(Icons.Outlined.NotificationsNone, null, Modifier.padding(11.dp).size(23.dp), tint = AxeCloudThemeTokens.ForestDeep)
                }
                Spacer(Modifier.width(13.dp))
                Column(Modifier.weight(1f)) {
                    Text("Central de notificações", color = AxeCloudThemeTokens.Ink, fontSize = 23.sp, fontWeight = FontWeight.Black)
                    Text("O que mudou e o que pede sua ação", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
                }
                if (readIds.size < allItems.size) {
                    Button(
                        onClick = { readIds = allItems.mapTo(mutableSetOf()) { it.id }; saveIds(context, data, readIds); onMarkRead(null) },
                        colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest),
                    ) { Text("Ler tudo", fontSize = 11.sp) }
                }
            }
            Spacer(Modifier.height(16.dp))
            HorizontalDivider(color = AxeCloudThemeTokens.Outline)
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(!unreadOnly, { unreadOnly = false }, label = { Text("Todas ${allItems.size}") })
                FilterChip(unreadOnly, { unreadOnly = true }, label = { Text("Não lidas ${allItems.count { it.id !in readIds }}") })
            }
            if (visible.isEmpty()) {
                EmptyInbox(unreadOnly)
            } else {
                LazyColumn(
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(visible, key = { it.id }) { item ->
                        NotificationRow(item, item.id !in readIds) {
                            markRead(item.id)
                            onDismiss()
                            onNavigate(item.target)
                        }
                    }
                    item { Spacer(Modifier.height(18.dp)) }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(item: InboxNotification, unread: Boolean, onClick: () -> Unit) {
    Surface(
        Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(19.dp),
        color = if (unread) item.kind.color.copy(alpha = .075f) else Color.Transparent,
        border = BorderStroke(1.dp, if (unread) item.kind.color.copy(alpha = .2f) else AxeCloudThemeTokens.Outline.copy(alpha = .65f)),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            Surface(shape = RoundedCornerShape(13.dp), color = item.kind.color.copy(alpha = .12f)) {
                Icon(item.kind.icon, null, Modifier.padding(9.dp).size(21.dp), tint = item.kind.color)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(item.kind.label.uppercase(), color = item.kind.color, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = .7.sp)
                    if (unread) {
                        Spacer(Modifier.width(7.dp))
                        Surface(Modifier.size(7.dp), shape = CircleShape, color = AxeCloudThemeTokens.Gold) {}
                    }
                }
                Spacer(Modifier.height(3.dp))
                Text(item.title, color = AxeCloudThemeTokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (item.body.isNotBlank()) Text(item.body, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, lineHeight = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.Muted, modifier = Modifier.padding(top = 13.dp))
        }
    }
}

@Composable
private fun EmptyInbox(filtered: Boolean) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 55.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(Icons.Outlined.TaskAlt, null, Modifier.size(42.dp), tint = AxeCloudThemeTokens.Forest)
        Spacer(Modifier.height(10.dp))
        Text(if (filtered) "Tudo lido por aqui" else "Nenhuma novidade agora", color = AxeCloudThemeTokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Text("Quando algo pedir atenção, o AxéCloud reúne aqui.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
    }
}

private fun buildInbox(data: HomeSnapshot): List<InboxNotification> {
    val result = mutableListOf<InboxNotification>()
    if (data.isFilho && data.primaryLabel.contains("Mensalidade", true) && !data.primaryMetric.contains("dia", true)) {
        result += InboxNotification("monthly-current", NotificationKind.PAYMENT, "Mensalidade pede atenção", data.financialMessage, "finance", 5)
    }
    data.monthlyItems.take(8).forEach { result += it.toInbox("monthly", NotificationKind.PAYMENT, "Mensalidade pendente", "finance", 5) }
    data.prayerItems.filter { it.status.equals("pendente", true) }.take(6).forEach { result += it.toInbox("prayer", NotificationKind.PRAYER, "Novo pedido de reza", "management", 5) }
    data.preceptItems.take(6).forEach { result += it.toInbox("precept", NotificationKind.PRECEPT, it.title, "routine", 4) }
    val today = LocalDate.now().toString()
    data.eventItems.filter { item ->
        val date = item.detail.take(10)
        date.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && date >= today
    }.take(6).forEach { result += it.toInbox("event", NotificationKind.EVENT, it.title, "agenda", 3) }
    data.inventoryItems.filter { it.status.contains("baixo", true) }.take(6).forEach { result += it.toInbox("inventory", NotificationKind.INVENTORY, "Estoque baixo: ${it.title}", "management", 4) }
    data.noticeItems.take(8).forEach { result += it.toInbox("notice", NotificationKind.INFO, it.title, "notices", 2) }
    return result.distinctBy { it.id }.sortedByDescending { it.priority }.take(30)
}

private fun HomeFeedItem.toInbox(prefix: String, kind: NotificationKind, fallbackTitle: String, target: String, priority: Int) = InboxNotification(
    id = "$prefix:${id.ifBlank { title }}",
    kind = kind,
    title = title.ifBlank { fallbackTitle },
    body = detail,
    target = target,
    priority = priority,
    sourceId = id.takeIf { prefix == "notice" && status.startsWith("server:") },
    serverRead = prefix == "notice" && status == "server:read",
)

private fun preferenceKey(data: HomeSnapshot) = "${data.houseName}:${if (data.isFilho) "filho" else "lider"}"

private fun readIds(context: Context, data: HomeSnapshot): Set<String> =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getStringSet(preferenceKey(data), emptySet())?.toSet().orEmpty()

private fun saveIds(context: Context, data: HomeSnapshot, ids: Set<String>) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putStringSet(preferenceKey(data), ids.toList().takeLast(300).toSet()).apply()
}
