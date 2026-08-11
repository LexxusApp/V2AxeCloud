package br.com.axecloud.app.feature.childprofile
import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.serialization.json.*
import javax.inject.Inject
class ChildProfileRepository @Inject constructor(private val http:AxeCloudHttpClient,private val sessions:SessionStore){
    suspend fun load():Pair<ChildProfile,List<SpiritualMilestone>>{val s=session();val profile=http.get(api("/api/v1/filho/profile"),s.accessToken).jsonObject["data"]!!.jsonObject.model();val milestones=runCatching{http.get(api("/api/v1/filho/obligations"),s.accessToken).jsonObject["data"]?.jsonArray?.map{it.jsonObject.milestone()}.orEmpty()}.getOrDefault(emptyList());return profile to milestones}
    suspend fun save(p:ChildProfile):ChildProfile{val s=session();return http.patch(api("/api/v1/filho/profile"),buildJsonObject{put("telefone",p.phone);put("whatsapp",p.phone);put("endereco",p.address)},s.accessToken).jsonObject["data"]!!.jsonObject.model()}
    private fun session()=sessions.current().also{check(it.isAuthenticated&&it.isFilho)};private fun api(p:String)=BuildConfig.API_BASE_URL.trimEnd('/')+p
}
private fun JsonObject.model()=ChildProfile(t("id"),t("nome"),t("foto_url"),t("status"),t("cargo"),t("orixa_frente"),t("adjunto"),t("data_nascimento"),t("data_entrada"),t("data_feitura"),t("cpf"),t("telefone","whatsapp"),t("endereco"),t("quizilas"))
private fun JsonObject.milestone()=SpiritualMilestone(t("id"),t("title"),t("date"),t("time"),t("description"),t("status"),runCatching{this["hasDocument"]?.jsonPrimitive?.boolean ?: false}.getOrDefault(false))
private fun JsonObject.t(vararg k:String)=k.firstNotNullOfOrNull{x->runCatching{this[x]?.jsonPrimitive?.content}.getOrNull()?.takeIf(String::isNotBlank)}.orEmpty()
