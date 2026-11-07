// One explicit contract for the pilot writer and its public projection.
const fail=message=>{throw Object.assign(Error(message),{status:400});};
const networks={instagram:['instagram.com'],facebook:['facebook.com','fb.com'],tiktok:['tiktok.com'],youtube:['youtube.com','youtu.be'],website:[]};
const locationKeys=['address','number','noNumber','complement','neighborhood','cep','latitude','longitude','mapsUrl'];
export function radarHttps(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u:null;}catch{return null;}}
export function normalizePilotRadar(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Perfil do Radar inválido.');
 const out={};
 const strings={publicName:180,tradition:80,description:2000,instructions:1500,address:300,number:30,complement:120,neighborhood:120,cep:9,city:120,uf:2,phone:20,servicePhone:20,mapsUrl:2000,latitude:24,longitude:24};
 for(const [key,max] of Object.entries(strings)){if(typeof input[key]!=='string'||input[key].length>max)fail('Confira o campo '+key+'.');out[key]=input[key].trim();}
 for(const key of ['noNumber','showAddress','published']){if(typeof input[key]!=='boolean')fail('Visibilidade inválida.');out[key]=input[key];}
 if(out.publicName.length<3||out.description.length<15||out.instructions.length<10||out.city.length<2||!['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(out.uf))fail('Preencha a identidade, orientações, cidade e estado.');
 if(!['Umbanda','Candomblé','Jurema','Mista','Outra','umbanda','candomble','jurema','mista','outra'].includes(out.tradition))fail('Escolha a tradição da casa.');
 if(out.showAddress&&(out.address.length<3||out.neighborhood.length<2||!out.noNumber&&!out.number))fail('Preencha o endereço antes de exibi-lo.');
 if(out.cep&&!/^\d{5}-?\d{3}$/.test(out.cep))fail('CEP inválido.');
 for(const key of ['phone','servicePhone'])if(out[key]&&!/^(?:\d{10,11}|55\d{10,11})$/.test(out[key].replace(/\D/g,'')))fail('Telefone inválido.');
 if(Boolean(out.latitude)!==Boolean(out.longitude))fail('Preencha as duas coordenadas ou deixe ambas vazias.');
 for(const [key,max] of [['latitude',90],['longitude',180]])if(out[key]){if(!/^-?\d{1,3}(?:[.,]\d{1,8})?$/.test(out[key])||Math.abs(Number(out[key].replace(',','.')))>max)fail('Coordenadas inválidas.');out[key]=out[key].replace(',','.');}
 if(out.mapsUrl){const u=radarHttps(out.mapsUrl),h=u?.hostname;if(!u||!(h==='maps.app.goo.gl'||h==='maps.google.com'||(h==='google.com'||h.endsWith('.google.com')||h==='goo.gl')&&u.pathname.startsWith('/maps')))fail('Link do Google Maps inválido.');}
 if(!['top','center','bottom'].includes(input.coverPosition))fail('Posição da capa inválida.');out.coverPosition=input.coverPosition;
 if(!Array.isArray(input.socials)||input.socials.length>5)fail('Use até cinco redes sociais.');
 const seen=new Set();out.socials=input.socials.map(row=>{const u=radarHttps(row?.url),allowed=networks[row?.network];if(!u||!allowed||seen.has(row.network)||row.url.length>2000||row.network!=='website'&&!allowed.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))fail('Rede social inválida ou repetida.');seen.add(row.network);return {id:row.network,network:row.network,url:u.href};});
 if(!Array.isArray(input.schedules)||input.schedules.length>14)fail('Use até 14 horários.');
 const times=new Set();out.schedules=input.schedules.map((row,i)=>{const time=/^([01]\d|2[0-3]):[0-5]\d$/;if(!Number.isInteger(row?.day)||row.day<0||row.day>6||!time.test(row.start)||typeof row.end!=='string'||row.end&&!time.test(row.end)||typeof row.title!=='string'||row.title.trim().length<3||row.title.length>80||typeof row.enabled!=='boolean'||times.has(row.day+'-'+row.start))fail('Horário inválido ou repetido.');times.add(row.day+'-'+row.start);return {id:typeof row.id==='string'?row.id.slice(0,80):'schedule-'+i,day:row.day,start:row.start,end:row.end,title:row.title.trim(),enabled:row.enabled};});
 const media=row=>{if(row===null)return null;if(!row||typeof row.id!=='string'||!row.id||row.id.length>80||typeof row.source!=='string'||row.source.length>2000||!radarHttps(row.source)||typeof row.caption!=='string'||row.caption.length>500||typeof row.illustrative!=='boolean')fail('Imagem ou legenda inválida.');return {id:row.id,source:row.source,caption:row.caption.trim(),illustrative:row.illustrative};};
 out.cover=media(input.cover);out.portrait=media(input.portrait);
 if(!Array.isArray(input.gallery)||input.gallery.length>6)fail('A galeria do Radar aceita até seis imagens.');out.gallery=input.gallery.map(media);
 if(out.gallery.some(x=>!x)||new Set(out.gallery.map(x=>x.id)).size!==out.gallery.length)fail('Imagens repetidas na galeria.');
 return out;
}
export function publicPilotRadar(profile){
 // Never spread private JSON into a response, including JSON saved by an older client.
 if(!profile?.published)return null;
 const keys=['publicName','tradition','description','instructions','city','uf','phone','servicePhone','showAddress','socials','schedules','cover','portrait','gallery','coverPosition','published',...(profile.showAddress===true?locationKeys:[])];
 const out=Object.fromEntries(keys.filter(key=>key in profile).map(key=>[key,profile[key]]));
 out.schedules=(out.schedules||[]).filter(row=>row.enabled);
 return out;
}
export function pilotRadarAddress(p){return [p.address,p.noNumber?'s/n':p.number,p.complement,p.neighborhood,[p.city,p.uf].filter(Boolean).join(' · '),p.cep?'CEP '+p.cep:''].filter(Boolean).join(', ');}
export function legacyPilotRadarLocation(p){
 const parts=String(p.endereco||'').split(',').map(s=>s.trim()).filter(Boolean);
 let cep=p.cep||'',number='',noNumber=false,complement='';
 const tail=parts.filter((part,i)=>{const postal=/^(?:CEP\s*)?(\d{5}-?\d{3})$/i.exec(part);if(postal){cep=cep||postal[1];return false;}return i===0||![p.bairro,p.cidade,p.estado,[p.cidade,p.estado].filter(Boolean).join(' - ')].some(v=>v&&part.toLocaleLowerCase()===String(v).toLocaleLowerCase());});
 const match=/^(\d+[A-Za-z]?|s\/?n)(?:\s*-\s*(.+))?$/i.exec(tail[1]||'');
 if(match){noNumber=/^s/i.test(match[1]);number=noNumber?'':match[1];const rest=[match[2],...tail.slice(2)].filter(Boolean).filter(v=>v!==p.bairro);complement=rest.join(', ');return {address:tail[0]||'',number,noNumber,complement,cep};}
 // Ambiguous legacy text stays intact and needs an explicit number/s-n decision.
 return {address:tail.join(', '),number,noNumber,complement,cep};
}
export function pilotRadarDirectory(p,base={}){
 p=publicPilotRadar(p);if(!p)return null;
 const instagram=p.socials.find(row=>row.network==='instagram')?.url||null;
 const phone=(p.servicePhone||p.phone).replace(/\D/g,'');const whatsapp=phone?(phone.length<=11?'55'+phone:phone):null;
 return {slug:base.slug,id:base.id,nome:p.publicName,tradicao:p.tradition,descricao:p.description,orientacoesVisita:p.instructions,cidade:p.city,estado:p.uf,cidadeSlug:base.cidadeSlug||null,tipo:'terreiro',verificada:true,gerenciada:true,indexable:base.indexable!==false,perfilUrl:'/terreiro/'+encodeURIComponent(base.slug||''),cidadeUrl:base.cidadeUrl||null,telefone:p.phone||null,whatsapp,hasWhatsapp:!!whatsapp,fotoUrl:p.portrait?.source||null,coverPhotoUrl:p.cover?.source||null,galleryPhotoUrls:p.gallery.map(m=>m.source),instagramUrl:instagram,publicacaoStatus:'publicado',...(p.showAddress?{endereco:pilotRadarAddress(p),bairro:p.neighborhood||null,bairroSlug:null,linkMaps:p.mapsUrl||null,latitude:p.latitude?Number(p.latitude):null,longitude:p.longitude?Number(p.longitude):null}:{}),horariosGira:p.schedules.map(s=>({diaSemana:s.day,horario:s.start,horarioFim:s.end,titulo:s.title,observacao:null})),pilotRadar:p};
}
