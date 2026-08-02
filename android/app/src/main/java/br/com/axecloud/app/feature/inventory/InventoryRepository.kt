package br.com.axecloud.app.feature.inventory
import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.serialization.json.*
import java.net.URLEncoder
import javax.inject.Inject
class InventoryRepository @Inject constructor(private val http:AxeCloudHttpClient,private val sessions:SessionStore){
 suspend fun load():List<InventoryItem>{val s=session();return http.get(api("/api/inventory?tenantId=${enc(s.tenantId)}"),s.accessToken).list().map{e->val o=e as? JsonObject?:JsonObject(emptyMap());InventoryItem(o.text("id"),o.text("item","nome"),o.text("categoria").ifBlank{"Geral"},o.int("quantidade_atual"),o.int("quantidade_minima"))}}
 suspend fun save(id:String?,f:InventoryForm){val s=session();val body=buildJsonObject{put("tenantId",s.tenantId);put("autorId",s.userId);put("item",f.name.trim());put("categoria",f.category.trim());put("quantidade_atual",f.quantity.toIntOrNull()?:0);put("quantidade_minima",f.minimum.toIntOrNull()?:0)};if(id==null)http.post(api("/api/inventory"),body,s.accessToken)else http.patch(api("/api/inventory/${enc(id)}"),body,s.accessToken)}
 suspend fun delete(id:String){val s=session();http.delete(api("/api/inventory/${enc(id)}?tenantId=${enc(s.tenantId)}"),s.accessToken)}
 private fun session()=sessions.current().also{check(it.isAuthenticated&&!it.isFilho){"Acesso exclusivo da zeladoria."}};private fun api(p:String)=BuildConfig.API_BASE_URL.trimEnd('/')+p;private fun enc(v:String)=URLEncoder.encode(v,"UTF-8")
}
private fun JsonElement.list()=when(this){is JsonArray->this;is JsonObject->listOfNotNull(this["data"] as? JsonArray,this["items"] as? JsonArray).firstOrNull()?:emptyList();else->emptyList()}
private fun JsonObject.text(vararg k:String)=k.firstNotNullOfOrNull{runCatching{this[it]?.jsonPrimitive?.content}.getOrNull()?.takeIf(String::isNotBlank)}.orEmpty();private fun JsonObject.int(k:String)=runCatching{this[k]?.jsonPrimitive?.content?.toInt()}.getOrNull()?:0
