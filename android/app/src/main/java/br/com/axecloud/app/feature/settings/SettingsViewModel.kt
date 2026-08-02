package br.com.axecloud.app.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(private val repo:SettingsRepository):ViewModel(){
    private val m=MutableStateFlow(SettingsUiState())
    val state=m.asStateFlow()
    init{load()}
    fun load()=viewModelScope.launch{m.update{it.copy(loading=true,error=null)};runCatching{repo.load()}.onSuccess{p->m.value=SettingsUiState(false,identity=p.identity,portal=p.portal,plan=p.plan)}.onFailure{e->m.update{it.copy(loading=false,error=e.message)}}}
    fun section(v:String)=m.update{it.copy(section=v,error=null)}
    fun identity(v:IdentitySettings)=m.update{it.copy(identity=v)}
    fun portal(v:PortalSettings)=m.update{it.copy(portal=v)}
    fun security(v:SecuritySettings)=m.update{it.copy(security=v,error=null)}
    fun deleteDialog(open:Boolean)=m.update{it.copy(deleteDialog=open,error=null)}
    fun consume()=m.update{it.copy(message=null)}
    fun save()=action("Configurações salvas."){if(m.value.section=="identidade")repo.saveIdentity(m.value.identity)else repo.savePortal(m.value.portal)}
    fun changeEmail(){val v=m.value.security;if(v.newEmail.isBlank()||v.emailPassword.isBlank()){m.update{it.copy(error="Informe o novo e-mail e a senha atual.")};return};action("E-mail alterado. Use o novo endereço no próximo login."){repo.changeEmail(v.newEmail,v.emailPassword);m.update{it.copy(identity=it.identity.copy(email=v.newEmail.trim().lowercase()),security=it.security.copy(newEmail="",emailPassword=""))}}}
    fun changePassword(){val v=m.value.security;when{v.currentPassword.isBlank()||v.newPassword.isBlank()||v.confirmPassword.isBlank()->{m.update{it.copy(error="Preencha todos os campos de senha.")};return};v.newPassword!=v.confirmPassword->{m.update{it.copy(error="A confirmação da nova senha não confere.")};return};v.newPassword.length<8->{m.update{it.copy(error="A nova senha precisa ter pelo menos 8 caracteres.")};return}};action("Senha alterada com segurança."){repo.changePassword(v.currentPassword,v.newPassword,v.confirmPassword);m.update{it.copy(security=it.security.copy(currentPassword="",newPassword="",confirmPassword=""))}}}
    fun deleteAccount(){val v=m.value.security;val email=m.value.identity.email.trim().lowercase();if(v.deleteEmail.trim().lowercase()!=email){m.update{it.copy(error="Digite exatamente o e-mail $email para confirmar.")};return};if(v.deletePassword.isBlank()){m.update{it.copy(error="Digite a senha atual para autorizar a exclusão.")};return};action("Conta excluída."){repo.deleteAccount(v.deleteEmail,v.deletePassword)}}
    private fun action(success:String,block:suspend()->Unit)=viewModelScope.launch{m.update{it.copy(saving=true,error=null)};runCatching{block()}.onSuccess{m.update{it.copy(saving=false,message=success,deleteDialog=false)}}.onFailure{e->m.update{it.copy(saving=false,error=e.message)}}}
}
