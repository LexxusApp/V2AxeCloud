package br.com.axecloud.app.feature.settings
data class PortalSettings(val tradition:String="mista",val slug:String="",val prayerActive:Boolean=false,val prayerMessage:String="",val publicActive:Boolean=false,val city:String="",val state:String="",val neighborhood:String="",val whatsapp:String="",val description:String="",val views:Int=0,val publicUrl:String="")
data class IdentitySettings(val houseName:String="",val leaderName:String="",val role:String="Zelador",val email:String="",val photo:String="")
data class SettingsUiState(val loading:Boolean=true,val saving:Boolean=false,val identity:IdentitySettings=IdentitySettings(),val portal:PortalSettings=PortalSettings(),val plan:String="",val section:String="identidade",val error:String?=null,val message:String?=null)
