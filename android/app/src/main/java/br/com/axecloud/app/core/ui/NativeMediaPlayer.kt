package br.com.axecloud.app.core.ui

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Pause
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay

@Composable
private fun rememberAxePlayer(url: String): ExoPlayer {
    val context = LocalContext.current
    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(url))
            prepare()
        }
    }
    DisposableEffect(player) { onDispose { player.release() } }
    return player
}

@Composable
fun NativeVideoPlayer(url: String, modifier: Modifier = Modifier, autoPlay: Boolean = false) {
    val player = rememberAxePlayer(url)
    LaunchedEffect(player, autoPlay) { player.playWhenReady = autoPlay }
    AndroidView(
        factory = { context ->
            PlayerView(context).apply {
                this.player = player
                useController = true
                controllerShowTimeoutMs = 2_500
                setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            }
        },
        update = { it.player = player },
        modifier = modifier.background(Color.Black),
    )
}

@Composable
fun NativeAudioPlayer(url: String, ownMessage: Boolean = false, modifier: Modifier = Modifier) {
    val player = rememberAxePlayer(url)
    var playing by remember { mutableStateOf(false) }
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(0L) }
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) { playing = isPlaying }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }
    LaunchedEffect(player, playing) {
        while (true) {
            position = player.currentPosition.coerceAtLeast(0L)
            duration = player.duration.coerceAtLeast(0L)
            delay(if (playing) 250 else 700)
        }
    }
    val ink = if (ownMessage) Color(0xFF0C2C20) else Color(0xFFF7F1E3)
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        FilledIconButton(
            onClick = { if (playing) player.pause() else player.play() },
            colors = IconButtonDefaults.filledIconButtonColors(containerColor = ink.copy(alpha = .13f), contentColor = ink),
            shape = CircleShape,
        ) { Icon(if (playing) Icons.Outlined.Pause else Icons.Outlined.PlayArrow, if (playing) "Pausar áudio" else "Ouvir áudio") }
        Column(Modifier.weight(1f).padding(start = 8.dp)) {
            Slider(
                value = if (duration > 0) position.toFloat() / duration else 0f,
                onValueChange = { if (duration > 0) player.seekTo((duration * it).toLong()) },
                colors = SliderDefaults.colors(thumbColor = ink, activeTrackColor = ink, inactiveTrackColor = ink.copy(alpha = .2f)),
                modifier = Modifier.height(24.dp),
            )
            Text("${formatTime(position)}  ·  ${formatTime(duration)}", color = ink.copy(alpha = .72f), fontSize = 9.sp)
        }
    }
}

private fun formatTime(value: Long): String {
    val seconds = (value / 1000).coerceAtLeast(0)
    return "%d:%02d".format(seconds / 60, seconds % 60)
}
