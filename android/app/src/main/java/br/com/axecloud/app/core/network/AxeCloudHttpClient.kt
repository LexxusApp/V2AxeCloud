package br.com.axecloud.app.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

class ApiException(val status: Int, override val message: String) : IOException(message)

@Singleton
class AxeCloudHttpClient @Inject constructor(
    private val client: OkHttpClient,
    val json: Json,
) {
    suspend fun get(url: String, accessToken: String? = null): JsonElement =
        execute(
            Request.Builder()
                .url(url)
                .apply { if (!accessToken.isNullOrBlank()) header("Authorization", "Bearer $accessToken") }
                .get()
                .build()
        )

    suspend fun post(
        url: String,
        body: JsonElement,
        accessToken: String? = null,
        headers: Map<String, String> = emptyMap(),
    ): JsonElement {
        val request = Request.Builder()
            .url(url)
            .apply {
                if (!accessToken.isNullOrBlank()) header("Authorization", "Bearer $accessToken")
                headers.forEach { (key, value) -> header(key, value) }
            }
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        return execute(request)
    }

    private suspend fun execute(request: Request): JsonElement = withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val parsed = runCatching { json.parseToJsonElement(raw) }.getOrNull()
            if (!response.isSuccessful) {
                val message = parsed?.let(::errorMessage)
                    ?: when (response.code) {
                        401 -> "Sessão ou credenciais inválidas."
                        403 -> "Você não tem permissão para esta ação."
                        429 -> "Muitas tentativas. Aguarde alguns minutos."
                        else -> "Não foi possível concluir a solicitação."
                    }
                throw ApiException(response.code, message)
            }
            parsed ?: JsonObject(emptyMap())
        }
    }

    private fun errorMessage(element: JsonElement): String? {
        val obj = runCatching { element.jsonObject }.getOrNull() ?: return null
        return listOf("error_description", "error", "message", "msg")
            .firstNotNullOfOrNull { key -> obj[key]?.jsonPrimitive?.content?.takeIf(String::isNotBlank) }
    }

    private companion object {
        val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
