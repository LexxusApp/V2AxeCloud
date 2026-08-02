package br.com.axecloud.app.feature.gallery

import android.net.Uri

data class GalleryMedia(
    val id: String,
    val albumId: String,
    val type: String,
    val fileName: String,
    val mimeType: String,
    val sizeBytes: Long,
    val url: String,
    val title: String,
    val caption: String,
    val category: String,
    val likes: Int,
    val author: String,
    val createdAt: String,
)

data class GalleryAlbum(
    val id: String,
    val name: String,
    val description: String,
    val category: String,
    val createdAt: String,
    val media: List<GalleryMedia>,
) {
    val cover: GalleryMedia? get() = media.firstOrNull { it.type == "image" } ?: media.firstOrNull()
}

data class GalleryDraft(
    val name: String = "",
    val description: String = "",
    val category: String = "gira",
    val files: List<Uri> = emptyList(),
)

data class GalleryUiState(
    val loading: Boolean = true,
    val publishing: Boolean = false,
    val progress: String = "",
    val albums: List<GalleryAlbum> = emptyList(),
    val isFilho: Boolean = false,
    val usedBytes: Long = 0,
    val limitBytes: Long = 0,
    val query: String = "",
    val category: String = "tudo",
    val composerOpen: Boolean = false,
    val selectedAlbum: GalleryAlbum? = null,
    val selectedMedia: GalleryMedia? = null,
    val actionId: String? = null,
    val error: String? = null,
    val message: String? = null,
) {
    val visible: List<GalleryAlbum> get() = albums.filter { album ->
        (category == "tudo" || album.category == category) &&
            (query.isBlank() || (album.name + " " + album.description).contains(query, true))
    }
    val mediaCount get() = albums.sumOf { it.media.size }
    val photoCount get() = albums.sumOf { a -> a.media.count { it.type == "image" } }
    val videoCount get() = mediaCount - photoCount
    val axeCount get() = albums.sumOf { a -> a.media.sumOf { it.likes } }
}
