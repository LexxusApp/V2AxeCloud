package br.com.axecloud.app.feature.childprofile
data class ChildProfile(val id:String="",val name:String="",val photo:String="",val status:String="",val role:String="",val orixa:String="",val adjunto:String="",val birth:String="",val entry:String="",val feitura:String="",val cpf:String="",val phone:String="",val address:String="",val quizilas:String="",val obligations:String="")
data class ChildProfileUiState(val loading:Boolean=true,val saving:Boolean=false,val profile:ChildProfile=ChildProfile(),val editing:Boolean=false,val error:String?=null,val message:String?=null)
