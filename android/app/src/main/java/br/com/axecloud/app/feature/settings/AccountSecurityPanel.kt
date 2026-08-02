package br.com.axecloud.app.feature.settings

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

@Composable
fun AccountSecurityPanel(s:SettingsUiState,vm:SettingsViewModel){
    Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
        SecurityCard("Alterar e-mail",Icons.Outlined.Mail,Color(0xFF2D6A8A)){
            Text("E-mail atual: ${s.identity.email}",color=AxeCloudThemeTokens.Muted,fontSize=11.sp)
            SecurityField(s.security.newEmail,{vm.security(s.security.copy(newEmail=it))},"Novo e-mail")
            SecurityField(s.security.emailPassword,{vm.security(s.security.copy(emailPassword=it))},"Senha atual",true)
            Button(vm::changeEmail,Modifier.fillMaxWidth(),enabled=!s.saving,colors=ButtonDefaults.buttonColors(containerColor=Color(0xFF2D6A8A))){Text("Confirmar novo e-mail")}
        }
        SecurityCard("Alterar senha",Icons.Outlined.Lock,Color(0xFF9B6B16)){
            SecurityField(s.security.currentPassword,{vm.security(s.security.copy(currentPassword=it))},"Senha atual",true)
            SecurityField(s.security.newPassword,{vm.security(s.security.copy(newPassword=it))},"Nova senha",true)
            Text("Use 8 ou mais caracteres, com maiúscula, minúscula, número e símbolo.",color=AxeCloudThemeTokens.Muted,fontSize=10.sp)
            SecurityField(s.security.confirmPassword,{vm.security(s.security.copy(confirmPassword=it))},"Confirmar nova senha",true)
            Button(vm::changePassword,Modifier.fillMaxWidth(),enabled=!s.saving,colors=ButtonDefaults.buttonColors(containerColor=Color(0xFF9B6B16))){Text("Salvar nova senha")}
        }
        Surface(shape=RoundedCornerShape(20.dp),color=Color(0xFFFFF5F4),border=BorderStroke(1.dp,Color(0xFFE8B6B0))){Column(Modifier.fillMaxWidth().padding(17.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Text("ZONA DE PERIGO",color=Color(0xFFAA332C),fontSize=10.sp,fontWeight=FontWeight.Black,letterSpacing=1.sp);Text("Excluir permanentemente a conta",color=AxeCloudThemeTokens.Ink,fontWeight=FontWeight.Black);Text("Remove a casa e os dados relacionados. Esta ação não pode ser desfeita.",color=AxeCloudThemeTokens.Muted,fontSize=11.sp);OutlinedButton({vm.deleteDialog(true)},Modifier.fillMaxWidth(),colors=ButtonDefaults.outlinedButtonColors(contentColor=Color(0xFFAA332C)),border=BorderStroke(1.dp,Color(0xFFAA332C))){Icon(Icons.Outlined.DeleteForever,null);Spacer(Modifier.width(7.dp));Text("Excluir conta")}}}
    }
}

@Composable private fun SecurityCard(title:String,icon:androidx.compose.ui.graphics.vector.ImageVector,accent:Color,content:@Composable ColumnScope.()->Unit)=Surface(shape=RoundedCornerShape(22.dp),color=Color.White,border=BorderStroke(1.dp,AxeCloudThemeTokens.Outline)){Column(Modifier.fillMaxWidth().padding(17.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){Row{Icon(icon,null,tint=accent);Text(title,Modifier.padding(start=9.dp),color=AxeCloudThemeTokens.Ink,fontSize=18.sp,fontWeight=FontWeight.Black)};content()}}

@Composable private fun SecurityField(value:String,onValue:(String)->Unit,label:String,password:Boolean=false)=OutlinedTextField(value,onValue,Modifier.fillMaxWidth(),label={Text(label)},singleLine=true,visualTransformation=if(password)PasswordVisualTransformation()else androidx.compose.ui.text.input.VisualTransformation.None,shape=RoundedCornerShape(15.dp))

@Composable
fun DeleteAccountDialog(s:SettingsUiState,vm:SettingsViewModel)=AlertDialog(onDismissRequest={vm.deleteDialog(false)},icon={Icon(Icons.Outlined.DeleteForever,null,tint=Color(0xFFAA332C))},title={Text("Excluir definitivamente?")},text={Column(verticalArrangement=Arrangement.spacedBy(9.dp)){Text("Digite ${s.identity.email} e sua senha atual para confirmar.");SecurityField(s.security.deleteEmail,{vm.security(s.security.copy(deleteEmail=it))},"E-mail da conta");SecurityField(s.security.deletePassword,{vm.security(s.security.copy(deletePassword=it))},"Senha atual",true);s.error?.let{Text(it,color=MaterialTheme.colorScheme.error,fontSize=11.sp)}}},confirmButton={Button(vm::deleteAccount,enabled=!s.saving,colors=ButtonDefaults.buttonColors(containerColor=Color(0xFFAA332C))){Text("Excluir para sempre")}},dismissButton={TextButton({vm.deleteDialog(false)}){Text("Cancelar")}})
