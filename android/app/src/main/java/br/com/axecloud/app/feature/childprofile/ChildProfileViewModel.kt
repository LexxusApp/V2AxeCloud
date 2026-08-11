package br.com.axecloud.app.feature.childprofile
import androidx.lifecycle.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject
@HiltViewModel class ChildProfileViewModel @Inject constructor(private val repo:ChildProfileRepository):ViewModel(){private val m=MutableStateFlow(ChildProfileUiState());val state=m.asStateFlow();init{load()};fun load()=viewModelScope.launch{m.update{it.copy(loading=true,error=null)};runCatching{repo.load()}.onSuccess{(p,items)->m.update{it.copy(loading=false,profile=p,milestones=items)}}.onFailure{e->m.update{it.copy(loading=false,error=e.message)}}};fun edit(v:Boolean)=m.update{it.copy(editing=v,error=null)};fun consume()=m.update{it.copy(message=null)};fun save(p:ChildProfile)=viewModelScope.launch{m.update{it.copy(saving=true,error=null)};runCatching{repo.save(p)}.onSuccess{x->m.update{it.copy(saving=false,editing=false,profile=x,message="Contato atualizado.")}}.onFailure{e->m.update{it.copy(saving=false,error=e.message)}}}}
