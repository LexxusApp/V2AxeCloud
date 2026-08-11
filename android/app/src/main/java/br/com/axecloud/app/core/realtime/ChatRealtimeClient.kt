package br.com.axecloud.app.core.realtime

import br.com.axecloud.app.BuildConfig
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChatRealtimeClient @Inject constructor() {
    private val json = Json { ignoreUnknownKeys = true }
    private val client = OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS).build()

    fun changes(conversationId: String, accessToken: String): Flow<Unit> = callbackFlow {
        val base = BuildConfig.SUPABASE_URL.trimEnd('/')
        val anon = BuildConfig.SUPABASE_ANON_KEY
        if (base.isBlank() || anon.isBlank() || accessToken.isBlank()) { close(); return@callbackFlow }
        val wsBase = base.replaceFirst("https://", "wss://").replaceFirst("http://", "ws://")
        val url = "$wsBase/realtime/v1/websocket?apikey=${URLEncoder.encode(anon, "UTF-8")}&vsn=1.0.0"
        val topic = "realtime:public:chat_messages:$conversationId"
        var ref = 1L
        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val join = buildJsonObject {
                    put("topic", topic); put("event", "phx_join"); put("ref", (ref++).toString())
                    put("payload", buildJsonObject { put("config", buildJsonObject {
                        put("broadcast", buildJsonObject { put("ack", false); put("self", false) })
                        put("presence", buildJsonObject { put("key", "") })
                        put("postgres_changes", buildJsonArray { add(buildJsonObject { put("event", "*"); put("schema", "public"); put("table", "chat_messages"); put("filter", "conversation_id=eq.$conversationId") }) })
                        put("private", false)
                    }); put("access_token", accessToken) })
                }
                webSocket.send(join.toString())
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                val event = runCatching { json.parseToJsonElement(text).jsonObject["event"]?.jsonPrimitive?.content }.getOrNull()
                if (event == "postgres_changes" || event == "INSERT" || event == "UPDATE" || event == "DELETE") trySend(Unit)
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { close(t) }
        }
        val socket = client.newWebSocket(Request.Builder().url(url).header("Authorization", "Bearer $accessToken").build(), listener)
        val heartbeat = launch {
            while (isActive) { delay(25_000); socket.send(buildJsonObject { put("topic", "phoenix"); put("event", "heartbeat"); put("payload", buildJsonObject {}); put("ref", (ref++).toString()) }.toString()) }
        }
        awaitClose { heartbeat.cancel(); socket.close(1000, "conversation closed") }
    }
}
