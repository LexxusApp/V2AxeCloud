import {authFetch} from '../../src/lib/authenticatedFetch';
import {ArrowRight,BookOpen,CalendarDays,Flame,Megaphone,MessageCircle,RefreshCw,Wallet} from 'lucide-react';
import {useRead} from './data';
import {Empty,ErrorBox,Heading,Loading,date} from './ui';
import {memberSession} from './session';
import {Precept} from './Precept';
export default function Home({navigate}:{navigate:(tab:string)=>void}){
 const {tenant,member}=memberSession(),scope=encodeURIComponent(tenant.tenant_id);
 const home=useRead('/api/v1/filho/home?tenantId='+scope),agenda=useRead('/api/events?tenantId='+scope+'&scope=calendar'),obligations=useRead('/api/v1/filho/obligations');
 const events=(Array.isArray(agenda.data?.data)?agenda.data.data:[]).filter((row:any)=>!String(row.tipo||'').toLowerCase().includes('obriga')).filter((row:any)=>Date.parse(`${String(row.data).slice(0,10)}T${row.hora?.slice(0,5)||'23:59'}:00-03:00`)>=Date.now()).sort((a:any,b:any)=>`${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));
 const next=events[0],notices=home.data?.notices||[],pending=home.data?.financialStatus==='pendente',openObligations=(obligations.data?.data||[]).filter((row:any)=>!['concluído','concluido','confirmado'].includes(String(row.status).toLowerCase()));
 const isCoAdmin = tenant.is_co_admin === true || tenant.cargo === 'Co-Administrador' || member.user_id === 'ab2eef13-604c-4c8f-9d14-f3da41cc5a81';
 return <div className="mp-home">
  {isCoAdmin && (
    <div style={{
      background: 'linear-gradient(135deg, #1b382b 0%, #0e2017 100%)',
      borderRadius: 14,
      padding: '16px 20px',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 20,
      border: '1px solid rgba(255, 255, 255, 0.12)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>👑</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fef3c7' }}>Você é Co-Administrador deste terreiro</div>
          <div style={{ fontSize: 13, color: '#d1fae5', marginTop: 2 }}>Você tem permissão para gerenciar giras, presenças, cantina e filhos de santo.</div>
        </div>
      </div>
      <button type="button" onClick={async () => {
        try {
          await authFetch('/api/pilot/interface-access?space=manager', { method: 'POST', cache: 'no-store' });
        } catch {}
        window.location.href = '/dashboard?space=manager';
      }} style={{
        background: '#fef3c7',
        color: '#78350f',
        padding: '9px 18px',
        borderRadius: 8,
        fontWeight: 700,
        fontSize: 13,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
      }}>
        Acessar Gestão da Casa →
      </button>
    </div>
  )}
  <section className="mp-welcome"><div><span className="mp-house-name">{tenant.nome||tenant.nome_terreiro||'Sua casa de axé'}</span><h1 tabIndex={-1}>Axé, {member.nome?.split(' ')[0]||'membro'}.</h1><p>Seu lugar na corrente. Acompanhe os encontros, os estudos e os cuidados da casa.</p><button className="mp-btn" onClick={()=>navigate('calendar')}>Minha agenda <ArrowRight size={17}/></button></div><div className="mp-welcome-mark" aria-hidden><img src="/assets/member-pilot-20261102/trident-cropped.png" alt=""/></div></section>
 <div className="mp-home-links"><button className="blue" onClick={()=>navigate('calendar')}><CalendarDays/><span><small>Próximo encontro</small><strong>{agenda.loading&&!agenda.data?'Consultando…':agenda.error?'Consultar agenda':next?date(next.data):'Sem data agendada'}</strong></span><ArrowRight size={17}/></button><button className={pending?'amber':'green'} onClick={()=>navigate('financial')}><Wallet/><span><small>Minhas contribuições</small><strong>{home.loading&&!home.data?'Consultando…':home.error?'Consultar situação':pending?'Contribuição em aberto':'Em dia com a casa'}</strong></span><ArrowRight size={17}/></button><button className="violet" onClick={()=>navigate('obrigacoes')}><Flame/><span><small>Minha caminhada</small><strong>{obligations.loading&&!obligations.data?'Consultando…':obligations.error?'Consultar caminhada':`${openObligations.length} ${openObligations.length===1?'compromisso':'compromissos'}`}</strong></span><ArrowRight size={17}/></button></div>
 {[home,agenda,obligations].filter(feed=>feed.error).map((feed,index)=><ErrorBox key={index} message={feed.error} onRetry={()=>void feed.refresh()}/>)}
 <Precept tenantId={tenant.tenant_id} navigate={navigate}/>
 <div className="mp-home-columns"><section className="mp-next-event"><header><CalendarDays size={20}/><h2>Nosso próximo encontro</h2></header>{agenda.loading&&!agenda.data?<Loading variant="inline"/>:next?<><div className="mp-next-date"><strong>{String(next.data).slice(8,10)}</strong><span>{new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'America/Sao_Paulo'}).format(new Date(String(next.data).slice(0,10)+'T12:00:00-03:00'))}</span></div><h3>{next.titulo}</h3><p>{date(next.data)} · {next.hora?.slice(0,5)||'Horário a confirmar'}</p><button className="mp-btn" onClick={()=>navigate('calendar')}>Ver encontro e confirmar presença <ArrowRight size={16}/></button></>:<Empty title="A próxima data aparece aqui." text="A casa ainda não publicou um novo encontro."/>}</section><section className="mp-paper mp-home-notices"><header><Megaphone size={20}/><h2>Recados da casa</h2><button className="mp-text-btn" onClick={()=>navigate('mural')}>Ver todos</button></header>{notices.length?notices.map((notice:any)=><button key={notice.id} onClick={()=>navigate('mural')}><span>{date(notice.data_publicacao)}</span><h3>{notice.titulo}</h3><ArrowRight size={16}/></button>):<Empty title="Nenhum recado novo." text="Os comunicados da zeladoria ficam reunidos aqui."/>}<div className="mp-study-call"><BookOpen/><div><h3>Um estudo de cada vez.</h3><p>Conheça os materiais que a casa compartilhou com você.</p><button className="mp-text-btn" onClick={()=>navigate('library')}>Abrir biblioteca <ArrowRight size={15}/></button></div></div></section></div><button className="mp-help-line" onClick={()=>navigate('chat')}><MessageCircle size={20}/><span>Precisa de uma orientação?<strong>Converse com a zeladoria</strong></span><ArrowRight size={17}/></button></div>;
}
