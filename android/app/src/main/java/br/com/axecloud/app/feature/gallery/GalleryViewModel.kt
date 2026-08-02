package br.com.axecloud.app.feature.gallery

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GalleryViewModel @Inject constructor(private val repo: GalleryRepository) : ViewModel() {
    private val mutable = MutableStateFlow(GalleryUiState())
    val state = mutable.asStateFlow()
    init { load() }
    fun load() = viewModelScope.launch {
        mutable.update { it.copy(loading = true, error = null) }
        runCatching { repo.load() }.onSuccess { p -> mutable.update { it.copy(loading = false, isFilho = p.isFilho, albums = p.albums, usedBytes = p.used, limitBytes = p.limit) } }
            .onFailure { e -> mutable.update { it.copy(loading = false, error = e.message) } }
    }
    fun query(v: String) = mutable.update { it.copy(query = v) }
    fun category(v: String) = mutable.update { it.copy(category = v) }
    fun compose(open: Boolean) = mutable.update { it.copy(composerOpen = open, error = null) }
    fun album(a: GalleryAlbum?) = mutable.update { it.copy(selectedAlbum = a, selectedMedia = null) }
    fun media(m: GalleryMedia?) = mutable.update { it.copy(selectedMedia = m, selectedAlbum = if (m != null) null else it.selectedAlbum) }
    fun consume() = mutable.update { it.copy(message = null) }
    fun publish(d: GalleryDraft) = viewModelScope.launch {
        mutable.update { it.copy(publishing = true, error = null) }
        runCatching { repo.publish(d) { n, total -> mutable.update { it.copy(progress = "$n de $total") } }; repo.load() }
            .onSuccess { p -> mutable.update { it.copy(publishing = false, progress = "", composerOpen = false, albums = p.albums, usedBytes = p.used, limitBytes = p.limit, message = "Álbum publicado na corrente.") } }
            .onFailure { e -> mutable.update { it.copy(publishing = false, error = e.message) } }
    }
    fun axe(m: GalleryMedia) = action(m.id, "Axé enviado.") { repo.sendAxe(m) }
    fun deleteMedia(m: GalleryMedia) = action(m.id, "Memória removida.") { repo.deleteMedia(m) }
    fun deleteAlbum(a: GalleryAlbum) = action(a.id, "Álbum removido.") { repo.deleteAlbum(a) }
    private fun action(id: String, message: String, block: suspend () -> Unit) = viewModelScope.launch {
        mutable.update { it.copy(actionId = id, error = null) }
        runCatching { block(); repo.load() }.onSuccess { p -> mutable.update { it.copy(actionId = null, albums = p.albums, selectedAlbum = null, selectedMedia = null, message = message) } }
            .onFailure { e -> mutable.update { it.copy(actionId = null, error = e.message) } }
    }
}
