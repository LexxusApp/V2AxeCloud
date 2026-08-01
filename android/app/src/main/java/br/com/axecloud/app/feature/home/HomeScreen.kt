package br.com.axecloud.app.feature.home

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.com.axecloud.app.designsystem.component.AxeCloudBrand
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

@Composable
fun HomeRoute(
    onLogout: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeScreen(state, viewModel::load, onLogout)
}

@Composable
private fun HomeScreen(state: HomeUiState, onRetry: () -> Unit, onLogout: () -> Unit) {
    var selectedTab by rememberSaveable { mutableStateOf(HomeTab.INICIO) }
    Scaffold(
        containerColor = AxeCloudThemeTokens.Canvas,
        bottomBar = {
            if (!state.loading && state.error == null) {
                NavigationBar(containerColor = AxeCloudThemeTokens.ForestDeep) {
                    HomeTab.entries.forEach { tab ->
                        NavigationBarItem(
                            selected = selectedTab == tab,
                            onClick = { selectedTab = tab },
                            icon = { Icon(tab.icon, tab.label) },
                            label = { Text(tab.label, fontSize = 10.sp) },
                            colors = androidx.compose.material3.NavigationBarItemDefaults.colors(
                                selectedIconColor = AxeCloudThemeTokens.ForestDeep,
                                selectedTextColor = AxeCloudThemeTokens.Gold,
                                indicatorColor = AxeCloudThemeTokens.Gold,
                                unselectedIconColor = AxeCloudThemeTokens.Ivory.copy(alpha = .7f),
                                unselectedTextColor = AxeCloudThemeTokens.Ivory.copy(alpha = .7f),
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
    Box(Modifier.fillMaxSize().padding(padding).background(AxeCloudThemeTokens.Canvas)) {
        when {
            state.loading -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = AxeCloudThemeTokens.Forest)
            state.error != null -> ErrorState(state.error, onRetry, Modifier.align(Alignment.Center))
            selectedTab == HomeTab.INICIO -> HomeContent(state.snapshot, onLogout) { selectedTab = it }
            selectedTab == HomeTab.ROTINA -> JourneyScreen(state.snapshot)
            selectedTab == HomeTab.AGENDA -> FeedScreen("Agenda da casa", "Giras, festas e compromissos da corrente.", state.snapshot.eventItems, Icons.Outlined.CalendarMonth)
            selectedTab == HomeTab.AVISOS -> FeedScreen("Mural da casa", "Comunicados oficiais em um só lugar.", state.snapshot.noticeItems, Icons.Outlined.Notifications)
            else -> ProfileScreen(state.snapshot, onLogout)
        }
    }
    }
}

@Composable
private fun HomeContent(data: HomeSnapshot, onLogout: () -> Unit, onTab: (HomeTab) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AxeCloudBrand(modifier = Modifier.weight(1f))
                IconButton(onClick = { onTab(HomeTab.AVISOS) }) {
                    Icon(Icons.Outlined.Notifications, "Notificações", tint = AxeCloudThemeTokens.Forest)
                }
                IconButton(onClick = onLogout) {
                    Icon(Icons.Outlined.Logout, "Sair", tint = AxeCloudThemeTokens.Muted)
                }
            }
        }
        item { Hero(data) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricCard(data.primaryMetric, data.primaryLabel, Icons.Outlined.Groups, Modifier.weight(1f))
                MetricCard(data.secondaryMetric, data.secondaryLabel, Icons.Outlined.AccountBalanceWallet, Modifier.weight(1f))
            }
        }
        item { NextAction(data.nextAction) }
        item {
            Text("Sua casa em movimento", color = AxeCloudThemeTokens.Ink, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
            Text("Acesso direto ao que pede atenção hoje.", color = AxeCloudThemeTokens.Muted, fontSize = 13.sp)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QuickAccess("Agenda", "${data.events} evento(s)", Icons.Outlined.CalendarMonth, Modifier.weight(1f)) { onTab(HomeTab.AGENDA) }
                QuickAccess(if (data.isFilho) "Estudos" else "Corrente", if (data.isFilho) "Biblioteca da casa" else data.primaryLabel, if (data.isFilho) Icons.Outlined.MenuBook else Icons.Outlined.Groups, Modifier.weight(1f)) { }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QuickAccess("Financeiro", data.financialMessage, Icons.Outlined.AccountBalanceWallet, Modifier.weight(1f)) { }
                QuickAccess("Avisos", "${data.notices} publicado(s)", Icons.Outlined.Notifications, Modifier.weight(1f)) { onTab(HomeTab.AVISOS) }
            }
        }
        item { Spacer(Modifier.height(18.dp)) }
    }
}

@Composable
private fun Hero(data: HomeSnapshot) {
    Surface(shape = RoundedCornerShape(28.dp), color = Color.Transparent, shadowElevation = 8.dp) {
        Box(
            Modifier.fillMaxWidth().background(
                Brush.linearGradient(listOf(AxeCloudThemeTokens.ForestSoft, AxeCloudThemeTokens.ForestDeep))
            ).padding(24.dp)
        ) {
            Column {
                Text("AXÉCLOUD · SUA CORRENTE", color = AxeCloudThemeTokens.Gold, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Spacer(Modifier.height(22.dp))
                Text("Olá, ${data.greetingName}.", color = AxeCloudThemeTokens.Ivory, fontSize = 34.sp, fontWeight = FontWeight.Black)
                Text(data.houseName.ifBlank { "Gestão para terreiros" }, color = AxeCloudThemeTokens.Ivory.copy(alpha = .72f), fontSize = 14.sp)
                Spacer(Modifier.height(20.dp))
                Surface(color = AxeCloudThemeTokens.Gold, shape = RoundedCornerShape(50)) {
                    Text(if (data.isFilho) "Minha caminhada" else "Painel da casa", Modifier.padding(horizontal = 16.dp, vertical = 9.dp), color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun MetricCard(value: String, label: String, icon: ImageVector, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(20.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.padding(17.dp)) {
            Box(Modifier.size(36.dp).background(AxeCloudThemeTokens.Gold.copy(alpha = .18f), CircleShape), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = AxeCloudThemeTokens.Forest, modifier = Modifier.size(19.dp))
            }
            Spacer(Modifier.height(14.dp))
            Text(value, color = AxeCloudThemeTokens.ForestDeep, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
            Text(label, color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun NextAction(message: String) {
    Surface(shape = RoundedCornerShape(20.dp), color = AxeCloudThemeTokens.Forest) {
        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("PRÓXIMA AÇÃO", color = AxeCloudThemeTokens.Gold, fontWeight = FontWeight.Bold, fontSize = 10.sp, letterSpacing = 1.sp)
                Text(message, color = AxeCloudThemeTokens.Ivory, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.Gold)
        }
    }
}

@Composable
private fun QuickAccess(title: String, subtitle: String, icon: ImageVector, modifier: Modifier, onClick: () -> Unit) {
    Surface(modifier.clickable(onClick = onClick), shape = RoundedCornerShape(20.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.padding(16.dp)) {
            Icon(icon, null, tint = AxeCloudThemeTokens.ForestSoft)
            Spacer(Modifier.height(18.dp))
            Text(title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold)
            Text(subtitle, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, maxLines = 2)
        }
    }
}

@Composable
private fun FeedScreen(title: String, subtitle: String, items: List<HomeFeedItem>, icon: ImageVector) {
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("AXÉCLOUD · SUA CASA", color = AxeCloudThemeTokens.GoldStrong, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(title, color = AxeCloudThemeTokens.ForestDeep, fontSize = 30.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = AxeCloudThemeTokens.Muted, fontSize = 13.sp)
            Spacer(Modifier.height(10.dp))
        }
        if (items.isEmpty()) {
            item {
                Surface(shape = RoundedCornerShape(24.dp), color = AxeCloudThemeTokens.Forest) {
                    Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(icon, null, tint = AxeCloudThemeTokens.Gold, modifier = Modifier.size(34.dp))
                        Spacer(Modifier.height(12.dp))
                        Text("Tudo tranquilo por aqui", color = AxeCloudThemeTokens.Ivory, fontWeight = FontWeight.Bold)
                        Text("Quando houver novidades, elas aparecerão neste espaço.", color = AxeCloudThemeTokens.Ivory.copy(alpha = .65f), fontSize = 12.sp)
                    }
                }
            }
        } else items(items.size) { index ->
            val item = items[index]
            Surface(shape = RoundedCornerShape(18.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(42.dp).background(AxeCloudThemeTokens.Gold.copy(alpha = .18f), CircleShape), contentAlignment = Alignment.Center) { Icon(icon, null, tint = AxeCloudThemeTokens.Forest) }
                    Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                        Text(item.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold)
                        if (item.detail.isNotBlank()) Text(item.detail, color = AxeCloudThemeTokens.Muted, fontSize = 12.sp, maxLines = 2)
                    }
                    Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.Muted)
                }
            }
        }
    }
}

@Composable
private fun ProfileScreen(data: HomeSnapshot, onLogout: () -> Unit) {
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Text("MINHA CONTA", color = AxeCloudThemeTokens.GoldStrong, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(data.greetingName, color = AxeCloudThemeTokens.ForestDeep, fontSize = 30.sp, fontWeight = FontWeight.Black)
            Text(data.houseName, color = AxeCloudThemeTokens.Muted)
        }
        item {
            Surface(shape = RoundedCornerShape(24.dp), color = AxeCloudThemeTokens.Forest) {
                Column(Modifier.fillMaxWidth().padding(22.dp)) {
                    Text(if (data.isFilho) "FILHO(A) DE SANTO" else "GESTÃO DA CASA", color = AxeCloudThemeTokens.Gold, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("Sua identidade acompanha você em todo o AxéCloud.", color = AxeCloudThemeTokens.Ivory, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
            }
        }
        item {
            Button(onClick = onLogout, modifier = Modifier.fillMaxWidth().height(52.dp), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.ForestDeep)) {
                Icon(Icons.Outlined.Logout, null)
                Spacer(Modifier.size(8.dp))
                Text("Sair da conta")
            }
        }
    }
}

@Composable
private fun JourneyScreen(data: HomeSnapshot) {
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Text("SUA CAMINHADA", color = AxeCloudThemeTokens.GoldStrong, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(if (data.isFilho) "Fundamento que acompanha." else "A casa em profundidade.", color = AxeCloudThemeTokens.ForestDeep, fontSize = 28.sp, fontWeight = FontWeight.Black, lineHeight = 31.sp)
            Text("Preceitos, estudos e conversas conectados à rotina.", color = AxeCloudThemeTokens.Muted, fontSize = 13.sp)
        }
        item { JourneySection("Preceitos e obrigações", data.preceptItems, Icons.Outlined.CalendarMonth, "Nenhum preceito ativo") }
        item { JourneySection("Biblioteca de estudos", data.libraryItems, Icons.Outlined.MenuBook, "Nenhum material publicado") }
        item { JourneySection("Conversas da casa", data.conversationItems, Icons.Outlined.Notifications, "Nenhuma conversa iniciada") }
    }
}

@Composable
private fun JourneySection(title: String, items: List<HomeFeedItem>, icon: ImageVector, empty: String) {
    Surface(shape = RoundedCornerShape(22.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.fillMaxWidth().padding(17.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(38.dp).background(AxeCloudThemeTokens.Gold.copy(alpha = .18f), CircleShape), contentAlignment = Alignment.Center) { Icon(icon, null, tint = AxeCloudThemeTokens.Forest) }
                Text(title, Modifier.padding(start = 11.dp), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
            }
            if (items.isEmpty()) Text(empty, color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
            items.take(3).forEach { item ->
                Column(Modifier.fillMaxWidth().background(AxeCloudThemeTokens.Ivory, RoundedCornerShape(14.dp)).padding(12.dp)) {
                    Text(item.title, color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    if (item.detail.isNotBlank()) Text(item.detail, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, maxLines = 2)
                }
            }
        }
    }
}

private enum class HomeTab(val label: String, val icon: ImageVector) {
    INICIO("Início", Icons.Outlined.Home),
    ROTINA("Rotina", Icons.Outlined.MenuBook),
    AGENDA("Agenda", Icons.Outlined.CalendarMonth),
    AVISOS("Avisos", Icons.Outlined.Notifications),
    PERFIL("Perfil", Icons.Outlined.Person),
}

@Composable
private fun ErrorState(message: String, retry: () -> Unit, modifier: Modifier) {
    Column(modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Não foi possível abrir sua casa", color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
        Spacer(Modifier.height(8.dp))
        Text(message, color = AxeCloudThemeTokens.Muted)
        Spacer(Modifier.height(16.dp))
        Button(onClick = retry, colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) {
            Icon(Icons.Outlined.Refresh, null)
            Spacer(Modifier.size(8.dp))
            Text("Tentar novamente")
        }
    }
}
