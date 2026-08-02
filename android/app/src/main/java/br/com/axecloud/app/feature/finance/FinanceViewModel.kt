package br.com.axecloud.app.feature.finance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel class FinanceViewModel @Inject constructor(private val repo:FinanceRepository):ViewModel(){
 private val mutable=MutableStateFlow(FinanceUiState());val state=mutable.asStateFlow();init{load()}
 fun load()=viewModelScope.launch{mutable.update{it.copy(loading=true,error=null)};runCatching{repo.load()}.onSuccess{b->mutable.update{it.copy(loading=false,transactions=b.transactions,pending=b.pending,paid=b.paid,pix=b.pix,goals=b.goals,donations=b.donations)}}.onFailure{e->mutable.update{it.copy(loading=false,error=e.message)}}}
 fun section(v:FinanceSection)=mutable.update{it.copy(section=v)};fun createTransaction()=mutable.update{it.copy(creatingTransaction=true)};fun closeTransaction()=mutable.update{it.copy(creatingTransaction=false,error=null)};fun editPix()=mutable.update{it.copy(editingPix=true)};fun closePix()=mutable.update{it.copy(editingPix=false,error=null)};fun createGoal()=mutable.update{it.copy(creatingGoal=true)};fun closeGoal()=mutable.update{it.copy(creatingGoal=false,error=null)};fun consumeMessage()=mutable.update{it.copy(message=null)}
 fun saveTransaction(f:TransactionForm)=act("save","Lançamento registrado."){require(f.description.isNotBlank()){"Informe a descrição."};require((f.amount.toDoubleOrNull()?:0.0)>0){"Informe um valor válido."};repo.createTransaction(f)}
 fun delete(t:FinanceTransaction)=act(t.id,"Lançamento excluído."){repo.deleteTransaction(t.id)}
 fun settle(c:MonthlyCharge)=act(c.id,"Mensalidade liquidada."){repo.settle(c)}
 fun reverse(c:MonthlyCharge)=act(c.id,"Pagamento estornado."){repo.reverse(c)}
 fun savePix(p:PixConfig)=act("pix","Configuração Pix salva."){require(p.key.isNotBlank()){"Informe a chave Pix."};repo.savePix(p)}
 fun saveGoal(title:String,target:String)=act("goal","Meta criada."){require(title.isNotBlank()){"Informe o nome da meta."};repo.createGoal(title,target.toDoubleOrNull()?:0.0)}
 fun donation(d:CashDonation,ok:Boolean)=act(d.id,if(ok)"Doação confirmada." else "Doação rejeitada."){repo.validateDonation(d,ok)}
 private fun act(id:String,msg:String,block:suspend()->Unit)=viewModelScope.launch{mutable.update{it.copy(actionId=id,saving=true,error=null)};runCatching{block();repo.load()}.onSuccess{b->mutable.update{it.copy(saving=false,actionId=null,creatingTransaction=false,editingPix=false,creatingGoal=false,transactions=b.transactions,pending=b.pending,paid=b.paid,pix=b.pix,goals=b.goals,donations=b.donations,message=msg)}}.onFailure{e->mutable.update{it.copy(saving=false,actionId=null,error=e.message)}}}
}
