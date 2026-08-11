package br.com.axecloud.app.feature.finance

import android.content.Intent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material.icons.outlined.SwapVert
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens
import br.com.axecloud.app.feature.home.asMoney

@Composable fun FinanceRoute(vm:FinanceViewModel= hiltViewModel()){
 val state by vm.state.collectAsState();val snack=remember{SnackbarHostState()};LaunchedEffect(state.message){state.message?.let{snack.showSnackbar(it);vm.consumeMessage()}};FinanceScreen(state,snack,vm)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun FinanceScreen(state:FinanceUiState,snack:SnackbarHostState,vm:FinanceViewModel){
 var selectedTx by remember{mutableStateOf<FinanceTransaction?>(null)}
 Scaffold(containerColor=AxeCloudThemeTokens.Canvas,snackbarHost={SnackbarHost(snack)},floatingActionButton={if(state.section==FinanceSection.CASH)FloatingActionButton(vm::createTransaction,containerColor=AxeCloudThemeTokens.Gold,contentColor=AxeCloudThemeTokens.ForestDeep,shape=RoundedCornerShape(18.dp)){Icon(Icons.Outlined.Add,"Novo lançamento")}}){padding->
  Column(Modifier.fillMaxSize().padding(padding)){
   FinanceHero(state)
   FinanceTabs(state.section,vm::section)
   AnimatedContent(state.section,transitionSpec={fadeIn() togetherWith fadeOut()},label="finance-section",modifier=Modifier.weight(1f)){section->
    when(section){FinanceSection.CASH->CashSection(state,vm::load){selectedTx=it};FinanceSection.MONTHLY->MonthlySection(state,vm);FinanceSection.PIX->PixSection(state,vm::editPix);FinanceSection.GOALS->GoalsSection(state,vm)}
   }
  }
 }
 selectedTx?.let{tx->AlertDialog(onDismissRequest={selectedTx=null},icon={Icon(Icons.Outlined.DeleteOutline,null)},title={Text(tx.description)},text={Text("${tx.date.brDate()} · ${tx.category}\n${tx.amount.asMoney()}")},confirmButton={Button({selectedTx=null;vm.delete(tx)},colors=ButtonDefaults.buttonColors(containerColor=MaterialTheme.colorScheme.error)){Text("Excluir lançamento")}},dismissButton={TextButton({selectedTx=null}){Text("Fechar")}})}
 if(state.creatingTransaction)TransactionSheet(state.saving,state.error,vm::closeTransaction,vm::saveTransaction)
 if(state.editingPix)PixSheet(state.pix,state.saving,state.error,vm::closePix,vm::savePix)
 if(state.creatingGoal)GoalSheet(state.saving,state.error,vm::closeGoal,vm::saveGoal)
}

@Composable private fun FinanceHero(s:FinanceUiState){
 Surface(color=AxeCloudThemeTokens.Forest){Column(Modifier.fillMaxWidth().padding(horizontal=20.dp,vertical=18.dp)){Text("LIVRO CAIXA DA CASA",color=AxeCloudThemeTokens.Gold,fontSize=10.sp,fontWeight=FontWeight.Black,letterSpacing=1.sp);Row(verticalAlignment=Alignment.Bottom){Column(Modifier.weight(1f)){Text("Saldo disponível",color=AxeCloudThemeTokens.Ivory.copy(.66f),fontSize=11.sp);Text(s.balance.asMoney(),color=AxeCloudThemeTokens.Ivory,fontSize=33.sp,fontWeight=FontWeight.Black)};Surface(shape=RoundedCornerShape(14.dp),color=Color.White.copy(.08f)){Icon(Icons.Outlined.AccountBalanceWallet,null,Modifier.padding(12.dp),tint=AxeCloudThemeTokens.Gold)}};Spacer(Modifier.height(14.dp));Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){HeroMetric("Entradas",s.income,Color(0xFF62D6A1),Modifier.weight(1f));HeroMetric("Saídas",s.expense,Color(0xFFFF9C98),Modifier.weight(1f));HeroMetric("A receber",s.pending.sumOf{it.amount},AxeCloudThemeTokens.Gold,Modifier.weight(1f))}}}
}
@Composable private fun HeroMetric(label:String,value:Double,color:Color,modifier:Modifier)=Surface(modifier,shape=RoundedCornerShape(13.dp),color=Color.White.copy(.07f)){Column(Modifier.padding(10.dp)){Text(label.uppercase(),color=AxeCloudThemeTokens.Ivory.copy(.55f),fontSize=8.sp,fontWeight=FontWeight.Bold);Text(value.asMoney(),color=color,fontSize=12.sp,fontWeight=FontWeight.Black,maxLines=1)}}
@Composable private fun FinanceTabs(selected:FinanceSection,select:(FinanceSection)->Unit){Row(Modifier.fillMaxWidth().background(AxeCloudThemeTokens.ForestDeep).padding(horizontal=10.dp,vertical=8.dp),horizontalArrangement=Arrangement.spacedBy(5.dp)){FinanceSection.entries.forEach{section->FilterChip(selected==section,{select(section)},label={Text(when(section){FinanceSection.CASH->"Caixa";FinanceSection.MONTHLY->"Mensais";FinanceSection.PIX->"Pix";FinanceSection.GOALS->"Caixinha"},fontSize=10.sp)})}}}

@Composable private fun CashSection(s:FinanceUiState,retry:()->Unit,open:(FinanceTransaction)->Unit){val context=LocalContext.current;when{ s.loading->Loading();s.error!=null&&s.transactions.isEmpty()->ErrorBox(s.error,retry);s.transactions.isEmpty()->EmptyBox(Icons.Outlined.SwapVert,"O caixa começa aqui","Registre a primeira entrada ou saída da casa.");else->LazyColumn(contentPadding=androidx.compose.foundation.layout.PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){item{Row(verticalAlignment=Alignment.CenterVertically){Text("Movimentações",Modifier.weight(1f),color=AxeCloudThemeTokens.Ink,fontSize=19.sp,fontWeight=FontWeight.Black);OutlinedButton({shareFinanceReport(context,s.transactions)}){Icon(Icons.Outlined.Share,null);Spacer(Modifier.width(6.dp));Text("Relatório")}}};items(s.transactions,key={it.id}){tx->TransactionCard(tx){open(tx)}};item{Spacer(Modifier.height(75.dp))}}}}
@Composable private fun TransactionCard(tx:FinanceTransaction,click:()->Unit){val income=!tx.flow.contains("saida",true)&&!tx.flow.contains("saída",true);val color=if(income)Color(0xFF21805A)else Color(0xFFB84A48);Surface(Modifier.fillMaxWidth().clickable(onClick=click),shape=RoundedCornerShape(18.dp),color=Color.White,border=BorderStroke(1.dp,AxeCloudThemeTokens.Outline)){Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(42.dp).background(color.copy(.1f),CircleShape),contentAlignment=Alignment.Center){Icon(Icons.Outlined.Payments,null,tint=color)};Column(Modifier.weight(1f).padding(horizontal=11.dp)){Text(tx.description,color=AxeCloudThemeTokens.Ink,fontWeight=FontWeight.ExtraBold,maxLines=1,overflow=TextOverflow.Ellipsis);Text("${tx.date.brDate()} · ${tx.category}",color=AxeCloudThemeTokens.Muted,fontSize=10.sp)};Text((if(income)"+ " else "− ")+tx.amount.asMoney(),color=color,fontWeight=FontWeight.Black)}}}

@Composable private fun MonthlySection(s:FinanceUiState,vm:FinanceViewModel){var paid by rememberSaveable{mutableStateOf(false)};val list=if(paid)s.paid else s.pending;LazyColumn(contentPadding=androidx.compose.foundation.layout.PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){item{Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){FilterChip(!paid,{paid=false},label={Text("Pendentes ${s.pending.size}")});FilterChip(paid,{paid=true},label={Text("Pagas ${s.paid.size}")})}};if(list.isEmpty())item{EmptyBox(Icons.Outlined.CheckCircle,if(paid)"Nenhum pagamento no período" else "Tudo recebido","As mensalidades aparecerão aqui automaticamente.")}else items(list,key={it.id}){c->MonthlyCard(c,paid,s.actionId==c.id,if(paid){ {vm.reverse(c)} }else{{vm.settle(c)}},{vm.charge(c)})}}}
@Composable private fun MonthlyCard(c:MonthlyCharge,paid:Boolean,busy:Boolean,action:()->Unit,charge:()->Unit){Surface(shape=RoundedCornerShape(18.dp),color=Color.White,border=BorderStroke(1.dp,AxeCloudThemeTokens.Outline)){Row(Modifier.fillMaxWidth().padding(14.dp),verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text(c.name,color=AxeCloudThemeTokens.Ink,fontWeight=FontWeight.ExtraBold);Text(c.detail,color=AxeCloudThemeTokens.Muted,fontSize=10.sp);Text(c.amount.asMoney(),color=AxeCloudThemeTokens.Forest,fontWeight=FontWeight.Black)};Column(horizontalAlignment=Alignment.End){OutlinedButton(action,enabled=!busy){if(busy)CircularProgressIndicator(Modifier.size(16.dp),strokeWidth=2.dp)else Text(if(paid)"Estornar" else "Receber",fontSize=10.sp)};if(!paid&&c.childId.isNotBlank())TextButton(charge,enabled=!busy){Icon(Icons.Outlined.Chat,null,Modifier.size(16.dp));Spacer(Modifier.width(4.dp));Text("Cobrar",fontSize=10.sp)}}}}}

@Composable private fun PixSection(s:FinanceUiState,edit:()->Unit){LazyColumn(contentPadding=androidx.compose.foundation.layout.PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Surface(shape=RoundedCornerShape(24.dp),color=Color.White,border=BorderStroke(1.dp,AxeCloudThemeTokens.Outline)){Column(Modifier.fillMaxWidth().padding(20.dp)){Row(verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(48.dp).background(AxeCloudThemeTokens.Gold.copy(.18f),RoundedCornerShape(15.dp)),contentAlignment=Alignment.Center){Icon(Icons.Outlined.QrCode2,null,tint=AxeCloudThemeTokens.Forest)};Column(Modifier.weight(1f).padding(start=12.dp)){Text("Recebimento Pix",color=AxeCloudThemeTokens.Ink,fontSize=19.sp,fontWeight=FontWeight.Black);Text(if(s.pix.active)"Mensalidade ativa" else "Mensalidade pausada",color=if(s.pix.active)Color(0xFF21805A)else AxeCloudThemeTokens.Muted,fontSize=11.sp)}};Spacer(Modifier.height(18.dp));Info("Chave",s.pix.key.ifBlank{"Não configurada"});Info("Beneficiário",s.pix.beneficiary.ifBlank{"Não configurado"});Info("Mensalidade","${s.pix.monthlyValue.toDoubleOrNull()?.asMoney()?:"R$ 0,00"} · vence dia ${s.pix.dueDay}");Button(edit,Modifier.fillMaxWidth().padding(top=12.dp),colors=ButtonDefaults.buttonColors(containerColor=AxeCloudThemeTokens.Forest)){Text("Configurar recebimento")}}}}}}
@Composable private fun Info(label:String,value:String){Text(label.uppercase(),color=AxeCloudThemeTokens.GoldStrong,fontSize=9.sp,fontWeight=FontWeight.Black);Text(value,color=AxeCloudThemeTokens.Ink,fontWeight=FontWeight.Bold);Spacer(Modifier.height(10.dp))}

@Composable private fun GoalsSection(s:FinanceUiState,vm:FinanceViewModel){LazyColumn(contentPadding=androidx.compose.foundation.layout.PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){item{Row(verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text("Caixinha da casa",color=AxeCloudThemeTokens.Ink,fontSize=20.sp,fontWeight=FontWeight.Black);Text("Metas e doações transparentes",color=AxeCloudThemeTokens.Muted,fontSize=11.sp)};Button(vm::createGoal,colors=ButtonDefaults.buttonColors(containerColor=AxeCloudThemeTokens.Forest)){Icon(Icons.Outlined.Add,null);Text("Meta")}}};if(s.goals.isEmpty())item{EmptyBox(Icons.Outlined.Savings,"Nenhuma meta ativa","Crie uma meta para uma necessidade coletiva da casa.")}else items(s.goals,key={it.id}){g->GoalCard(g)};if(s.donations.isNotEmpty()){item{Text("Doações aguardando validação",color=AxeCloudThemeTokens.Ink,fontWeight=FontWeight.Black)};items(s.donations,key={it.id}){d->Surface(shape=RoundedCornerShape(17.dp),color=Color.White,border=BorderStroke(1.dp,AxeCloudThemeTokens.Outline)){Row(Modifier.fillMaxWidth().padding(13.dp),verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text(d.donor,color=AxeCloudThemeTokens.Ink,fontWeight=FontWeight.Bold);Text(d.amount.asMoney(),color=AxeCloudThemeTokens.Forest,fontWeight=FontWeight.Black)};TextButton({vm.donation(d,false)}){Text("Recusar")};Button({vm.donation(d,true)},colors=ButtonDefaults.buttonColors(containerColor=AxeCloudThemeTokens.Forest)){Text("Confirmar")}}}}}}}
@Composable private fun GoalCard(g:CashGoal){val p=if(g.target>0)(g.current/g.target).coerceIn(0.0,1.0)else 0.0;Surface(shape=RoundedCornerShape(20.dp),color=AxeCloudThemeTokens.Forest){Column(Modifier.fillMaxWidth().padding(17.dp)){Text(g.title,color=AxeCloudThemeTokens.Ivory,fontWeight=FontWeight.Black,fontSize=17.sp);Text("${g.current.asMoney()} de ${g.target.asMoney()}",color=AxeCloudThemeTokens.Gold,fontWeight=FontWeight.Bold);Spacer(Modifier.height(10.dp));androidx.compose.material3.LinearProgressIndicator(progress={p.toFloat()},Modifier.fillMaxWidth().height(7.dp),color=AxeCloudThemeTokens.Gold,trackColor=Color.White.copy(.12f))}}}

@OptIn(ExperimentalMaterial3Api::class) @Composable private fun TransactionSheet(saving:Boolean,error:String?,dismiss:()->Unit,save:(TransactionForm)->Unit){var f by rememberSaveable{mutableStateOf(TransactionForm())};ModalBottomSheet(onDismissRequest=dismiss,containerColor=AxeCloudThemeTokens.Canvas){Column(Modifier.navigationBarsPadding().padding(horizontal=20.dp).padding(bottom=24.dp),verticalArrangement=Arrangement.spacedBy(11.dp)){Text("Novo lançamento",color=AxeCloudThemeTokens.Ink,fontSize=24.sp,fontWeight=FontWeight.Black);Field(f.description,{f=f.copy(description=it)},"Descrição");Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){FilterChip(f.flow=="entrada",{f=f.copy(flow="entrada")},label={Text("Entrada")});FilterChip(f.flow=="saida",{f=f.copy(flow="saida")},label={Text("Saída")})};Field(f.category,{f=f.copy(category=it)},"Categoria");Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Field(f.amount,{f=f.copy(amount=it)},"Valor",Modifier.weight(1f));Field(f.date,{f=f.copy(date=it.take(10))},"AAAA-MM-DD",Modifier.weight(1f))};error?.let{Text(it,color=MaterialTheme.colorScheme.error)};Button({save(f)},Modifier.fillMaxWidth().height(52.dp),enabled=!saving,colors=ButtonDefaults.buttonColors(containerColor=AxeCloudThemeTokens.Forest)){Text("Registrar movimentação")}}}}
@OptIn(ExperimentalMaterial3Api::class) @Composable private fun PixSheet(initial:PixConfig,saving:Boolean,error:String?,dismiss:()->Unit,save:(PixConfig)->Unit){var p by rememberSaveable{mutableStateOf(initial)};ModalBottomSheet(onDismissRequest=dismiss,containerColor=AxeCloudThemeTokens.Canvas){LazyColumn(contentPadding=androidx.compose.foundation.layout.PaddingValues(horizontal=20.dp,vertical=12.dp),verticalArrangement=Arrangement.spacedBy(11.dp)){item{Text("Configuração Pix",color=AxeCloudThemeTokens.Ink,fontSize=24.sp,fontWeight=FontWeight.Black)};item{Field(p.key,{p=p.copy(key=it)},"Chave Pix")};item{Field(p.keyType,{p=p.copy(keyType=it)},"Tipo da chave")};item{Field(p.beneficiary,{p=p.copy(beneficiary=it)},"Beneficiário")};item{Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Field(p.monthlyValue,{p=p.copy(monthlyValue=it)},"Mensalidade",Modifier.weight(1f));Field(p.dueDay,{p=p.copy(dueDay=it.take(2))},"Dia",Modifier.weight(1f))}};item{Row(verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text("Cobrança mensal ativa",fontWeight=FontWeight.Bold);Text("Gera pendências para a corrente",fontSize=10.sp,color=AxeCloudThemeTokens.Muted)};Switch(p.active,{p=p.copy(active=it)})}};error?.let{item{Text(it,color=MaterialTheme.colorScheme.error)}};item{Button({save(p)},Modifier.fillMaxWidth().height(52.dp),enabled=!saving,colors=ButtonDefaults.buttonColors(containerColor=AxeCloudThemeTokens.Forest)){Text("Salvar configuração")};Spacer(Modifier.height(20.dp))}}}}
@OptIn(ExperimentalMaterial3Api::class) @Composable private fun GoalSheet(saving:Boolean,error:String?,dismiss:()->Unit,save:(String,String)->Unit){var title by rememberSaveable{mutableStateOf("")};var target by rememberSaveable{mutableStateOf("")};ModalBottomSheet(onDismissRequest=dismiss,containerColor=AxeCloudThemeTokens.Canvas){Column(Modifier.navigationBarsPadding().padding(horizontal=20.dp).padding(bottom=24.dp),verticalArrangement=Arrangement.spacedBy(11.dp)){Text("Nova meta coletiva",color=AxeCloudThemeTokens.Ink,fontSize=24.sp,fontWeight=FontWeight.Black);Field(title,{title=it},"Nome da meta");Field(target,{target=it},"Valor desejado");error?.let{Text(it,color=MaterialTheme.colorScheme.error)};Button({save(title,target)},Modifier.fillMaxWidth().height(52.dp),enabled=!saving,colors=ButtonDefaults.buttonColors(containerColor=AxeCloudThemeTokens.Forest)){Text("Criar meta")}}}}
@Composable private fun Field(v:String,c:(String)->Unit,l:String,m:Modifier=Modifier.fillMaxWidth())=OutlinedTextField(v,c,m,label={Text(l)},singleLine=true,shape=RoundedCornerShape(15.dp))
@Composable private fun Loading()=Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){CircularProgressIndicator(color=AxeCloudThemeTokens.Forest)}
@Composable private fun ErrorBox(msg:String,retry:()->Unit)=Column(Modifier.fillMaxWidth().padding(30.dp),horizontalAlignment=Alignment.CenterHorizontally){Text(msg);OutlinedButton(retry){Icon(Icons.Outlined.Refresh,null);Text("Tentar novamente")}}
@Composable private fun EmptyBox(icon:ImageVector,title:String,body:String)=Surface(shape=RoundedCornerShape(20.dp),color=Color.White,border=BorderStroke(1.dp,AxeCloudThemeTokens.Outline)){Column(Modifier.fillMaxWidth().padding(28.dp),horizontalAlignment=Alignment.CenterHorizontally){Icon(icon,null,Modifier.size(35.dp),tint=AxeCloudThemeTokens.Forest);Text(title,color=AxeCloudThemeTokens.Ink,fontWeight=FontWeight.Black,fontSize=17.sp);Text(body,color=AxeCloudThemeTokens.Muted,fontSize=11.sp)}}
private fun String.brDate()=takeIf{Regex("\\d{4}-\\d{2}-\\d{2}").matches(it)}?.let{"${it.takeLast(2)}/${it.substring(5,7)}/${it.take(4)}"}?:this
private fun shareFinanceReport(context:android.content.Context,transactions:List<FinanceTransaction>){val csv=buildString{appendLine("Data,Tipo,Categoria,Valor,Descrição");transactions.forEach{t->append(t.date).append(',').append(t.flow.uppercase()).append(',').append(t.category.replace(","," ")).append(',').append(String.format(java.util.Locale.US,"%.2f",t.amount)).append(',').append('"').append(t.description.replace("\"","\"\"")).appendLine('"')}};context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply{type="text/csv";putExtra(Intent.EXTRA_SUBJECT,"Relatório financeiro AxéCloud");putExtra(Intent.EXTRA_TEXT,csv)},"Compartilhar relatório"))}
