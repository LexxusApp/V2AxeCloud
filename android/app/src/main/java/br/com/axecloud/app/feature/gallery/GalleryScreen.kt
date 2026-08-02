package br.com.axecloud.app.feature.gallery

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import br.com.axecloud.app.core.ui.NativeVideoPlayer
import coil.compose.AsyncImage

private val GalleryNight = Color(0xFF181A28)
private val GalleryViolet = Color(0xFF9A7CF2)
private val GalleryCoral = Color(0xFFF28C71)

@Composable fun GalleryRoute(vm: GalleryViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()
    val snack = remember { SnackbarHostState() }
    LaunchedEffect(state.message) { state.message?.let { snack.showSnackbar(it); vm.consume() } }
    GalleryScreen(state, snack, vm)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun GalleryScreen(s: GalleryUiState, snack: SnackbarHostState, vm: GalleryViewModel) {
    var removeAlbum by remember { mutableStateOf<GalleryAlbum?>(null) }
    var removeMedia by remember { mutableStateOf<GalleryMedia?>(null) }
    Scaffold(
        containerColor = AxeCloudThemeTokens.Canvas,
        snackbarHost = { SnackbarHost(snack) },
        floatingActionButton = { if (!s.isFilho) FloatingActionButton({ vm.compose(true) }, containerColor = GalleryViolet, contentColor = Color.White, shape = RoundedCornerShape(18.dp)) { Icon(Icons.Outlined.AddPhotoAlternate, "Novo álbum") } },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(horizontal = 17.dp, vertical = 15.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { GalleryHero(s) }
            item { GallerySearch(s, vm) }
            when {
                s.loading -> item { Box(Modifier.fillMaxWidth().padding(50.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = GalleryViolet) } }
                s.error != null && s.albums.isEmpty() -> item { ErrorGallery(s.error, vm::load) }
                s.visible.isEmpty() -> item { EmptyGallery(s.isFilho, { vm.compose(true) }) }
                else -> itemsIndexed(s.visible, key = { _, a -> a.id }) { index, album ->
                    AnimatedVisibility(true, enter = fadeIn() + slideInVertically(initialOffsetY = { 28 + index * 3 })) {
                        AlbumStory(album, s.actionId, { vm.album(album) }, { removeAlbum = album }, vm::axe)
                    }
                }
            }
            item { Spacer(Modifier.height(82.dp)) }
        }
    }
    if (s.composerOpen) AlbumComposer(s, { vm.compose(false) }, vm::publish)
    s.selectedAlbum?.let { AlbumSheet(it, s.isFilho, s.actionId, { vm.album(null) }, vm::media, { removeAlbum = it }) }
    s.selectedMedia?.let { MediaViewer(it, s.isFilho, s.actionId == it.id, { vm.media(null) }, { vm.axe(it) }, { removeMedia = it }) }
    removeAlbum?.let { album -> ConfirmDelete("Excluir o álbum?", "Todas as ${album.media.size} memórias deste álbum serão removidas.", { removeAlbum = null }, { removeAlbum = null; vm.deleteAlbum(album) }) }
    removeMedia?.let { media -> ConfirmDelete("Remover esta memória?", "A mídia deixará de aparecer para toda a corrente.", { removeMedia = null }, { removeMedia = null; vm.deleteMedia(media) }) }
}

@Composable private fun GalleryHero(s: GalleryUiState) = Surface(shape = RoundedCornerShape(30.dp), color = GalleryNight, shadowElevation = 8.dp) {
    Box(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(GalleryNight, Color(0xFF29213C))))) {
        Column(Modifier.padding(22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(45.dp).background(GalleryViolet, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Collections, null, tint = Color.White) }
                Column(Modifier.padding(start = 12.dp)) { Text("MEMÓRIA VIVA", color = GalleryViolet, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp); Text("Galeria da casa", color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Black) }
            }
            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GalleryMetric(s.albums.size.toString(), "álbuns", Modifier.weight(1f)); GalleryMetric(s.photoCount.toString(), "fotos", Modifier.weight(1f)); GalleryMetric(s.videoCount.toString(), "vídeos", Modifier.weight(1f)); GalleryMetric(s.axeCount.toString(), "axés", Modifier.weight(1f))
            }
            if (s.limitBytes > 0) { Spacer(Modifier.height(15.dp)); LinearProgressIndicator({ (s.usedBytes.toFloat() / s.limitBytes).coerceIn(0f, 1f) }, Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(9.dp)), color = GalleryCoral, trackColor = Color.White.copy(.1f)); Text("${formatBytes(s.usedBytes)} usados na nuvem", color = Color.White.copy(.58f), fontSize = 9.sp, modifier = Modifier.padding(top = 6.dp)) }
        }
    }
}

@Composable private fun GalleryMetric(value: String, label: String, modifier: Modifier) = Surface(modifier, shape = RoundedCornerShape(14.dp), color = Color.White.copy(.07f)) { Column(Modifier.padding(vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(value, color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp); Text(label, color = Color.White.copy(.55f), fontSize = 8.sp) } }

@Composable private fun GallerySearch(s: GalleryUiState, vm: GalleryViewModel) = Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    OutlinedTextField(s.query, vm::query, Modifier.fillMaxWidth(), singleLine = true, leadingIcon = { Icon(Icons.Outlined.Search, null) }, placeholder = { Text("Buscar uma memória") }, shape = RoundedCornerShape(18.dp))
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf("tudo" to "Todos", "gira" to "Giras", "evento" to "Festas e rituais", "lembranca" to "Memórias").forEach { (key, label) -> FilterChip(s.category == key, { vm.category(key) }, label = { Text(label) }) } }
}

@Composable private fun AlbumStory(a: GalleryAlbum, busy: String?, open: () -> Unit, delete: () -> Unit, axe: (GalleryMedia) -> Unit) = Surface(Modifier.fillMaxWidth().clickable(onClick = open), shape = RoundedCornerShape(23.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) {
    Column {
        Box(Modifier.fillMaxWidth().height(205.dp).background(GalleryNight)) {
            val cover = a.cover
            if (cover?.type == "image") AsyncImage(cover.url, a.name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.PlayCircle, null, Modifier.size(54.dp), tint = GalleryViolet) }
            Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(Color.Transparent, GalleryNight.copy(.72f)))))
            Surface(Modifier.align(Alignment.TopStart).padding(12.dp), shape = RoundedCornerShape(50), color = GalleryNight.copy(.82f)) { Text(categoryLabel(a.category), Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black) }
            Column(Modifier.align(Alignment.BottomStart).padding(15.dp)) { Text(a.name, color = Color.White, fontWeight = FontWeight.Black, fontSize = 21.sp, maxLines = 1, overflow = TextOverflow.Ellipsis); Text("${a.media.size} registros · toque para explorar", color = Color.White.copy(.72f), fontSize = 10.sp) }
        }
        Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(a.description.ifBlank { "Uma lembrança preservada pela casa." }, Modifier.weight(1f), color = AxeCloudThemeTokens.Muted, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            a.cover?.let { m -> TextButton({ axe(m) }, enabled = busy != m.id) { Icon(Icons.Outlined.AutoAwesome, null, Modifier.size(17.dp)); Spacer(Modifier.width(4.dp)); Text("${m.likes} Axé") } }
            Icon(Icons.Outlined.ChevronRight, null, tint = AxeCloudThemeTokens.Muted)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun AlbumComposer(s: GalleryUiState, dismiss: () -> Unit, publish: (GalleryDraft) -> Unit) {
    var draft by rememberSaveable(stateSaver = GalleryDraftSaver) { mutableStateOf(GalleryDraft()) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { draft = draft.copy(files = it) }
    ModalBottomSheet(onDismissRequest = dismiss, containerColor = AxeCloudThemeTokens.Canvas) {
        Column(Modifier.navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Text("Criar uma memória", color = AxeCloudThemeTokens.Ink, fontSize = 25.sp, fontWeight = FontWeight.Black)
            Text("Álbum, fotos e vídeos entram juntos na história da corrente.", color = AxeCloudThemeTokens.Muted, fontSize = 12.sp)
            OutlinedTextField(draft.name, { draft = draft.copy(name = it) }, Modifier.fillMaxWidth(), label = { Text("Nome do álbum") }, shape = RoundedCornerShape(16.dp))
            OutlinedTextField(draft.description, { draft = draft.copy(description = it) }, Modifier.fillMaxWidth(), label = { Text("Conte essa memória") }, minLines = 2, shape = RoundedCornerShape(16.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf("gira" to "Gira", "evento" to "Festa / ritual", "lembranca" to "Memória").forEach { (k, v) -> FilterChip(draft.category == k, { draft = draft.copy(category = k) }, label = { Text(v) }) } }
            OutlinedButton({ picker.launch(arrayOf("image/*", "video/*")) }, Modifier.fillMaxWidth().height(58.dp), shape = RoundedCornerShape(17.dp)) { Icon(Icons.Outlined.PhotoLibrary, null); Spacer(Modifier.width(8.dp)); Text(if (draft.files.isEmpty()) "Escolher fotos e vídeos" else "${draft.files.size} arquivo(s) selecionado(s)") }
            s.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 11.sp) }
            Button({ publish(draft) }, Modifier.fillMaxWidth().height(54.dp), enabled = !s.publishing && draft.name.isNotBlank() && draft.files.isNotEmpty(), colors = ButtonDefaults.buttonColors(containerColor = GalleryNight), shape = RoundedCornerShape(17.dp)) { if (s.publishing) { CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White); Spacer(Modifier.width(8.dp)); Text("Enviando ${s.progress}") } else Text("Publicar para a corrente") }
        }
    }
}

private val GalleryDraftSaver = androidx.compose.runtime.saveable.Saver<GalleryDraft, List<String>>(save = { listOf(it.name, it.description, it.category) }, restore = { GalleryDraft(it[0], it[1], it[2]) })

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun AlbumSheet(a: GalleryAlbum, isFilho: Boolean, busy: String?, dismiss: () -> Unit, open: (GalleryMedia) -> Unit, delete: () -> Unit) = ModalBottomSheet(onDismissRequest = dismiss, containerColor = GalleryNight, contentColor = Color.White) {
    Column(Modifier.navigationBarsPadding().padding(horizontal = 18.dp).padding(bottom = 24.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text(categoryLabel(a.category).uppercase(), color = GalleryViolet, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp); Text(a.name, fontSize = 25.sp, fontWeight = FontWeight.Black) }; if (!isFilho) IconButton(delete) { Icon(Icons.Outlined.DeleteOutline, "Excluir álbum", tint = GalleryCoral) } }
        Text(a.description, color = Color.White.copy(.65f), fontSize = 11.sp)
        Spacer(Modifier.height(14.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(9.dp)) { items(a.media, key = { it.id }) { m -> Box(Modifier.width(145.dp).height(190.dp).clip(RoundedCornerShape(18.dp)).background(Color.White.copy(.07f)).clickable { open(m) }) { if (m.type == "image") AsyncImage(m.url, m.title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) else Icon(Icons.Outlined.PlayCircle, null, Modifier.size(45.dp).align(Alignment.Center), tint = GalleryViolet); Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(.7f))))); Text(m.title, Modifier.align(Alignment.BottomStart).padding(10.dp), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 2) } } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun MediaViewer(m: GalleryMedia, isFilho: Boolean, busy: Boolean, dismiss: () -> Unit, axe: () -> Unit, delete: () -> Unit) = ModalBottomSheet(onDismissRequest = dismiss, containerColor = Color(0xFF0B0D12), dragHandle = null) {
    Column(Modifier.fillMaxWidth().navigationBarsPadding()) {
        Box(Modifier.fillMaxWidth().heightIn(min = 330.dp, max = 520.dp).background(Color.Black)) { if (m.type == "image") AsyncImage(m.url, m.title, Modifier.fillMaxSize(), contentScale = ContentScale.Fit) else NativeVideoPlayer(m.url, Modifier.fillMaxSize(), autoPlay = true); IconButton(dismiss, Modifier.align(Alignment.TopEnd).padding(8.dp).background(Color.Black.copy(.55f), RoundedCornerShape(50))) { Icon(Icons.Outlined.Close, "Fechar", tint = Color.White) } }
        Column(Modifier.padding(18.dp)) { Text(m.title, color = Color.White, fontWeight = FontWeight.Black, fontSize = 20.sp); if (m.caption.isNotBlank()) Text(m.caption, color = Color.White.copy(.65f), fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp)); Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) { Button(axe, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = GalleryViolet)) { Icon(Icons.Outlined.AutoAwesome, null); Spacer(Modifier.width(6.dp)); Text("Enviar Axé · ${m.likes}") }; if (!isFilho) OutlinedButton(delete) { Icon(Icons.Outlined.DeleteOutline, null); Text("Remover") } } }
    }
}

@Composable private fun EmptyGallery(isFilho: Boolean, create: () -> Unit) = Surface(shape = RoundedCornerShape(24.dp), color = Color.White, border = BorderStroke(1.dp, AxeCloudThemeTokens.Outline)) { Column(Modifier.fillMaxWidth().padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Outlined.Collections, null, Modifier.size(44.dp), tint = GalleryViolet); Text("A história começa aqui", color = AxeCloudThemeTokens.Ink, fontWeight = FontWeight.Black, fontSize = 19.sp); Text(if (isFilho) "Quando a casa publicar uma memória, ela aparecerá neste espaço." else "Crie o primeiro álbum e preserve a memória da corrente.", color = AxeCloudThemeTokens.Muted, fontSize = 11.sp); if (!isFilho) TextButton(create) { Text("Criar primeiro álbum") } } }
@Composable private fun ErrorGallery(message: String, retry: () -> Unit) = Column(Modifier.fillMaxWidth().padding(25.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(message, color = MaterialTheme.colorScheme.error); TextButton(retry) { Text("Tentar novamente") } }
@Composable private fun ConfirmDelete(title: String, text: String, dismiss: () -> Unit, confirm: () -> Unit) = AlertDialog(onDismissRequest = dismiss, title = { Text(title) }, text = { Text(text) }, confirmButton = { Button(confirm, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("Excluir") } }, dismissButton = { TextButton(dismiss) { Text("Cancelar") } })
private fun categoryLabel(category: String) = when (category) { "gira" -> "Gira"; "evento" -> "Festa / ritual"; else -> "Memória da casa" }
private fun formatBytes(bytes: Long): String = when { bytes >= 1024L * 1024 * 1024 -> String.format("%.1f GB", bytes / (1024f * 1024 * 1024)); bytes >= 1024L * 1024 -> String.format("%.1f MB", bytes / (1024f * 1024)); else -> "${bytes / 1024} KB" }
