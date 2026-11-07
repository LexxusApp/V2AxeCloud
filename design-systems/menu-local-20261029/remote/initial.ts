import { previewSession } from './session';
import type { AccountSetup, LocalRadar } from '../completion';
export function initialAccount(): AccountSetup {
  const { profile:p, email }=previewSession();
  const profile={house:p.nome_terreiro||p.nome||'',responsible:p.nome_zelador||'',role:p.cargo||'Zelador(a)',tradition:p.tradicao||'',city:p.cidade_publica||'',uf:p.estado_publico||'',phone:p.whatsapp_publico||'',email,photo:null,photoUrl:p.foto_url||''};
  const whatsapp={connected:false,days:3,sameDay:false,obligations:false,monthly:false,cantina:false};
  return {profile,draft:{...profile},whatsapp,whatsDraft:{...whatsapp}};
}
export function initialRadar(): LocalRadar {
  const p=previewSession().profile;
  return {publicName:p.nome_terreiro||'',tradition:p.tradicao||'',description:'',instructions:'',address:'',number:'',noNumber:false,complement:'',neighborhood:'',cep:'',city:p.cidade_publica||'',uf:p.estado_publico||'',phone:p.whatsapp_publico||'',servicePhone:'',mapsUrl:'',latitude:'',longitude:'',showAddress:false,socials:[],schedules:[],cover:null,portrait:null,gallery:[],coverPosition:'center',published:false,services:[],posts:[]};
}
