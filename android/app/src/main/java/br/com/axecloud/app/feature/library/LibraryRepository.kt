package br.com.axecloud.app.feature.library
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
class LibraryRepository @Inject constructor(private val http:AxeCloudHttpClient,private val sessions:SessionStore,@ApplicationContext private val context:Context){
 suspend fun load():Pair<Boolean,List<LibraryMaterial>>{val s=session();val root=http.get(api("/api/v1/library/materials?tenantId=${enc(s.tenantId)}"),s.accessToken);return s.isFilho to root.list().map{e->val o=e as? JsonObject?:JsonObject(emptyMap());LibraryMaterial(o.text("id"),o.text("titulo"),o.text("categoria").ifBlank{"Geral"},o.text("arquivo_url"),o.text("storage_path"),o.text("created_at"))}}
 suspend fun upload(uri:Uri,title:String,category:String){val s=session();check(!s.isFilho){"Acesso negado."};val mime=context.contentResolver.getType(uri)?:"application/pdf";check(mime=="application/pdf"){"Selecione um arquivo PDF."};val bytes=context.contentResolver.openInputStream(uri)?.use{it.readBytes()}?:error("Não foi possível ler o PDF.");check(bytes.size<=25*1024*1024){"O PDF deve ter no máximo 25 MB."};val fileName=fileName(uri).ifBlank{"material.pdf"};val prep=http.post(api("/api/v1/library/upload-url"),buildJsonObject{put("fileName",fileName);put("contentType","application/pdf");put("categoria",category);put("tenantId",s.tenantId)},s.accessToken) as JsonObject;val path=prep.text("path");val token=prep.text("token");check(path.isNotBlank()&&token.isNotBlank()){"O servidor não preparou o upload."};val encodedPath=path.split('/').joinToString("/"){enc(it)};val uploadUrl="${BuildConfig.SUPABASE_URL.trimEnd('/')}/storage/v1/object/upload/sign/$encodedPath?token=${enc(token)}";http.putBytes(uploadUrl,bytes,"application/pdf",mapOf("x-upsert" to "true"));http.post(api("/api/v1/library/complete-upload"),buildJsonObject{put("storagePath",path);put("titulo",title.trim());put("categoria",category);put("tenantId",s.tenantId)},s.accessToken)}
 suspend fun delete(id:String){val s=session();check(!s.isFilho);http.delete(api("/api/v1/library/material/${enc(id)}?tenantId=${enc(s.tenantId)}"),s.accessToken)}
 suspend fun comments(materialId:String):Triple<List<LibraryComment>,String,Boolean>{val s=session();val root=http.get(api("/api/v1/library/material/${enc(materialId)}/comments?tenantId=${enc(s.tenantId)}"),s.accessToken).jsonObject;val items=root["items"]?.jsonArray.orEmpty().map{val o=it.jsonObject;LibraryComment(o.text("id"),o.text("user_id"),o.text("texto"),o.text("parent_id"),o.text("authorName"),o.text("authorPhoto"),runCatching{o["leadership"]?.jsonPrimitive?.boolean?:false}.getOrDefault(false),o.text("created_at"))};return Triple(items,root.text("currentUserId"),runCatching{root["manager"]?.jsonPrimitive?.boolean?:false}.getOrDefault(false))}
 suspend fun comment(materialId:String,text:String,parentId:String?){val s=session();http.post(api("/api/v1/library/material/${enc(materialId)}/comments"),buildJsonObject{put("tenantId",s.tenantId);put("text",text.trim());if(!parentId.isNullOrBlank())put("parentId",parentId)},s.accessToken)}
 suspend fun deleteComment(id:String){val s=session();http.delete(api("/api/v1/library/comments/${enc(id)}?tenantId=${enc(s.tenantId)}"),s.accessToken)}
 private fun fileName(uri:Uri):String{context.contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME),null,null,null)?.use{if(it.moveToFirst())return it.getString(0).orEmpty()};return uri.lastPathSegment.orEmpty()}
 private fun session()=sessions.current().also{check(it.isAuthenticated){"Entre novamente."}};private fun api(p:String)=BuildConfig.API_BASE_URL.trimEnd('/')+p;private fun enc(v:String)=URLEncoder.encode(v,"UTF-8")
}
private fun JsonElement.list()=when(this){is JsonArray->this;is JsonObject->this["data"] as? JsonArray?:emptyList();else->emptyList()};private fun JsonObject.text(vararg k:String)=k.firstNotNullOfOrNull{runCatching{this[it]?.jsonPrimitive?.content}.getOrNull()?.takeIf(String::isNotBlank)}.orEmpty()
