package br.com.axecloud.app.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.Canvas
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Timeline
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.PlayCircle
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material.icons.outlined.StopCircle
import androidx.compose.material.icons.outlined.VolunteerActivism
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Scaffold
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.painterResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.Lifecycle
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import br.com.axecloud.app.core.ui.NativeAudioPlayer
import br.com.axecloud.app.core.ui.NativeVideoPlayer
import br.com.axecloud.app.feature.children.ChildrenRoute
import br.com.axecloud.app.feature.frequency.FrequencyRoute
import br.com.axecloud.app.feature.finance.FinanceRoute
import br.com.axecloud.app.feature.giras.GirasRoute
import br.com.axecloud.app.feature.gallery.GalleryRoute
import br.com.axecloud.app.feature.care.CareRoute
import br.com.axecloud.app.feature.store.StoreRoute
import br.com.axecloud.app.feature.settings.SettingsRoute
import br.com.axecloud.app.feature.support.SupportRoute
import br.com.axecloud.app.feature.foundations.FoundationRoute
import br.com.axecloud.app.feature.childprofile.ChildProfileRoute
import br.com.axecloud.app.feature.inventory.InventoryRoute
import br.com.axecloud.app.feature.library.LibraryRoute
import br.com.axecloud.app.feature.notices.NoticesRoute
import br.com.axecloud.app.feature.notifications.NotificationInbox
import br.com.axecloud.app.feature.notifications.nativeUnreadCount
import br.com.axecloud.app.feature.precepts.PreceptRoute
import android.graphics.Bitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import coil.compose.AsyncImage
import android.net.Uri
import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import br.com.axecloud.app.R
import kotlinx.coroutines.launch

@Composable
fun HomeRoute(
    onLogout: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val interaction by viewModel.interaction.collectAsStateWithLifecycle()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME){viewModel.refreshIfStale()}
    HomeScreen(
        state = state,
        interaction = interaction,
        onRetry = viewModel::load,
        onLogout = onLogout,
        onAcknowledge = viewModel::acknowledgePrecept,
        onGuidance = viewModel::requestGuidance,
        onOpenConversation = viewModel::openConversation,
        onCloseConversation = viewModel::closeConversation,
        onSendMessage = viewModel::sendMessage,
        onSendMedia = viewModel::sendMedia,
        onSettleMonthly = viewModel::settleMonthlyPayment,
        onCreateEvent = viewModel::createEvent,
        onPrayerStatus = viewModel::updatePrayerStatus,
        onCreateAlbum = viewModel::createAlbum,
        onAddInventory = viewModel::addInventoryItem,
        onAddProduct = viewModel::addStoreProduct,
        onUploadProfilePhoto = viewModel::uploadProfilePhoto,
        onValidatePaymentReceipt = viewModel::validatePaymentReceipt,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeScreen(
    state: HomeUiState,
    interaction: InteractionUiState,
    onRetry: () -> Unit,
    onLogout: () -> Unit,
    onAcknowledge: (String) -> Unit,
    onGuidance: (String) -> Unit,
    onOpenConversation: (String, String) -> Unit,
    onCloseConversation: () -> Unit,
    onSendMessage: (String) -> Unit,
    onSendMedia: (Uri) -> Unit,
    onSettleMonthly: (HomeFeedItem) -> Unit,
    onCreateEvent: (String, String, String, String, String) -> Unit,
    onPrayerStatus: (HomeFeedItem, String) -> Unit,
    onCreateAlbum: (String, String) -> Unit,
    onAddInventory: (String, String, String, String) -> Unit,
    onAddProduct: (String, String, String, String) -> Unit,
    onUploadProfilePhoto: (Uri) -> Unit,
    onValidatePaymentReceipt: (Uri) -> Unit,
) {
    var selectedTab by rememberSaveable { mutableStateOf(HomeTab.INICIO) }
    var notificationsOpen by rememberSaveable { mutableStateOf(false) }
    val context = LocalContext.current
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val hasLoadedContent = state.snapshot.houseName.isNotBlank() || state.snapshot.greetingName.isNotBlank()
    val chromeVisible = state.error == null && interaction.conversationId == null && (!state.loading || hasLoadedContent)

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = chromeVisible,
        drawerContent = {
            AppDrawer(
                data = state.snapshot,
                selectedTab = selectedTab,
                onSelect = { tab ->
                    selectedTab = tab
                    scope.launch { drawerState.close() }
                },
                onLogout = onLogout,
            )
        },
    ) {
        Scaffold(
            containerColor = AxeCloudThemeTokens.Canvas,
            topBar = {
                if (chromeVisible) {
                    NativeTopBar(
                        data = state.snapshot,
                        selectedTab = selectedTab,
                        onAvatarClick = { scope.launch { drawerState.open() } },
                        notificationCount = nativeUnreadCount(context, state.snapshot),
                        onNotifications = { notificationsOpen = true },
                        onRefresh = onRetry,
                    )
                }
            },
            bottomBar = {
                if (chromeVisible) {
                    NavigationBar(containerColor = AxeCloudThemeTokens.ForestDeep) {
                        HomeTab.entries.filter { it.showInNavigation && it.allowedFor(state.snapshot.isFilho) }.forEach { tab ->
                            NavigationBarItem(
                                selected = selectedTab == tab,
                                onClick = { selectedTab = tab },
                                icon = { Icon(tab.icon, drawerLabel(tab, state.snapshot.isFilho)) },
                                label = { Text(drawerLabel(tab, state.snapshot.isFilho), fontSize = 10.sp, maxLines = 1) },
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
                    state.loading && !hasLoadedContent -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = AxeCloudThemeTokens.Forest)
                    state.error != null -> ErrorState(state.error, onRetry, Modifier.align(Alignment.Center))
                    interaction.conversationId != null -> ChatScreen(interaction, onCloseConversation, onSendMessage, onSendMedia)
                    else -> AnimatedContent(
                        targetState = selectedTab,
                        transitionSpec = { fadeIn() togetherWith fadeOut() },
                        label = "home-module-transition",
                    ) { tab ->
                        when (tab) {
                            HomeTab.INICIO -> HomeContent(state.snapshot) { selectedTab = it }
                            HomeTab.ROTINA -> if (state.snapshot.isFilho) NativeJourneyScreen(
                                data = state.snapshot,
                                interaction = interaction,
                                onAcknowledge = onAcknowledge,
                                onGuidance = onGuidance,
                                onOpenConversation = onOpenConversation,
                            ) else PreceptRoute()
                            HomeTab.AGENDA -> GirasRoute()
                            HomeTab.AVISOS -> NoticesRoute()
                            HomeTab.FINANCEIRO -> if (state.snapshot.isFilho) NativeFinanceScreen(state.snapshot, interaction, onSettleMonthly, onValidatePaymentReceipt) else FinanceRoute()
                            HomeTab.FILHOS -> ChildrenRoute()
                            HomeTab.FREQUENCIA -> FrequencyRoute()
                            HomeTab.ALMOXARIFADO -> InventoryRoute()
                            HomeTab.BIBLIOTECA -> LibraryRoute()
                            HomeTab.GALERIA -> GalleryRoute()
                            HomeTab.ATENDIMENTOS -> CareRoute()
                            HomeTab.LOJA -> StoreRoute()
                            HomeTab.FUNDAMENTOS -> FoundationRoute()
                            HomeTab.GESTAO -> if (!state.snapshot.isFilho) SettingsRoute() else NativeManagementScreen(
                                data = state.snapshot,
                                interaction = interaction,
                                onPrayerStatus = onPrayerStatus,
                                onCreateAlbum = onCreateAlbum,
                                onAddInventory = onAddInventory,
                                onAddProduct = onAddProduct,
                            )
                            HomeTab.SUPORTE -> SupportRoute()
                            HomeTab.PERFIL -> if (state.snapshot.isFilho) ChildProfileRoute() else NativeProfileScreen(state.snapshot, interaction, onUploadProfilePhoto, onLogout)
                        }
                    }
                }
                if (state.loading && hasLoadedContent) {
                    androidx.compose.material3.LinearProgressIndicator(
                        modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
                        color = AxeCloudThemeTokens.Forest,
                        trackColor = AxeCloudThemeTokens.Gold.copy(alpha = .2f),
                    )
                }
                AnimatedVisibility(state.offline,modifier=Modifier.align(Alignment.TopCenter),enter=fadeIn(),exit=fadeOut()){
                    Surface(shape=RoundedCornerShape(bottomStart=18.dp,bottomEnd=18.dp),color=Color(0xFF7A3E2E),shadowElevation=6.dp){Row(Modifier.padding(horizontal=16.dp,vertical=9.dp),verticalAlignment=Alignment.CenterVertically){Icon(Icons.Outlined.WarningAmber,null,tint=Color.White,modifier=Modifier.size(18.dp));Spacer(Modifier.width(7.dp));Text("Sem internet · mostrando o que já estava na tela",color=Color.White,fontSize=11.sp,fontWeight=FontWeight.Bold)}}
                }
            }
        }
    }
    if (notificationsOpen) {
        NotificationInbox(
            data = state.snapshot,
            onDismiss = { notificationsOpen = false },
            onNavigate = { target ->
                selectedTab = when (target) {
                    "finance" -> HomeTab.FINANCEIRO
                    "management" -> HomeTab.GESTAO
                    "routine" -> HomeTab.ROTINA
                    "agenda" -> HomeTab.AGENDA
                    "notices" -> HomeTab.AVISOS
                    else -> HomeTab.INICIO
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NativeTopBar(
    data: HomeSnapshot,
    selectedTab: HomeTab,
    notificationCount: Int,
    onAvatarClick: () -> Unit,
    onNotifications: () -> Unit,
    onRefresh: () -> Unit,
) {
    TopAppBar(
        navigationIcon = {
            IconButton(onClick = onAvatarClick, modifier = Modifier.padding(start = 8.dp)) {
                HouseAvatar(data.profilePhotoUrl, 38.dp)
            }
        },
        title = {
            Column {
                Text(drawerLabel(selectedTab, data.isFilho), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp)
                Text(data.houseName.ifBlank { "AxéCloud" }, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, maxLines = 1)
            }
        },
        actions = {
            IconButton(onClick = onRefresh) {
                Icon(Icons.Outlined.Refresh, "Atualizar", tint = AxeCloudThemeTokens.Forest)
            }
            IconButton(onClick = onNotifications) {
                BadgedBox(
                    badge = {
                        if (notificationCount > 0) {
                            Badge(containerColor = AxeCloudThemeTokens.Gold, contentColor = AxeCloudThemeTokens.ForestDeep) {
                                Text(notificationCount.coerceAtMost(99).toString(), fontSize = 9.sp, fontWeight = FontWeight.Black)
                            }
                        }
                    },
                ) { Icon(Icons.Outlined.Notifications, "Notificações", tint = AxeCloudThemeTokens.Forest) }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = AxeCloudThemeTokens.Canvas),
    )
}

@Composable
private fun AppDrawer(
    data: HomeSnapshot,
    selectedTab: HomeTab,
    onSelect: (HomeTab) -> Unit,
    onLogout: () -> Unit,
) {
    ModalDrawerSheet(
        modifier = Modifier.width(312.dp),
        drawerContainerColor = AxeCloudThemeTokens.ForestDeep,
        drawerContentColor = AxeCloudThemeTokens.Ivory,
    ) {
        Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 26.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                HouseAvatar(data.profilePhotoUrl, 58.dp)
                Column(Modifier.weight(1f)) {
                    Text(data.houseName.ifBlank { "Minha casa" }, color = AxeCloudThemeTokens.Ivory, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, maxLines = 2)
                    Text(if (data.isFilho) "Filho de santo" else "Gestão do terreiro", color = AxeCloudThemeTokens.Gold, fontSize = 12.sp)
                }
            }
            HorizontalDivider(color = AxeCloudThemeTokens.Ivory.copy(alpha = .12f))
            Spacer(Modifier.height(12.dp))
            Text("NAVEGAÇÃO", Modifier.padding(horizontal = 16.dp, vertical = 8.dp), color = AxeCloudThemeTokens.Ivory.copy(alpha = .55f), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            LazyColumn(Modifier.weight(1f)) {
                HomeTab.entries.filter { it.allowedFor(data.isFilho) }.forEach { tab -> item {
                    NavigationDrawerItem(
                    label = { Text(drawerLabel(tab, data.isFilho), fontWeight = if (selectedTab == tab) FontWeight.Bold else FontWeight.Medium) },
                    selected = selectedTab == tab,
                    onClick = { onSelect(tab) },
                    icon = { Icon(tab.icon, null) },
                    badge = { Icon(Icons.Outlined.ChevronRight, null, modifier = Modifier.size(16.dp)) },
                    modifier = Modifier.padding(vertical = 2.dp),
                    colors = NavigationDrawerItemDefaults.colors(
                        selectedContainerColor = AxeCloudThemeTokens.Gold,
                        selectedIconColor = AxeCloudThemeTokens.ForestDeep,
                        selectedTextColor = AxeCloudThemeTokens.ForestDeep,
                        selectedBadgeColor = AxeCloudThemeTokens.ForestDeep,
                        unselectedContainerColor = Color.Transparent,
                        unselectedIconColor = AxeCloudThemeTokens.Ivory.copy(alpha = .72f),
                        unselectedTextColor = AxeCloudThemeTokens.Ivory.copy(alpha = .82f),
                        unselectedBadgeColor = AxeCloudThemeTokens.Ivory.copy(alpha = .35f),
                    ),
                    )
                } }
            }
            HorizontalDivider(color = AxeCloudThemeTokens.Ivory.copy(alpha = .12f))
            NavigationDrawerItem(
                label = { Text("Sair da conta") },
                selected = false,
                onClick = onLogout,
                icon = { Icon(Icons.Outlined.Logout, null) },
                modifier = Modifier.padding(vertical = 14.dp),
                colors = NavigationDrawerItemDefaults.colors(
                    unselectedContainerColor = Color.Transparent,
                    unselectedIconColor = AxeCloudThemeTokens.Gold,
                    unselectedTextColor = AxeCloudThemeTokens.Ivory,
                ),
            )
        }
    }
}

@Composable
private fun HouseAvatar(photoUrl: String, size: androidx.compose.ui.unit.Dp) {
    Surface(
        modifier = Modifier.size(size),
        shape = CircleShape,
        color = AxeCloudThemeTokens.Forest,
        border = androidx.compose.foundation.BorderStroke(2.dp, AxeCloudThemeTokens.Gold),
    ) {
        if (photoUrl.isNotBlank()) {
            AsyncImage(model = photoUrl, contentDescription = "Foto da casa", contentScale = ContentScale.Crop)
        } else {
            Icon(
                painter = painterResource(R.drawable.ic_axecloud_mark),
                contentDescription = "Menu da casa",
                tint = Color.Unspecified,
                modifier = Modifier.padding(size * .16f),
            )
        }
    }
}

private fun drawerLabel(tab: HomeTab, isFilho: Boolean): String = when (tab) {
    HomeTab.INICIO -> "Início"
    HomeTab.ROTINA -> if (isFilho) "Obrigações" else "Preceitos"
    HomeTab.AGENDA -> "Agenda e giras"
    HomeTab.AVISOS -> "Avisos"
    HomeTab.PERFIL -> "Perfil e conta"
    HomeTab.FINANCEIRO -> "Financeiro"
    HomeTab.FILHOS -> "Filhos de Santo"
    HomeTab.FREQUENCIA -> "Frequência"
    HomeTab.ALMOXARIFADO -> "Almoxarifado"
    HomeTab.BIBLIOTECA -> "Biblioteca"
    HomeTab.GALERIA -> "Galeria"
    HomeTab.ATENDIMENTOS -> "Atendimentos"
    HomeTab.LOJA -> "Loja do Axé"
    HomeTab.FUNDAMENTOS -> "Fundamentos"
    HomeTab.GESTAO -> if (isFilho) "Espaços da casa" else "Configurações"
    HomeTab.SUPORTE -> "Suporte AxéCloud"
}

@Composable
private fun HomeContent(data: HomeSnapshot, onTab: (HomeTab) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
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
                QuickAccess(if (data.isFilho) "Estudos" else "Gestão", if (data.isFilho) "Biblioteca da casa" else "Estoque e atendimentos", if (data.isFilho) Icons.Outlined.MenuBook else Icons.Outlined.Groups, Modifier.weight(1f)) { onTab(if (data.isFilho) HomeTab.ROTINA else HomeTab.GESTAO) }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QuickAccess("Financeiro", data.financialMessage, Icons.Outlined.AccountBalanceWallet, Modifier.weight(1f)) { onTab(HomeTab.FINANCEIRO) }
                QuickAccess("Avisos", "${data.notices} publicado(s)", Icons.Outlined.Notifications, Modifier.weight(1f)) { onTab(HomeTab.AVISOS) }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QuickAccess("Galeria", "${data.galleryItems.size} álbum(ns)", Icons.Outlined.PhotoLibrary, Modifier.weight(1f)) { onTab(HomeTab.GALERIA) }
                QuickAccess("Loja", "${data.storeItems.size} produto(s)", Icons.Outlined.Storefront, Modifier.weight(1f)) { onTab(HomeTab.LOJA) }
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
            ModuleHero(
                eyebrow = "A VOZ OFICIAL DA CASA",
                title = "Recados que mantêm a corrente próxima.",
                subtitle = subtitle,
                icon = icon,
                background = Color(0xFF33251D),
                accent = Color(0xFFFFB36B),
            )
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
private fun AgendaScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onCreate: (String, String, String, String, String) -> Unit,
) {
    var formOpen by rememberSaveable { mutableStateOf(false) }
    var title by rememberSaveable { mutableStateOf("") }
    var date by rememberSaveable { mutableStateOf("") }
    var time by rememberSaveable { mutableStateOf("") }
    var type by rememberSaveable { mutableStateOf("Gira") }
    var description by rememberSaveable { mutableStateOf("") }
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ModuleHero(
                eyebrow = "CENTRAL DE OPERAÇÃO RITUAL",
                title = "O tempo da casa também é fundamento.",
                subtitle = "Giras, festas e compromissos organizados sem perder o sentido.",
                icon = Icons.Outlined.CalendarMonth,
                background = Color(0xFF18241D),
                accent = AxeCloudThemeTokens.Gold,
            )
            if (!data.isFilho) Button(onClick = { formOpen = !formOpen }, modifier = Modifier.padding(top = 10.dp), colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Text(if (formOpen) "Fechar criação" else "+ Criar movimento") }
        }
        interaction.feedback?.let { message -> item { Surface(shape = RoundedCornerShape(14.dp), color = AxeCloudThemeTokens.Gold.copy(alpha = .2f)) { Text(message, Modifier.padding(13.dp), color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Bold) } } }
        item {
            AnimatedVisibility(formOpen && !data.isFilho) {
                Surface(shape = RoundedCornerShape(22.dp), color = AxeCloudThemeTokens.Forest) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Criar movimento", color = AxeCloudThemeTokens.Gold, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                        EventField(title, { title = it }, "Nome da gira")
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            EventField(date, { date = it.take(10) }, "AAAA-MM-DD", Modifier.weight(1f))
                            EventField(time, { time = it.take(5) }, "HH:MM", Modifier.weight(1f))
                        }
                        EventField(type, { type = it }, "Tipo")
                        EventField(description, { description = it }, "Orientações ou descrição")
                        Button(
                            onClick = { onCreate(title, date, time, type, description) },
                            enabled = interaction.actionInProgress == null,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Gold, contentColor = AxeCloudThemeTokens.ForestDeep),
                        ) { Text("Criar gira", fontWeight = FontWeight.Bold) }
                    }
                }
            }
        }
        if (data.eventItems.isEmpty()) item { EmptyFinanceCard("A agenda está livre. Quando uma gira for marcada, ela aparecerá aqui.") }
        items(data.eventItems.size) { index ->
            val item = data.eventItems[index]
            Surface(shape = RoundedCornerShape(20.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(46.dp).background(AxeCloudThemeTokens.Gold.copy(alpha = .18f), CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.CalendarMonth, null, tint = AxeCloudThemeTokens.Forest) }
                    Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                        Text(item.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold)
                        Text(item.detail.ifBlank { "Data a confirmar" }, color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
                    }
                    Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.GoldStrong)
                }
            }
        }
    }
}

@Composable
private fun EventField(value: String, onChange: (String) -> Unit, label: String, modifier: Modifier = Modifier.fillMaxWidth()) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = modifier,
        placeholder = { Text(label) },
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = AxeCloudThemeTokens.Surface,
            unfocusedContainerColor = AxeCloudThemeTokens.Surface,
            focusedTextColor = AxeCloudThemeTokens.Ink,
            unfocusedTextColor = AxeCloudThemeTokens.Ink,
        ),
    )
}

@Composable
private fun ProfileScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onUploadPhoto: (Uri) -> Unit,
    onLogout: () -> Unit,
) {
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) onUploadPhoto(uri)
    }
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            ModuleHero(
                eyebrow = "IDENTIDADE NA CORRENTE",
                title = data.greetingName,
                subtitle = data.houseName.ifBlank { "Sua presença dentro do AxéCloud." },
                icon = Icons.Outlined.Person,
                background = Color(0xFF182139),
                accent = Color(0xFF91B5FF),
            )
        }
        interaction.feedback?.let { message ->
            item { Surface(shape = RoundedCornerShape(14.dp), color = AxeCloudThemeTokens.Gold.copy(alpha = .2f)) { Text(message, Modifier.padding(13.dp), color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Bold) } }
        }
        item {
            Surface(shape = RoundedCornerShape(24.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
                Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (data.profilePhotoUrl.isNotBlank()) {
                        AsyncImage(
                            model = data.profilePhotoUrl,
                            contentDescription = "Foto de perfil",
                            modifier = Modifier.size(72.dp).clip(CircleShape),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Box(Modifier.size(72.dp).background(AxeCloudThemeTokens.Forest, CircleShape), contentAlignment = Alignment.Center) {
                            Icon(Icons.Outlined.Person, null, tint = AxeCloudThemeTokens.Gold, modifier = Modifier.size(34.dp))
                        }
                    }
                    Column(Modifier.weight(1f).padding(start = 14.dp)) {
                        Text("Foto de identificação", color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold)
                        Text("Usada no perfil e nas conversas da casa.", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
                        if (data.isFilho) {
                            OutlinedButton(
                                onClick = { photoPicker.launch("image/*") },
                                enabled = interaction.actionInProgress == null,
                                modifier = Modifier.padding(top = 8.dp),
                            ) { Text("Trocar foto", fontSize = 11.sp) }
                        }
                    }
                }
            }
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
private fun JourneyScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onAcknowledge: (String) -> Unit,
    onGuidance: (String) -> Unit,
    onOpenConversation: (String, String) -> Unit,
) {
    val uriHandler = LocalUriHandler.current
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            ModuleHero(
                eyebrow = "CADERNO DE FUNDAMENTO",
                title = if (data.isFilho) "Conhecimento que acompanha a caminhada." else "Memória viva, acesso responsável.",
                subtitle = "Preceitos, estudos e conversas reunidos com contexto.",
                icon = Icons.Outlined.MenuBook,
                background = Color(0xFF3C3022),
                accent = Color(0xFFE7B959),
            )
        }
        interaction.feedback?.let { message ->
            item {
                Surface(shape = RoundedCornerShape(16.dp), color = AxeCloudThemeTokens.Gold.copy(alpha = .24f)) {
                    Text(message, Modifier.fillMaxWidth().padding(14.dp), color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                }
            }
        }
        item {
            JourneySection(
                title = "Preceitos e obrigações",
                items = data.preceptItems,
                icon = Icons.Outlined.CalendarMonth,
                empty = "Nenhum preceito ativo",
                actionInProgress = interaction.actionInProgress,
                primaryAction = if (data.isFilho) "Estou ciente" else null,
                secondaryAction = if (data.isFilho) "Pedir orientação" else null,
                onPrimary = { onAcknowledge(it.id) },
                onSecondary = { onGuidance(it.id) },
            )
        }
        item {
            JourneySection(
                title = "Biblioteca de estudos",
                items = data.libraryItems,
                icon = Icons.Outlined.MenuBook,
                empty = "Nenhum material publicado",
                onClick = { item -> if (item.url.isNotBlank()) uriHandler.openUri(item.url) },
            )
        }
        item {
            JourneySection(
                title = "Conversas da casa",
                items = data.conversationItems,
                icon = Icons.Outlined.Notifications,
                empty = "Nenhuma conversa iniciada",
                onClick = { item -> if (item.id.isNotBlank()) onOpenConversation(item.id, item.title) },
            )
        }
    }
}

@Composable
private fun JourneySection(
    title: String,
    items: List<HomeFeedItem>,
    icon: ImageVector,
    empty: String,
    actionInProgress: String? = null,
    primaryAction: String? = null,
    secondaryAction: String? = null,
    onClick: (HomeFeedItem) -> Unit = {},
    onPrimary: (HomeFeedItem) -> Unit = {},
    onSecondary: (HomeFeedItem) -> Unit = {},
) {
    Surface(shape = RoundedCornerShape(22.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.fillMaxWidth().padding(17.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(38.dp).background(AxeCloudThemeTokens.Gold.copy(alpha = .18f), CircleShape), contentAlignment = Alignment.Center) { Icon(icon, null, tint = AxeCloudThemeTokens.Forest) }
                Text(title, Modifier.padding(start = 11.dp), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
            }
            if (items.isEmpty()) Text(empty, color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
            items.take(5).forEach { item ->
                Column(
                    Modifier.fillMaxWidth()
                        .background(AxeCloudThemeTokens.Ivory, RoundedCornerShape(14.dp))
                        .clickable { onClick(item) }
                        .padding(12.dp)
                ) {
                    Text(item.title, color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    if (item.detail.isNotBlank()) Text(item.detail, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, maxLines = 2)
                    if (item.status.isNotBlank()) Text(item.status.replace('_', ' ').uppercase(), color = AxeCloudThemeTokens.GoldStrong, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    if (primaryAction != null && item.status.lowercase() != "ciente") {
                        Row(Modifier.fillMaxWidth().padding(top = 9.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = { onPrimary(item) },
                                enabled = actionInProgress == null,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest),
                            ) { Text(primaryAction, fontSize = 10.sp) }
                            if (secondaryAction != null) {
                                OutlinedButton(
                                    onClick = { onSecondary(item) },
                                    enabled = actionInProgress == null,
                                    modifier = Modifier.weight(1f),
                                ) { Text(secondaryAction, fontSize = 9.sp, maxLines = 1) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatScreen(
    state: InteractionUiState,
    onBack: () -> Unit,
    onSend: (String) -> Unit,
    onSendMedia: (Uri) -> Unit,
) {
    BackHandler(onBack = onBack)
    var draft by rememberSaveable(state.conversationId) { mutableStateOf("") }
    val chatContext = LocalContext.current
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var recordingFile by remember { mutableStateOf<java.io.File?>(null) }
    var isRecording by remember { mutableStateOf(false) }
    val mediaPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> if (uri != null) onSendMedia(uri) }
    val startRecording = {
        runCatching {
            val file = java.io.File.createTempFile("axecloud-voz-", ".m4a", chatContext.cacheDir)
            val mediaRecorder = MediaRecorder().apply { setAudioSource(MediaRecorder.AudioSource.MIC); setOutputFormat(MediaRecorder.OutputFormat.MPEG_4); setAudioEncoder(MediaRecorder.AudioEncoder.AAC); setAudioEncodingBitRate(96_000); setAudioSamplingRate(44_100); setOutputFile(file.absolutePath); prepare(); start() }
            recordingFile = file; recorder = mediaRecorder; isRecording = true
        }
    }
    val audioPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> if (granted) startRecording() }
    DisposableEffect(Unit) { onDispose { runCatching { recorder?.release() }; recorder = null } }
    Column(Modifier.fillMaxSize().background(AxeCloudThemeTokens.Canvas)) {
        Row(
            Modifier.fillMaxWidth().background(AxeCloudThemeTokens.Forest).padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowBack, "Voltar", tint = AxeCloudThemeTokens.Ivory) }
            Column(Modifier.weight(1f)) {
                Text(state.conversationTitle, color = AxeCloudThemeTokens.Ivory, fontWeight = FontWeight.ExtraBold)
                Text("Conversa protegida da casa", color = AxeCloudThemeTokens.Ivory.copy(alpha = .65f), fontSize = 11.sp)
            }
        }
        if (state.loadingMessages) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AxeCloudThemeTokens.Forest)
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (state.messages.isEmpty()) item { Text("Comece a conversa por aqui.", color = AxeCloudThemeTokens.Muted) }
                items(state.messages.size) { index ->
                    val message = state.messages[index]
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (message.isOwn) Arrangement.End else Arrangement.Start) {
                        Surface(
                            color = if (message.isOwn) AxeCloudThemeTokens.Gold else AxeCloudThemeTokens.ForestDeep,
                            shape = RoundedCornerShape(18.dp),
                            modifier = Modifier.fillMaxWidth(.78f),
                        ) {
                            Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                                if (!message.isOwn) Text(message.senderName, color = AxeCloudThemeTokens.Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                if (message.mediaType == "image" && message.mediaUrl.isNotBlank()) {
                                    AsyncImage(message.mediaUrl, "Imagem enviada", Modifier.fillMaxWidth().heightIn(max = 260.dp).clip(RoundedCornerShape(13.dp)), contentScale = ContentScale.Crop)
                                    if (message.body.isNotBlank() && message.body != "Imagem") Text(message.body, color = if (message.isOwn) AxeCloudThemeTokens.ForestDeep else AxeCloudThemeTokens.Ivory, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
                                } else if (message.mediaType == "audio" && message.mediaUrl.isNotBlank()) {
                                    NativeAudioPlayer(message.mediaUrl, ownMessage = message.isOwn)
                                } else if (message.mediaType == "video" && message.mediaUrl.isNotBlank()) {
                                    NativeVideoPlayer(message.mediaUrl, Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(13.dp)))
                                } else if (message.mediaType != "text") {
                                    Row(verticalAlignment = Alignment.CenterVertically) { Icon(if(message.mediaType=="audio") Icons.Outlined.Mic else Icons.Outlined.PlayCircle, null, tint = if(message.isOwn) AxeCloudThemeTokens.ForestDeep else AxeCloudThemeTokens.Gold); Spacer(Modifier.width(7.dp));Text(if(message.mediaType=="audio")"Áudio indisponível" else "Vídeo indisponível", color = if (message.isOwn) AxeCloudThemeTokens.ForestDeep else AxeCloudThemeTokens.Ivory, fontWeight = FontWeight.Bold) }
                                } else Text(message.body, color = if (message.isOwn) AxeCloudThemeTokens.ForestDeep else AxeCloudThemeTokens.Ivory, fontSize = 14.sp)
                                Text(message.createdAt.take(16).replace('T', ' '), color = if (message.isOwn) AxeCloudThemeTokens.ForestDeep.copy(alpha = .6f) else AxeCloudThemeTokens.Ivory.copy(alpha = .5f), fontSize = 9.sp, modifier = Modifier.align(Alignment.End))
                            }
                        }
                    }
                }
            }
        }
        state.feedback?.let { Text(it, Modifier.padding(horizontal = 16.dp), color = AxeCloudThemeTokens.Error, fontSize = 11.sp) }
        Row(Modifier.fillMaxWidth().background(AxeCloudThemeTokens.Surface).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { mediaPicker.launch(arrayOf("image/*", "video/*", "audio/*")) }, enabled = !state.sendingMessage) { Icon(Icons.Outlined.AttachFile, "Enviar mídia", tint = AxeCloudThemeTokens.Forest) }
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it.take(2000) },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Digite sua mensagem...") },
                shape = RoundedCornerShape(18.dp),
                maxLines = 4,
            )
            IconButton(
                onClick = { onSend(draft); draft = "" },
                enabled = draft.isNotBlank() && !state.sendingMessage,
            ) {
                if (state.sendingMessage) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                else Icon(Icons.Outlined.Send, "Enviar", tint = AxeCloudThemeTokens.Forest)
            }
            IconButton(onClick = {
                if (isRecording) { runCatching { recorder?.stop() }; recorder?.release(); recorder = null; isRecording = false; recordingFile?.let { onSendMedia(Uri.fromFile(it)) } }
                else if (ContextCompat.checkSelfPermission(chatContext, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startRecording() else audioPermission.launch(Manifest.permission.RECORD_AUDIO)
            }, enabled = !state.sendingMessage) { Icon(if(isRecording) Icons.Outlined.StopCircle else Icons.Outlined.Mic, if(isRecording)"Parar e enviar" else "Gravar áudio", tint=if(isRecording)AxeCloudThemeTokens.Error else AxeCloudThemeTokens.Forest) }
        }
    }
}

@Composable
private fun FinanceScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onSettle: (HomeFeedItem) -> Unit,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)
    val clipboard = LocalClipboardManager.current
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowBack, "Voltar", tint = AxeCloudThemeTokens.Forest) }
            ModuleHero(
                eyebrow = "LIVRO CAIXA DA CASA",
                title = if (data.isFilho) "Contribuir também é sustentar." else "Clareza para cuidar do que mantém a casa.",
                subtitle = if (data.isFilho) "Mensalidade, PIX e histórico em um fluxo simples." else "Pendências e recebimentos com leitura imediata.",
                icon = Icons.Outlined.AccountBalanceWallet,
                background = Color(0xFF0E2A20),
                accent = Color(0xFF55D69A),
            )
        }
        interaction.feedback?.let { message ->
            item { Surface(shape = RoundedCornerShape(15.dp), color = AxeCloudThemeTokens.Gold.copy(alpha = .2f)) { Text(message, Modifier.padding(14.dp), color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Bold) } }
        }
        if (data.isFilho) {
            when {
                !data.monthlyActive -> item { EmptyFinanceCard("Seu terreiro não utiliza cobrança mensal no momento.") }
                data.pixPayload.isBlank() -> item { EmptyFinanceCard("A casa ainda não configurou uma chave PIX para mensalidades.") }
                else -> {
                    item {
                        Surface(shape = RoundedCornerShape(26.dp), color = AxeCloudThemeTokens.Forest) {
                            Column(Modifier.fillMaxWidth().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("PAGAMENTO VIA PIX", color = AxeCloudThemeTokens.Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                                Text(data.monthlyValue.asMoney(), color = AxeCloudThemeTokens.Ivory, fontSize = 34.sp, fontWeight = FontWeight.Black)
                                Text("Vencimento: dia ${data.monthlyDueDay}", color = AxeCloudThemeTokens.Ivory.copy(alpha = .65f), fontSize = 12.sp)
                                Spacer(Modifier.height(18.dp))
                                Surface(shape = RoundedCornerShape(18.dp), color = Color.White) {
                                    QrCode(data.pixPayload, Modifier.padding(12.dp).size(210.dp))
                                }
                                Spacer(Modifier.height(16.dp))
                                Text(data.pixBeneficiary, color = AxeCloudThemeTokens.Ivory, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(12.dp))
                                Button(
                                    onClick = { clipboard.setText(AnnotatedString(data.pixPayload)) },
                                    modifier = Modifier.fillMaxWidth().height(50.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Gold, contentColor = AxeCloudThemeTokens.ForestDeep),
                                ) { Text("Copiar PIX copia e cola", fontWeight = FontWeight.Bold) }
                            }
                        }
                    }
                    item { Text("Depois do pagamento, envie o comprovante na conversa com a casa até ativarmos a validação direta de imagem no aplicativo.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp) }
                }
            }
        } else {
            if (data.monthlyItems.isEmpty()) item { EmptyFinanceCard("Nenhuma mensalidade pendente.") }
            items(data.monthlyItems.size) { index ->
                val item = data.monthlyItems[index]
                Surface(shape = RoundedCornerShape(18.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(item.title, color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Bold)
                            Text(item.detail, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp)
                            Text(item.amount.asMoney(), color = AxeCloudThemeTokens.Forest, fontWeight = FontWeight.ExtraBold)
                        }
                        Button(
                            onClick = { onSettle(item) },
                            enabled = interaction.actionInProgress == null,
                            colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest),
                        ) { Text("Marcar paga", fontSize = 10.sp) }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyFinanceCard(message: String) {
    Surface(shape = RoundedCornerShape(24.dp), color = AxeCloudThemeTokens.Forest) {
        Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Outlined.AccountBalanceWallet, null, tint = AxeCloudThemeTokens.Gold, modifier = Modifier.size(34.dp))
            Spacer(Modifier.height(10.dp))
            Text(message, color = AxeCloudThemeTokens.Ivory, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ManagementScreen(
    data: HomeSnapshot,
    interaction: InteractionUiState,
    onPrayerStatus: (HomeFeedItem, String) -> Unit,
    onCreateAlbum: (String, String) -> Unit,
    onAddInventory: (String, String, String, String) -> Unit,
    onAddProduct: (String, String, String, String) -> Unit,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)
    val uriHandler = LocalUriHandler.current
    var formKind by rememberSaveable { mutableStateOf<String?>(null) }
    var name by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf("") }
    var valueOne by rememberSaveable { mutableStateOf("") }
    var valueTwo by rememberSaveable { mutableStateOf("") }
    LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowBack, "Voltar", tint = AxeCloudThemeTokens.Forest) }
            ModuleHero(
                eyebrow = "CASA EM MOVIMENTO",
                title = if (data.isFilho) "Memórias e caminhos da casa." else "Uma central que enxerga a casa inteira.",
                subtitle = if (data.isFilho) "Galeria e produtos conectados à sua comunidade." else "Acervo, estoque, loja e acolhimentos numa mesma leitura.",
                icon = Icons.Outlined.Groups,
                background = Color(0xFF15372C),
                accent = Color(0xFF64D9A9),
            )
        }
        interaction.feedback?.let { message -> item { Surface(shape = RoundedCornerShape(14.dp), color = AxeCloudThemeTokens.Gold.copy(alpha = .2f)) { Text(message, Modifier.padding(13.dp), color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Bold) } } }
        if (!data.isFilho) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("album" to "Novo álbum", "estoque" to "Novo item", "produto" to "Novo produto").forEach { (kind, label) ->
                        OutlinedButton(
                            onClick = { formKind = if (formKind == kind) null else kind; name = ""; description = ""; category = ""; valueOne = ""; valueTwo = "" },
                            modifier = Modifier.weight(1f),
                        ) { Text(label, fontSize = 9.sp, maxLines = 1) }
                    }
                }
            }
            item {
                AnimatedVisibility(formKind != null) {
                    Surface(shape = RoundedCornerShape(22.dp), color = AxeCloudThemeTokens.ForestDeep) {
                        Column(Modifier.fillMaxWidth().padding(17.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            Text(
                                when (formKind) { "album" -> "Criar álbum"; "estoque" -> "Adicionar ao almoxarifado"; else -> "Cadastrar produto" },
                                color = AxeCloudThemeTokens.Gold,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 17.sp,
                            )
                            EventField(name, { name = it }, when (formKind) { "album" -> "Nome do álbum"; "estoque" -> "Nome do item"; else -> "Nome do produto" })
                            EventField(description, { description = it }, if (formKind == "estoque") "Categoria" else "Descrição")
                            if (formKind != "album") {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    EventField(valueOne, { valueOne = it }, if (formKind == "estoque") "Quantidade atual" else "Preço", Modifier.weight(1f))
                                    EventField(valueTwo, { valueTwo = it }, if (formKind == "estoque") "Estoque mínimo" else "Estoque", Modifier.weight(1f))
                                }
                            }
                            Button(
                                onClick = {
                                    when (formKind) {
                                        "album" -> onCreateAlbum(name, description)
                                        "estoque" -> onAddInventory(name, description, valueOne, valueTwo)
                                        "produto" -> onAddProduct(name, description, valueOne, valueTwo)
                                    }
                                },
                                enabled = interaction.actionInProgress == null,
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Gold, contentColor = AxeCloudThemeTokens.ForestDeep),
                            ) { Text("Salvar", fontWeight = FontWeight.Bold) }
                        }
                    }
                }
            }
        }
        item { ManagementSection("Galeria da casa", data.galleryItems, Icons.Outlined.PhotoLibrary, "Nenhum álbum publicado") { item -> if (item.url.isNotBlank()) uriHandler.openUri(item.url) } }
        item { ManagementSection("Loja do axé", data.storeItems, Icons.Outlined.Storefront, "Nenhum produto disponível", showMoney = true) }
        if (!data.isFilho) {
            item { ManagementSection("Almoxarifado", data.inventoryItems, Icons.Outlined.Inventory2, "Estoque ainda não cadastrado", showQuantity = true) }
            item {
                Surface(shape = RoundedCornerShape(22.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
                    Column(Modifier.fillMaxWidth().padding(17.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.VolunteerActivism, null, tint = AxeCloudThemeTokens.Forest)
                            Text("Pedidos de reza", Modifier.padding(start = 10.dp), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp)
                        }
                        if (data.prayerItems.isEmpty()) Text("Nenhum pedido aguardando acolhimento.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
                        data.prayerItems.take(10).forEach { item ->
                            Column(Modifier.fillMaxWidth().background(AxeCloudThemeTokens.Ivory, RoundedCornerShape(15.dp)).padding(13.dp)) {
                                Text(item.title, color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Bold)
                                Text(item.detail, color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, maxLines = 3)
                                Text(item.status.replace('_', ' ').uppercase(), color = AxeCloudThemeTokens.GoldStrong, fontWeight = FontWeight.Bold, fontSize = 9.sp)
                                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(onClick = { onPrayerStatus(item, "aceito") }, enabled = interaction.actionInProgress == null, colors = ButtonDefaults.buttonColors(containerColor = AxeCloudThemeTokens.Forest)) { Text("Acolher", fontSize = 10.sp) }
                                    OutlinedButton(onClick = { onPrayerStatus(item, "em_oracao") }, enabled = interaction.actionInProgress == null) { Text("Iniciar oração", fontSize = 10.sp) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ManagementSection(
    title: String,
    items: List<HomeFeedItem>,
    icon: ImageVector,
    empty: String,
    showMoney: Boolean = false,
    showQuantity: Boolean = false,
    onClick: (HomeFeedItem) -> Unit = {},
) {
    Surface(shape = RoundedCornerShape(22.dp), color = AxeCloudThemeTokens.Surface, border = androidx.compose.foundation.BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
        Column(Modifier.fillMaxWidth().padding(17.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, null, tint = AxeCloudThemeTokens.Forest)
                Text(title, Modifier.padding(start = 10.dp), color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp)
            }
            if (items.isEmpty()) Text(empty, color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
            items.take(8).forEach { item ->
                Row(
                    Modifier.fillMaxWidth().background(AxeCloudThemeTokens.Ivory, RoundedCornerShape(14.dp)).clickable { onClick(item) }.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(item.title, color = AxeCloudThemeTokens.ForestDeep, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        if (item.detail.isNotBlank()) Text(item.detail, color = AxeCloudThemeTokens.Muted, fontSize = 10.sp, maxLines = 2)
                        if (item.status.isNotBlank()) Text(item.status.uppercase(), color = if (item.status.contains("baixo")) AxeCloudThemeTokens.Error else AxeCloudThemeTokens.ForestSoft, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                    when {
                        showMoney -> Text(item.amount.asMoney(), color = AxeCloudThemeTokens.Forest, fontWeight = FontWeight.ExtraBold)
                        showQuantity -> Text(item.amount.toInt().toString(), color = AxeCloudThemeTokens.Forest, fontSize = 20.sp, fontWeight = FontWeight.Black)
                        else -> Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.GoldStrong)
                    }
                }
            }
        }
    }
}

@Composable
internal fun QrCode(payload: String, modifier: Modifier = Modifier) {
    val bitmap = androidx.compose.runtime.remember(payload) {
        val matrix = MultiFormatWriter().encode(payload, BarcodeFormat.QR_CODE, 600, 600)
        Bitmap.createBitmap(600, 600, Bitmap.Config.ARGB_8888).also { image ->
            for (x in 0 until 600) for (y in 0 until 600) {
                image.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
            }
        }
    }
    Image(bitmap.asImageBitmap(), contentDescription = "QR Code PIX", modifier = modifier)
}

@Composable
private fun ModuleHero(
    eyebrow: String,
    title: String,
    subtitle: String,
    icon: ImageVector,
    background: Color,
    accent: Color,
) {
    Surface(shape = RoundedCornerShape(28.dp), color = Color.Transparent, shadowElevation = 7.dp) {
        Box(
            Modifier.fillMaxWidth().height(190.dp)
                .background(Brush.linearGradient(listOf(background, background.copy(alpha = .88f))))
        ) {
            Canvas(Modifier.fillMaxSize()) {
                drawCircle(accent.copy(alpha = .10f), radius = size.minDimension * .58f, center = androidx.compose.ui.geometry.Offset(size.width * .92f, size.height * .05f))
                drawCircle(accent.copy(alpha = .12f), radius = size.minDimension * .33f, center = androidx.compose.ui.geometry.Offset(size.width * .92f, size.height * .05f), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f))
                drawCircle(accent.copy(alpha = .08f), radius = size.minDimension * .18f, center = androidx.compose.ui.geometry.Offset(size.width * .92f, size.height * .05f), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f))
            }
            Column(Modifier.fillMaxSize().padding(21.dp), verticalArrangement = Arrangement.SpaceBetween) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(38.dp).background(accent, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                        Icon(icon, null, tint = background, modifier = Modifier.size(20.dp))
                    }
                    Text(eyebrow, Modifier.padding(start = 10.dp), color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.1.sp)
                }
                Column(Modifier.fillMaxWidth(.86f)) {
                    Text(title, color = AxeCloudThemeTokens.Ivory, fontSize = 24.sp, lineHeight = 26.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(6.dp))
                    Text(subtitle, color = AxeCloudThemeTokens.Ivory.copy(alpha = .68f), fontSize = 11.sp, lineHeight = 15.sp)
                }
            }
        }
    }
}

internal fun Double.asMoney(): String = "R$ " + String.format(java.util.Locale("pt", "BR"), "%,.2f", this)

private enum class HomeTab(
    val label: String,
    val icon: ImageVector,
    val showInNavigation: Boolean = true,
    val leaderOnly: Boolean = false,
) {
    INICIO("Início", Icons.Outlined.Home),
    ROTINA("Rotina", Icons.Outlined.MenuBook),
    AGENDA("Agenda", Icons.Outlined.CalendarMonth),
    AVISOS("Avisos", Icons.Outlined.Notifications),
    PERFIL("Perfil", Icons.Outlined.Person),
    FINANCEIRO("Financeiro", Icons.Outlined.AccountBalanceWallet, false),
    FILHOS("Corrente", Icons.Outlined.Groups, false, true),
    FREQUENCIA("Frequência", Icons.Outlined.Timeline, false, true),
    ALMOXARIFADO("Almoxarifado", Icons.Outlined.Inventory2, false, true),
    BIBLIOTECA("Biblioteca", Icons.Outlined.MenuBook, false),
    GALERIA("Galeria", Icons.Outlined.PhotoLibrary, false),
    ATENDIMENTOS("Atendimentos", Icons.Outlined.VolunteerActivism, false, true),
    LOJA("Loja", Icons.Outlined.Storefront, false),
    FUNDAMENTOS("Fundamentos", Icons.Outlined.MenuBook, false),
    GESTAO("Gestão", Icons.Outlined.Settings, false),
    SUPORTE("Suporte", Icons.Outlined.HeadsetMic, false, true),

    ;

    fun allowedFor(isFilho: Boolean): Boolean = !leaderOnly || !isFilho
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
