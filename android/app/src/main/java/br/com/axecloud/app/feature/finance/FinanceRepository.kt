package br.com.axecloud.app.feature.finance

import br.com.axecloud.app.BuildConfig
import br.com.axecloud.app.core.network.AxeCloudHttpClient
import br.com.axecloud.app.core.session.SessionStore
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.net.URLEncoder
import javax.inject.Inject

data class FinanceBundle(val transactions: List<FinanceTransaction>, val pending: List<MonthlyCharge>, val paid: List<MonthlyCharge>, val pix: PixConfig, val goals: List<CashGoal>, val donations: List<CashDonation>)

class FinanceRepository @Inject constructor(private val http: AxeCloudHttpClient, private val sessions: SessionStore) {
    suspend fun load(): FinanceBundle = coroutineScope {
        val s = session(); check(!s.isFilho) { "Acesso exclusivo da zeladoria." }; val tenant = encode(s.tenantId)
        val txCall = async { http.get(api("/api/transactions?tenantId=$tenant&userRole=lider&limit=500"), s.accessToken) }
        val pendingCall = async { safeGet("/api/v1/financial/mensalidades?tenantId=$tenant&view=pendentes", s.accessToken) }
        val paidCall = async { safeGet("/api/v1/financial/mensalidades?tenantId=$tenant&view=pagas", s.accessToken) }
        val pixCall = async { safeGet("/api/v1/financial/pix-config?tenantId=$tenant", s.accessToken) }
        val goalsCall = async { safeGet("/api/v1/financial/caixinha?tenantId=$tenant", s.accessToken) }
        val transactions = txCall.await().asList("data").map { e -> val o=e.obj(); FinanceTransaction(o.text("id"), o.text("descricao").ifBlank { "Movimentação" }, o.text("categoria"), o.text("data").take(10), o.text("tipo", "fluxo"), o.num("valor"), o.text("status")) }
        fun monthly(root: JsonElement) = root.asList("data").map { e -> val o=e.obj(); FinanceMonthly(o) }
        val pix = pixCall.await().obj().obj("data")
        val goalRoot = goalsCall.await().obj()
        val goals = goalRoot.array("metas").map { e -> val o=e.obj(); CashGoal(o.text("id"), o.text("titulo"), o.num("valor_atual"), o.num("valor_alvo")) }
        val donations = goalRoot.array("pendingDonations").map { e ->
            val o=e.obj(); val goalId=o.text("meta_id")
            CashDonation(o.text("id"), goalId, goals.firstOrNull { it.id == goalId }?.title.orEmpty(), o.obj("filhos_de_santo").text("nome").ifBlank { "Doador" }, o.num("valor"))
        }
        FinanceBundle(
            transactions, monthly(pendingCall.await()), monthly(paidCall.await()),
            PixConfig(pix.text("chave_pix"), pix.text("tipo_chave").ifBlank { "CPF" }, pix.text("nome_beneficiario"), pix.num("valor_mensalidade").takeIf { it > 0 }?.toString().orEmpty(), pix.int("dia_vencimento").takeIf { it > 0 }?.toString() ?: "10", pix.bool("mensalidade_ativa") != false),
            goals, donations,
        )
    }
    suspend fun createTransaction(form: TransactionForm) { val s=session(); http.post(api("/api/transactions"), buildJsonObject { put("tenantId",s.tenantId); put("descricao",form.description.trim()); put("tipo",form.flow); put("categoria",form.category); put("valor",form.amount.toDouble()); put("data",form.date) },s.accessToken) }
    suspend fun deleteTransaction(id: String) { val s=session(); http.delete(api("/api/transactions/${encode(id)}"),s.accessToken) }
    suspend fun settle(charge: MonthlyCharge) { val s=session(); http.post(api("/api/v1/financial/mensalidades/liquidar"), buildJsonObject { put("id",charge.id); put("tenant_id",s.tenantId); put("valor",charge.amount) },s.accessToken) }
    suspend fun reverse(charge: MonthlyCharge) { val s=session(); http.post(api("/api/v1/financial/mensalidades/estornar"), buildJsonObject { put("id",charge.id); put("tenant_id",s.tenantId) },s.accessToken) }
    suspend fun sendCharge(charge: MonthlyCharge) { val s=session(); check(charge.childId.isNotBlank()){ "Esta mensalidade não está vinculada a um filho de santo." }; val parts=charge.dueDate.take(7).split("-"); val competence=if(parts.size==2)"${parts[1]}/${parts[0]}" else charge.dueDate; http.post(api("/api/whatsapp/send"),buildJsonObject{put("tipo","cobranca_mensalidade");put("filhoId",charge.childId);put("variables",buildJsonObject{put("nome_filho",charge.name);put("mes_ano",competence);put("valor",String.format(java.util.Locale.US,"%.2f",charge.amount));put("nome_terreiro",s.houseName)})},s.accessToken) }
    suspend fun savePix(config: PixConfig) { val s=session(); http.post(api("/api/v1/financial/pix-config"), buildJsonObject { put("terreiro_id",s.tenantId); put("chave_pix",config.key.trim()); put("tipo_chave",config.keyType); put("nome_beneficiario",config.beneficiary.trim()); put("valor_mensalidade",config.monthlyValue.toDoubleOrNull() ?: 0.0); put("dia_vencimento",config.dueDay.toIntOrNull() ?: 10); put("mensalidade_ativa",config.active) },s.accessToken) }
    suspend fun createGoal(title:String,target:Double) { val s=session(); http.post(api("/api/v1/financial/caixinha/meta"), buildJsonObject { put("tenantId",s.tenantId); put("titulo",title.trim()); put("valor_alvo",target) },s.accessToken) }
    suspend fun validateDonation(donation: CashDonation, approved:Boolean) { val s=session(); http.post(api("/api/v1/financial/caixinha/validate-donation"), buildJsonObject { put("tenantId",s.tenantId); put("donationId",donation.id); put("status",if(approved)"confirmado" else "rejeitado"); put("valor",donation.amount); put("metaId",donation.goalId); put("metaTitulo",donation.goalTitle) },s.accessToken) }
    private suspend fun safeGet(path:String,token:String)=runCatching{http.get(api(path),token)}.getOrElse{JsonObject(emptyMap())}
    private fun session()=sessions.current().also{check(it.isAuthenticated){"Entre novamente para continuar."}}
    private fun api(path:String)=BuildConfig.API_BASE_URL.trimEnd('/')+path
    private fun encode(v:String)=URLEncoder.encode(v,"UTF-8")
}
private fun FinanceMonthly(o:JsonObject):MonthlyCharge{val due=o.text("vencimento","data_vencimento","data").take(10);return MonthlyCharge(o.text("id"),o.text("filho_id"),o.text("nome","filho_nome","child_name").ifBlank{o.obj("filhos_de_santo").text("nome").ifBlank{"Mensalidade"}},due,listOf(due,o.text("status")).filter(String::isNotBlank).joinToString(" · "),o.num("valor"),o.text("status"))}
private fun JsonElement?.obj()=this as? JsonObject?:JsonObject(emptyMap())
private fun JsonObject.obj(key:String)=this[key].obj()
private fun JsonElement.asList(vararg keys:String)=when(this){is JsonArray->this;is JsonObject->keys.firstNotNullOfOrNull{this[it] as? JsonArray}?:emptyList();else->emptyList()}
private fun JsonObject.array(key:String)=this[key] as? JsonArray?:JsonArray(emptyList())
private fun JsonObject.text(vararg keys:String)=keys.firstNotNullOfOrNull{runCatching{this[it]?.jsonPrimitive?.content}.getOrNull()?.takeIf(String::isNotBlank)}.orEmpty()
private fun JsonObject.num(key:String)=runCatching{this[key]?.jsonPrimitive?.content?.toDouble()}.getOrNull()?:0.0
private fun JsonObject.int(key:String)=runCatching{this[key]?.jsonPrimitive?.content?.toInt()}.getOrNull()?:0
private fun JsonObject.bool(key:String)=runCatching{this[key]?.jsonPrimitive?.content?.toBooleanStrictOrNull()}.getOrNull()
