package br.com.axecloud.app.feature.care
import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.serialization.json.*
import java.net.URLEncoder
import javax.inject.Inject
class CareRepository @Inject constructor(private val http:AxeCloudHttpClient,private val sessions:SessionStore){suspend fun load():List<PrayerRequest>{val s=session();check(!s.isFilho){"A central de acolhimento é exclusiva da liderança."};val root=http.get(api("/api/v1/atendimentos/pedidos-reza?tenantId=${enc(s.tenantId)}"),s.accessToken).jsonObject;return root["items"]?.jsonArray.orEmpty().map{it.jsonObject.toModel()}};suspend fun update(id:String,status:String,note:String?=null):PrayerRequest{val s=session();val root=http.patch(api("/api/v1/atendimentos/pedidos-reza/${enc(id)}"),buildJsonObject{put("tenantId",s.tenantId);put("status",status);if(note!=null)put("observacao_interna",note)},s.accessToken).jsonObject;return root["item"]!!.jsonObject.toModel()};private fun session()=sessions.current().also{check(it.isAuthenticated)};private fun api(p:String)=BuildConfig.API_BASE_URL.trimEnd('/')+p;private fun enc(v:String)=URLEncoder.encode(v,"UTF-8")}
private fun JsonObject.toModel()=PrayerRequest(text("id"),text("nome"),text("whatsapp"),text("mensagem"),text("status"),text("observacao_interna"),text("categoria"),text("linha"),text("vela"),text("nome_terreiro"),text("created_at"));private fun JsonObject.text(k:String)=runCatching{this[k]?.jsonPrimitive?.content}.getOrNull().orEmpty()
