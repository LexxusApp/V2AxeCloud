package br.com.axecloud.app.feature.settings
import androidx.lifecycle.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject
@HiltViewModel class SettingsViewModel @Inject constructor(private val repo:SettingsRepository):ViewModel(){private val m=MutableStateFlow(SettingsUiState());val state=m.asStateFlow();init{load()};fun load()=viewModelScope.launch{m.update{it.copy(loading=true,error=null)};runCatching{repo.load()}.onSuccess{p->m.value=SettingsUiState(false,identity=p.identity,portal=p.portal,plan=p.plan)}.onFailure{e->m.update{it.copy(loading=false,error=e.message)}}};fun section(v:String)=m.update{it.copy(section=v,error=null)};fun identity(v:IdentitySettings)=m.update{it.copy(identity=v)};fun portal(v:PortalSettings)=m.update{it.copy(portal=v)};fun consume()=m.update{it.copy(message=null)};fun save()=viewModelScope.launch{m.update{it.copy(saving=true,error=null)};runCatching{if(m.value.section=="identidade")repo.saveIdentity(m.value.identity)else repo.savePortal(m.value.portal)}.onSuccess{m.update{it.copy(saving=false,message="Configurações salvas.")}}.onFailure{e->m.update{it.copy(saving=false,error=e.message)}}}}
