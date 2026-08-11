package br.com.axecloud.app.feature.childprofile
import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.serialization.json.*
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.net.URLEncoder
import javax.inject.Inject
class ChildProfileRepository @Inject constructor(private val http:AxeCloudHttpClient,private val sessions:SessionStore,@ApplicationContext private val context:Context){
    suspend fun load():Pair<ChildProfile,List<SpiritualMilestone>>{val s=session();val profile=http.get(api("/api/v1/filho/profile"),s.accessToken).jsonObject["data"]!!.jsonObject.model();val milestones=runCatching{http.get(api("/api/v1/filho/obligations"),s.accessToken).jsonObject["data"]?.jsonArray?.map{it.jsonObject.milestone()}.orEmpty()}.getOrDefault(emptyList());return profile to milestones}
    suspend fun save(p:ChildProfile):ChildProfile{val s=session();return http.patch(api("/api/v1/filho/profile"),buildJsonObject{put("telefone",p.phone);put("whatsapp",p.phone);put("endereco",p.address)},s.accessToken).jsonObject["data"]!!.jsonObject.model()}
    suspend fun downloadDocument(item:SpiritualMilestone):Uri{check(item.documentPath.isNotBlank()){"Documento indisponível."};val s=session();val path=URLEncoder.encode(item.documentPath,"UTF-8");val tenant=URLEncoder.encode(s.tenantId,"UTF-8");val bytes=http.getBytes(api("/api/v1/library/pdf-proxy?tenantId=$tenant&path=$path"),s.accessToken);val folder=File(context.cacheDir,"shared-documents").apply{mkdirs()};val safe=item.id.replace(Regex("[^a-zA-Z0-9_-]"),"_");val file=File(folder,"obrigacao-$safe.pdf");file.writeBytes(bytes);return FileProvider.getUriForFile(context,"${context.packageName}.files",file)}
    private fun session()=sessions.current().also{check(it.isAuthenticated&&it.isFilho)};private fun api(p:String)=BuildConfig.API_BASE_URL.trimEnd('/')+p
}
private fun JsonObject.model()=ChildProfile(t("id"),t("nome"),t("foto_url"),t("status"),t("cargo"),t("orixa_frente"),t("adjunto"),t("data_nascimento"),t("data_entrada"),t("data_feitura"),t("cpf"),t("telefone","whatsapp"),t("endereco"),t("quizilas"))
private fun JsonObject.milestone()=SpiritualMilestone(t("id"),t("title"),t("date"),t("time"),t("description"),t("status"),runCatching{this["hasDocument"]?.jsonPrimitive?.boolean ?: false}.getOrDefault(false),t("documentPath"))
private fun JsonObject.t(vararg k:String)=k.firstNotNullOfOrNull{x->runCatching{this[x]?.jsonPrimitive?.content}.getOrNull()?.takeIf(String::isNotBlank)}.orEmpty()
