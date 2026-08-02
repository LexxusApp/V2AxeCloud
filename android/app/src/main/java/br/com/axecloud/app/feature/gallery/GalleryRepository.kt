package br.com.axecloud.app.feature.gallery

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.json.*
import java.net.URLEncoder
import javax.inject.Inject

data class GalleryPayload(val isFilho: Boolean, val albums: List<GalleryAlbum>, val used: Long, val limit: Long)

class GalleryRepository @Inject constructor(
    private val http: AxeCloudHttpClient,
    private val sessions: SessionStore,
    @ApplicationContext private val context: Context,
) {
    suspend fun load(): GalleryPayload {
        val s = session()
        val root = http.get(api("/api/v1/gallery/albums?tenantId=${enc(s.tenantId)}"), s.accessToken).jsonObject
        val albums = root["albums"]?.jsonArray.orEmpty().map { it.jsonObject.album() }
        val quota = root["quota"] as? JsonObject
        return GalleryPayload(s.isFilho, albums, quota?.long("usedBytes") ?: 0, quota?.long("limitBytes") ?: 0)
    }

    suspend fun publish(draft: GalleryDraft, progress: (Int, Int) -> Unit) {
        val s = session()
        check(!s.isFilho) { "Somente a liderança pode publicar álbuns." }
        check(draft.name.isNotBlank()) { "Informe o nome do álbum." }
        check(draft.files.isNotEmpty()) { "Selecione ao menos uma foto ou vídeo." }
        val albumRoot = http.post(api("/api/v1/gallery/albums"), buildJsonObject {
            put("tenantId", s.tenantId); put("name", draft.name.trim()); put("description", draft.description.trim()); put("category", draft.category)
        }, s.accessToken).jsonObject
        val albumId = albumRoot["album"]?.jsonObject?.text("id").orEmpty()
        check(albumId.isNotBlank()) { "O servidor não criou o álbum." }
        draft.files.forEachIndexed { index, uri ->
            progress(index + 1, draft.files.size)
            uploadOne(s.tenantId, s.accessToken, albumId, draft, uri, index)
        }
    }

    private suspend fun uploadOne(tenantId: String, token: String, albumId: String, draft: GalleryDraft, uri: Uri, index: Int) {
        val mime = context.contentResolver.getType(uri)?.takeIf { it.startsWith("image/") || it.startsWith("video/") }
            ?: error("Formato de mídia não suportado.")
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Não foi possível ler a mídia.")
        check(bytes.size <= 500 * 1024 * 1024) { "Cada arquivo deve ter no máximo 500 MB." }
        val name = fileName(uri).ifBlank { "memoria-${System.currentTimeMillis()}" }
        val prep = http.post(api("/api/v1/gallery/upload-url"), buildJsonObject {
            put("tenantId", tenantId); put("albumId", albumId); put("fileName", name); put("contentType", mime); put("sizeBytes", bytes.size)
        }, token).jsonObject
        http.putBytes(prep.text("uploadUrl"), bytes, mime)
        http.post(api("/api/v1/gallery/complete-upload"), buildJsonObject {
            put("tenantId", tenantId); put("albumId", albumId); put("storageKey", prep.text("storageKey")); put("publicUrl", prep.text("publicUrl"))
            put("fileName", name); put("contentType", mime); put("sizeBytes", bytes.size)
            put("title", if (draft.files.size > 1) "${draft.name} — memória ${index + 1}" else draft.name)
            put("caption", draft.description); put("category", draft.category)
        }, token)
    }

    suspend fun sendAxe(media: GalleryMedia) {
        val s = session(); http.post(api("/api/v1/gallery/media/${enc(media.id)}/axe"), buildJsonObject { put("tenantId", s.tenantId) }, s.accessToken)
    }
    suspend fun deleteMedia(media: GalleryMedia) { val s = session(); check(!s.isFilho); http.delete(api("/api/v1/gallery/media/${enc(media.id)}?tenantId=${enc(s.tenantId)}"), s.accessToken) }
    suspend fun deleteAlbum(album: GalleryAlbum) { val s = session(); check(!s.isFilho); http.delete(api("/api/v1/gallery/albums/${enc(album.id)}?tenantId=${enc(s.tenantId)}"), s.accessToken) }

    private fun fileName(uri: Uri): String {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) return it.getString(0).orEmpty() }
        return uri.lastPathSegment.orEmpty()
    }
    private fun session() = sessions.current().also { check(it.isAuthenticated) { "Entre novamente." } }
    private fun api(path: String) = BuildConfig.API_BASE_URL.trimEnd('/') + path
    private fun enc(value: String) = URLEncoder.encode(value, "UTF-8")
}

private fun JsonObject.album() = GalleryAlbum(text("id"), text("name"), text("description"), text("category").ifBlank { "lembranca" }, text("created_at"), this["media"]?.jsonArray.orEmpty().map { it.jsonObject.media() })
private fun JsonObject.media() = GalleryMedia(text("id"), text("album_id"), text("media_type"), text("file_name"), text("mime_type"), long("size_bytes"), text("public_url", "signed_url", "url"), text("title").ifBlank { text("file_name") }, text("caption"), text("category").ifBlank { "lembranca" }, int("likes_count"), text("author_name"), text("created_at"))
private fun JsonObject.text(vararg keys: String) = keys.firstNotNullOfOrNull { key -> runCatching { this[key]?.jsonPrimitive?.content }.getOrNull()?.takeIf(String::isNotBlank) }.orEmpty()
private fun JsonObject.long(key: String): Long = runCatching { this[key]?.jsonPrimitive?.long }.getOrNull() ?: 0L
private fun JsonObject.int(key: String): Int = runCatching { this[key]?.jsonPrimitive?.int }.getOrNull() ?: 0
