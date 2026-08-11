package br.com.axecloud.app.feature.settings
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import br.com.axecloud.app.BuildConfig
private val SettingsBlue=Color(0xFF2D5E75);private val SettingsSky=Color(0xFF73CBE7)
@Composable fun SettingsRoute(vm:SettingsViewModel= hiltViewModel()){val s by vm.state.collectAsState();val snack=remember{SnackbarHostState()};LaunchedEffect(s.message){s.message?.let{snack.showSnackbar(it);vm.consume()}};SettingsScreen(s,snack,vm)}
@Composable private fun SettingsScreen(s:SettingsUiState,snack:SnackbarHostState,vm:SettingsViewModel){val ctx=LocalContext.current;Scaffold(containerColor=AxeCloudThemeTokens.Canvas,snackbarHost={SnackbarHost(snack)}){p->Column(Modifier.fillMaxSize().padding(p)){if(s.loading)Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){CircularProgressIndicator()}else{Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(17.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){SettingsHero(s);Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)){listOf("identidade" to "Identidade","seguranca" to "Segurança","whatsapp" to "WhatsApp","portal" to "Portal público","notificacoes" to "Notificações","plano" to "Plano","sobre" to "Sobre").forEach{(k,v)->FilterChip(s.section==k,{vm.section(k)},label={Text(v)})}};when(s.section){"identidade"->IdentityForm(s.identity,vm::identity);"seguranca"->AccountSecurityPanel(s,vm);"whatsapp"->WhatsAppSettingsPanel(s,vm);"portal"->PortalForm(s.portal,vm::portal);"notificacoes"->NotificationSettings{ctx.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,ctx.packageName))};"plano"->PlanSettings(s.subscription);else->AboutSettings()};s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)};if(s.section in listOf("identidade","portal"))Button(vm::save,Modifier.fillMaxWidth().height(54.dp),enabled=!s.saving,colors=ButtonDefaults.buttonColors(containerColor=SettingsBlue),shape=RoundedCornerShape(17.dp)){Text("Salvar alterações")};Spacer(Modifier.height(30.dp))}}}};if(s.deleteDialog)DeleteAccountDialog(s,vm)}
@Composable private fun SettingsHero(s:SettingsUiState)=Surface(shape=RoundedCornerShape(29.dp),color=SettingsBlue,shadowElevation=8.dp){Box(Modifier.background(Brush.linearGradient(listOf(SettingsBlue,Color(0xFF183A49))))){Column(Modifier.padding(22.dp)){Row(verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(46.dp).background(SettingsSky,RoundedCornerShape(16.dp)),contentAlignment=Alignment.Center){Icon(Icons.Outlined.Tune,null,tint=SettingsBlue)};Column(Modifier.padding(start=12.dp)){Text("CENTRAL DA CASA",color=SettingsSky,fontSize=9.sp,fontWeight=FontWeight.Black,letterSpacing=1.sp);Text("Configurações",color=Color.White,fontSize=27.sp,fontWeight=FontWeight.Black)}};Text("Identidade, presença pública e preferências reunidas com clareza.",color=Color.White.copy(.65f),fontSize=11.sp,modifier=Modifier.padding(top=15.dp))}}}
@Composable private fun IdentityForm(v:IdentitySettings,on:(IdentitySettings)->Unit)=SettingsPanel("Identidade da casa",Icons.Outlined.Badge){Field(v.houseName,{on(v.copy(houseName=it))},"Nome do terreiro");Field(v.leaderName,{on(v.copy(leaderName=it))},"Nome do zelador(a)");Field(v.role,{on(v.copy(role=it))},"Cargo litúrgico");Field(v.email,{},"E-mail de acesso",enabled=false)}
@Composable
private fun PortalForm(v:PortalSettings,on:(PortalSettings)->Unit) {
    val ctx = LocalContext.current
    val publicUrl = resolvePublicPortalUrl(v.publicUrl,v.slug)
    fun open(url:String) { if(url.isNotBlank()) CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(ctx,Uri.parse(url)) }
    fun share(url:String) { if(url.isNotBlank()) ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,"Conheça nossa casa no AxéCloud: $url"),"Compartilhar portal")) }
    SettingsPanel("Presença pública",Icons.Outlined.Public) {
        Surface(shape=RoundedCornerShape(21.dp),color=Color(0xFF123B47)) {
            Column(Modifier.fillMaxWidth().padding(17.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Box(Modifier.size(42.dp).background(SettingsSky.copy(.16f),RoundedCornerShape(14.dp)),contentAlignment=Alignment.Center){Icon(Icons.Outlined.Language,null,tint=SettingsSky)}
                    Column(Modifier.weight(1f).padding(horizontal=10.dp)){Text("VITRINE DIGITAL",color=SettingsSky,fontSize=9.sp,fontWeight=FontWeight.Black,letterSpacing=.8.sp);Text(if(v.publicActive)"Casa visível no AxéCloud" else "Portal em preparação",color=Color.White,fontWeight=FontWeight.Black,fontSize=17.sp)}
                    Surface(shape=RoundedCornerShape(50),color=if(v.verified)Color(0xFF1C7058)else Color.White.copy(.1f)){Text(if(v.verified)"VERIFICADA" else "EM ANÁLISE",Modifier.padding(horizontal=9.dp,vertical=5.dp),color=if(v.verified)Color(0xFF75E0B9)else Color.White.copy(.7f),fontSize=8.sp,fontWeight=FontWeight.Black)}
                }
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    PortalMetric(v.views.toString(),"visitas",Modifier.weight(1f))
                    PortalMetric(v.city.ifBlank{"sem cidade"},"localização",Modifier.weight(1f))
                }
                if(publicUrl.isNotBlank()) Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                    Button({open(publicUrl)},Modifier.weight(1f),colors=ButtonDefaults.buttonColors(containerColor=SettingsSky,contentColor=Color(0xFF123B47))){Icon(Icons.Outlined.Visibility,null);Spacer(Modifier.width(5.dp));Text("Ver portal")}
                    OutlinedButton({share(publicUrl)},Modifier.weight(1f),colors=ButtonDefaults.outlinedButtonColors(contentColor=Color.White)){Icon(Icons.Outlined.Share,null);Spacer(Modifier.width(5.dp));Text("Compartilhar")}
                }
            }
        }
        Toggle("Exibir no diretório público",v.publicActive){on(v.copy(publicActive=it))}
        Toggle("Receber pedidos de reza",v.prayerActive){on(v.copy(prayerActive=it))}
        Text("TRADIÇÃO DA CASA",color=SettingsBlue,fontSize=9.sp,fontWeight=FontWeight.Black,letterSpacing=.7.sp)
        Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)) {
            listOf("mista" to "Mista","umbanda" to "Umbanda","candomble" to "Candomblé","jurema" to "Jurema").forEach { (key,label) -> FilterChip(v.tradition==key,{on(v.copy(tradition=key))},label={Text(label)}) }
        }
        Field(v.slug,{raw->on(v.copy(slug=normalizePublicSlug(raw)))},"Endereço público")
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Field(v.city,{on(v.copy(city=it))},"Cidade",Modifier.weight(1f));Field(v.state,{on(v.copy(state=it.uppercase().take(2)))},"UF",Modifier.weight(.4f))}
        Field(v.neighborhood,{on(v.copy(neighborhood=it))},"Bairro")
        Field(v.whatsapp,{on(v.copy(whatsapp=it.filter(Char::isDigit).take(15)))},"WhatsApp público")
        Field(v.description,{on(v.copy(description=it))},"Apresentação da casa",minLines=3)
        Field(v.prayerMessage,{on(v.copy(prayerMessage=it))},"Mensagem de acolhimento",minLines=2)
        if(v.prayerListUrl.isNotBlank()) OutlinedButton({open(if(v.prayerListUrl.startsWith("http"))v.prayerListUrl else "https://axecloud.com.br${v.prayerListUrl}")},Modifier.fillMaxWidth()){Icon(Icons.Outlined.VolunteerActivism,null);Spacer(Modifier.width(7.dp));Text("Abrir pedidos públicos")}
    }
}

@Composable private fun PortalMetric(value:String,label:String,modifier:Modifier=Modifier)=Surface(modifier,shape=RoundedCornerShape(13.dp),color=Color.White.copy(.08f)){Column(Modifier.padding(11.dp)){Text(value,color=Color.White,fontWeight=FontWeight.Black,maxLines=1);Text(label,color=Color.White.copy(.58f),fontSize=9.sp)}}
@Composable private fun NotificationSettings(open:()->Unit)=SettingsPanel("Avisos do aplicativo",Icons.Outlined.NotificationsActive){Text("O Android controla som, vibração, tela bloqueada e permissões do AxéCloud.",color=AxeCloudThemeTokens.Muted,fontSize=12.sp);Button(open,Modifier.fillMaxWidth(),colors=ButtonDefaults.buttonColors(containerColor=SettingsBlue)){Text("Abrir permissões do Android")};Info("Pendências reais","Mensalidades, giras, preceitos e comunicados alimentam a caixa nativa.");Info("Push em segundo plano","Será ativado com o projeto Firebase da publicação na Play Store.")}
@Composable private fun AboutSettings(){val ctx=LocalContext.current;fun open(url:String){CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(ctx,Uri.parse(url))};SettingsPanel("Sobre o AxéCloud",Icons.Outlined.Info){Info("Versão ${BuildConfig.VERSION_NAME}","Aplicativo Android nativo para gestão de terreiros.");OutlinedButton({open("https://axecloud.com.br/privacidade")},Modifier.fillMaxWidth()){Icon(Icons.Outlined.PrivacyTip,null);Spacer(Modifier.width(7.dp));Text("Política de privacidade")};OutlinedButton({open("https://axecloud.com.br/termos")},Modifier.fillMaxWidth()){Icon(Icons.Outlined.Description,null);Spacer(Modifier.width(7.dp));Text("Termos de uso")};Text("Dados protegidos em trânsito por HTTPS e, no cache offline, pelo Android Keystore.",color=AxeCloudThemeTokens.Muted,fontSize=10.sp)}}
@Composable private fun PlanSettings(value:SubscriptionSettings){val ctx=LocalContext.current;val active=value.status=="active"||value.lifetime;val cycle=if(value.billingCycle=="annual")"anual" else "mensal";val price=if(value.billingCycle=="annual")value.annualPrice else value.monthlyPrice;SettingsPanel("Assinatura AxéCloud",Icons.Outlined.WorkspacePremium){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Column{Text(value.plan.ifBlank{"Premium"}.uppercase(),color=SettingsBlue,fontSize=22.sp,fontWeight=FontWeight.Black);Text(if(value.trial)"Teste gratuito" else if(active)"Plano ativo" else "Assinatura pendente",color=if(active)Color(0xFF27845D)else Color(0xFFB47B1A),fontSize=10.sp,fontWeight=FontWeight.Black)}};Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){PlanMetric(if(value.lifetime)"Vitalício" else value.expiresAt.take(10).ifBlank{"Não definida"},"validade",Modifier.weight(1f));PlanMetric(if(price>0)"R$ ${String.format(java.util.Locale("pt","BR"),"%,.2f",price)}" else cycle,"ciclo $cycle",Modifier.weight(1f))};listOf("Gestão completa da casa","Financeiro, PIX e relatórios","Loja, estoque e biblioteca","Aplicativo para toda a corrente").forEach{Info(it,"Incluído no plano atual.")};if(!value.lifetime)Button({val url="https://axecloud.com.br/assinatura/renovar?tenant=${Uri.encode(value.tenantId)}&billing=${Uri.encode(value.billingCycle)}";CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(ctx,Uri.parse(url))},Modifier.fillMaxWidth().height(52.dp),colors=ButtonDefaults.buttonColors(containerColor=SettingsBlue),shape=RoundedCornerShape(16.dp)){Icon(Icons.Outlined.Bolt,null);Spacer(Modifier.width(7.dp));Text(if(value.trial)"Assinar agora" else "Renovar assinatura")};Text("Pagamento protegido no checkout oficial EFI dentro de uma aba segura do Android.",color=AxeCloudThemeTokens.Muted,fontSize=10.sp)}}
@Composable private fun PlanMetric(value:String,label:String,modifier:Modifier)=Surface(modifier,shape=RoundedCornerShape(15.dp),color=AxeCloudThemeTokens.Canvas){Column(Modifier.padding(12.dp)){Text(value,color=AxeCloudThemeTokens.Ink,fontWeight=FontWeight.Black,fontSize=13.sp);Text(label,color=AxeCloudThemeTokens.Muted,fontSize=9.sp)}}
@Composable private fun SettingsPanel(title:String,icon:androidx.compose.ui.graphics.vector.ImageVector,content:@Composable ColumnScope.()->Unit)=Surface(shape=RoundedCornerShape(22.dp),color=Color.White,border=BorderStroke(1.dp,AxeCloudThemeTokens.Outline)){Column(Modifier.fillMaxWidth().padding(17.dp),verticalArrangement=Arrangement.spacedBy(11.dp)){Row(verticalAlignment=Alignment.CenterVertically){Icon(icon,null,tint=SettingsBlue);Text(title,Modifier.padding(start=9.dp),color=AxeCloudThemeTokens.Ink,fontSize=18.sp,fontWeight=FontWeight.Black)};content()}}
@Composable private fun Field(v:String,c:(String)->Unit,l:String,m:Modifier=Modifier.fillMaxWidth(),enabled:Boolean=true,minLines:Int=1)=OutlinedTextField(v,c,m,label={Text(l)},enabled=enabled,minLines=minLines,maxLines=if(minLines>1)5 else 1,shape=RoundedCornerShape(15.dp));@Composable private fun Toggle(t:String,v:Boolean,c:(Boolean)->Unit)=Row(Modifier.fillMaxWidth().background(AxeCloudThemeTokens.Canvas,RoundedCornerShape(15.dp)).padding(12.dp),verticalAlignment=Alignment.CenterVertically){Text(t,Modifier.weight(1f),fontWeight=FontWeight.Bold);Switch(v,c)};@Composable private fun Info(t:String,d:String)=Row{Icon(Icons.Outlined.CheckCircle,null,tint=SettingsSky);Column(Modifier.padding(start=8.dp)){Text(t,fontWeight=FontWeight.Bold);Text(d,color=AxeCloudThemeTokens.Muted,fontSize=10.sp)}}
