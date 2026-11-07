type LogoutDependencies={request:typeof fetch;endAuth:()=>Promise<{error:unknown}>;navigate:()=>void};
export async function endPilotSession({request,endAuth,navigate}:LogoutDependencies){
 const response=await request('/api/pilot/signout',{method:'POST',credentials:'same-origin'});
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.success!==true)throw Error('Não foi possível encerrar a seleção da conta. Tente sair novamente.');
 const {error}=await endAuth();
 if(error)throw Error('Não foi possível encerrar sua sessão. Tente sair novamente.');
 navigate();
}
