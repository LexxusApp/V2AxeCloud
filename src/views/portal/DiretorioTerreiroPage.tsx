import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Camera, CheckCircle2, Clock,
  Compass, DollarSign, ExternalLink, ImageOff, Instagram, Loader2, MapPin,
  MessageCircle, Route, Share2, ShieldCheck, Sparkles,
} from 'lucide-react';
import { MatrizEditorialLayout } from '../../components/marketing/MatrizEditorialLayout';
import { TerreiroClaimDialog } from '../../components/portal/TerreiroClaimDialog';
import { TerreiroClaimStatusDialog } from '../../components/portal/TerreiroClaimStatusDialog';
import {
  fetchDiretorioTerreiro, fetchDiretorioTerreiroServicos, trackDiretorioGoogleProfileView,
  trackDiretorioWhatsappClick, type DiretorioTerreiro, type TerreiroServico,
  type TerreiroServicosPublic,
} from '../../lib/diretorioPublic';
import { useDiretorioTerreiroJsonLd } from '../../lib/diretorioJsonLd';
import { ROUTES } from '../../lib/routes';
import { applyCustomPageSeo } from '../../lib/seo';
import { trackConversionEvent } from '../../lib/trackConversion';
import { getFeaturedTerreiroCopy } from '../../../lib/diretorioSeoShared';
import {
  formatGiraTime, getNextGiraScheduleItem, GIRA_WEEKDAYS, type GiraScheduleItem,
} from '../../../lib/giraSchedule';
import { PLAN_PRICE_STANDARD_LABEL, TRIAL_DAYS } from '../../../lib/planPricing';

type ProfileTab = 'visao-geral' | 'agenda' | 'publicacoes' | 'fotos' | 'informacoes';
const PROFILE_TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: 'visao-geral', label: 'Visão geral' }, { id: 'agenda', label: 'Agenda' },
  { id: 'publicacoes', label: 'Publicações' }, { id: 'fotos', label: 'Fotos' },
  { id: 'informacoes', label: 'Informações' },
];
const TRADITION_LABELS: Record<string, string> = {
  umbanda: 'Umbanda', candomble: 'Candomblé',
  'umbanda-candomble': 'Umbanda e Candomblé', 'tradicao-mista': 'Tradição mista',
  quimbanda: 'Quimbanda',
};

function slugFromPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  return decodeURIComponent(parts[parts.indexOf('terreiro') + 1] || '');
}
function normalizeWhatsapp(value: string | null | undefined): string | null {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  return digits.length >= 12 && digits.length <= 13 ? digits : null;
}
function whatsappHrefFor(terreiro: DiretorioTerreiro, preferred?: string | null): string | null {
  const phone = normalizeWhatsapp(preferred || terreiro.whatsapp);
  if (!phone) return null;
  const message = `Olá! Conheci o ${terreiro.nome} através do AxéCloud Gestão de Terreiros e gostaria de receber mais informações sobre giras e atendimentos.`;
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
}
function traditionLabel(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized ? TRADITION_LABELS[normalized.toLowerCase()] || normalized : null;
}
function profileSince(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null :
    new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
}
function nextGiraDate(daysUntil: number): Date {
  const date = new Date(); date.setDate(date.getDate() + daysUntil); return date;
}

function ProfilePhoto({ fotoUrl, nome, className = '', eager = false }: {
  fotoUrl: string | null; nome: string; className?: string; eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (fotoUrl && !failed) return <img src={fotoUrl} alt={'Imagem pública de ' + nome}
    className={'h-full w-full object-cover ' + className} loading={eager ? 'eager' : 'lazy'}
    onError={() => setFailed(true)} />;
  return <div className={'grid h-full w-full place-items-center bg-[#13241a] ' + className}>
    <img src="/axecloud-trident.png" alt="" className="h-16 w-12 object-contain opacity-80" />
  </div>;
}
function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return <img src="/whatsapp.svg" alt="" className={className} aria-hidden />;
}
function InfoRow({ icon: Icon, label, children }: {
  icon: typeof MapPin; label: string; children: ReactNode;
}) {
  return <div className="grid gap-2 border-t border-[#ddd3c2] py-4 first:border-t-0 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-5">
    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#946800]"><Icon className="h-4 w-4" />{label}</p>
    <div className="min-w-0 text-sm font-semibold leading-relaxed text-[#1d211c]/72">{children}</div>
  </div>;
}
function formatValorServico(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'Sob consulta';
  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (min != null && max != null && min !== max) return money(min) + ' – ' + money(max);
  return money(min ?? max ?? 0);
}
function ServiceCard({ service }: { service: TerreiroServico }) {
  return <article className="rounded-2xl border border-[#ded3c0] bg-white p-5">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#122219] text-[#eeb900]"><Sparkles className="h-4 w-4" /></span>
      <div className="min-w-0"><h3 className="font-black tracking-[-0.02em] text-[#172019]">{service.nome}</h3>
        {service.descricao ? <p className="mt-1.5 text-sm leading-relaxed text-[#536057]">{service.descricao}</p> : null}</div>
    </div>
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#ece4d6] pt-3 text-xs">
      <strong className="flex items-center gap-1.5 text-[#7b5900]"><DollarSign className="h-3.5 w-3.5" />{formatValorServico(service.valor_min, service.valor_max)}</strong>
      {service.duracao_minutos ? <span className="flex items-center gap-1.5 text-[#667067]"><Clock className="h-3.5 w-3.5" />{service.duracao_minutos} min</span> : null}
    </div>
  </article>;
}
function ServicesPanel({ services }: { services: TerreiroServico[] }) {
  return <section className="rounded-2xl border border-[#ddd2bf] bg-[#fbf6ec] p-5 sm:p-7" aria-labelledby="services-title">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#987000]">Atendimentos</p>
    <h2 id="services-title" className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#172019]">Serviços da casa</h2>
    {services.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{services.map((service) => <ServiceCard key={service.id} service={service} />)}</div> :
      <div className="mt-5 rounded-2xl border border-dashed border-[#ccbfa9] bg-white/65 px-5 py-8 text-center"><Sparkles className="mx-auto h-5 w-5 text-[#a67900]" /><p className="mt-3 text-sm font-bold text-[#566159]">Nenhum atendimento foi publicado neste perfil.</p></div>}
  </section>;
}

function NextGiraCard({ schedules, whatsappHref, onWhatsapp, onOpenAgenda }: {
  schedules: GiraScheduleItem[]; whatsappHref: string | null; onWhatsapp: () => void; onOpenAgenda: () => void;
}) {
  const next = getNextGiraScheduleItem(schedules);
  if (!next) return <section className="rounded-2xl bg-[#102118] p-6 text-white sm:p-8">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#efbd14]">Agenda da casa</p>
    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Próxima gira ainda não publicada</h2>
    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/62">Confirme diretamente com a casa os próximos dias e horários de atendimento.</p>
    {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={onWhatsapp}
      className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#efbd14] px-5 py-3 text-sm font-black text-[#102118]">
      <WhatsAppIcon />Confirmar com a casa</a> : null}
  </section>;

  const date = nextGiraDate(next.daysUntil);
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '');
  return <section className="overflow-hidden rounded-2xl bg-[#102118] p-6 text-white sm:p-8" aria-labelledby="next-event-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#efbd14]">Próxima atividade</p>
        <h2 id="next-event-title" className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">{next.item.titulo || 'Gira aberta'}</h2></div>
      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-200">Próxima gira prevista</span>
    </div>
    <div className="mt-6 grid gap-5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
      <time className="grid min-h-28 place-items-center rounded-2xl bg-[#efbd14] px-4 py-3 text-center text-[#102118]" dateTime={date.toISOString()}>
        <span className="text-[10px] font-black uppercase tracking-[0.12em]">{weekday}</span><strong className="text-4xl leading-none">{day}</strong><small className="text-xs font-black uppercase">{month}</small>
      </time>
      <div><p className="flex items-center gap-2 text-base font-black text-[#f7e6ac]"><Clock className="h-4 w-4" />{formatGiraTime(next.item.horario)}</p>
        {next.item.observacao ? <p className="mt-2 text-sm leading-relaxed text-white/68">{next.item.observacao}</p> : null}
        <p className="mt-2 text-xs leading-relaxed text-white/48">A programação pode mudar. Confirme diretamente com a casa antes de visitar.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={onWhatsapp}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#efbd14] px-5 py-3 text-sm font-black text-[#102118]"><WhatsAppIcon />Confirmar com a casa</a> : null}
          <button type="button" onClick={onOpenAgenda} className="min-h-11 px-2 text-sm font-black text-white underline decoration-white/25 underline-offset-4">Ver agenda completa</button>
        </div>
      </div>
    </div>
  </section>;
}

function PublicationFeed({ terreiro, services, onOpenInfo }: {
  terreiro: DiretorioTerreiro; services: TerreiroServico[]; onOpenInfo: () => void;
}) {
  return <section aria-labelledby="feed-title">
    <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#987000]">Novidades da casa</p>
      <h2 id="feed-title" className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#172019]">Publicações recentes</h2></div>
    {terreiro.descricao ? <article className="overflow-hidden rounded-2xl border border-[#ddd2bf] bg-white">
      <header className="flex items-center gap-3 p-5">
        <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-[#e5ad00]"><ProfilePhoto fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} /></div>
        <div className="min-w-0"><strong className="block truncate text-sm text-[#172019]">{terreiro.nome}</strong><span className="text-xs text-[#6b746d]">Apresentação oficial da casa</span></div>
        {terreiro.verificada || terreiro.gerenciada ? <BadgeCheck className="ml-auto h-5 w-5 shrink-0 text-emerald-600" aria-label="Perfil oficial" /> : null}
      </header>
      <div className="border-t border-[#eee6d8] px-5 py-5"><h3 className="text-lg font-black tracking-[-0.025em] text-[#172019]">Sobre nossa casa</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#4f5a52]">{terreiro.descricao}</p></div>
      {terreiro.fotoUrl ? <div className="h-64 overflow-hidden bg-[#13241a] sm:h-80"><ProfilePhoto fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} /></div> : null}
      <footer className="flex items-center justify-between gap-3 border-t border-[#eee6d8] px-5 py-4 text-xs text-[#6b746d]"><span>Informação publicada pela casa</span>
        <button type="button" onClick={onOpenInfo} className="min-h-11 font-black text-[#725400]">Ver informações</button></footer>
    </article> : <div className="rounded-2xl border border-dashed border-[#cfc2ac] bg-white/60 px-6 py-10 text-center">
      <MessageCircle className="mx-auto h-6 w-6 text-[#9f7500]" /><h3 className="mt-3 font-black text-[#172019]">A casa ainda não publicou novidades</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#657067]">Quando houver uma apresentação ou comunicado público, ele aparecerá aqui.</p>
    </div>}
    {services.length ? <article className="mt-4 rounded-2xl border border-[#ddd2bf] bg-white p-5">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f5e6ae] text-[#765600]"><Sparkles className="h-5 w-5" /></span>
        <div><strong className="text-sm text-[#172019]">Atendimentos publicados</strong>
          <p className="mt-1 text-sm leading-relaxed text-[#5d6860]">Esta casa possui {services.length} {services.length === 1 ? 'atendimento disponível' : 'atendimentos disponíveis'} no perfil.</p></div></div>
    </article> : null}
  </section>;
}

function OverviewSidebar({ terreiro, onOpenInfo, onOpenPhotos }: {
  terreiro: DiretorioTerreiro; onOpenInfo: () => void; onOpenPhotos: () => void;
}) {
  const tradition = traditionLabel(terreiro.tradicao);
  const since = profileSince(terreiro.criadaEm);
  const about = terreiro.descricao || (terreiro.verificada || terreiro.gerenciada
    ? 'Esta casa ainda não publicou sua apresentação.'
    : 'Informações públicas organizadas para ajudar você a conhecer e visitar esta casa.');
  return <aside className="space-y-4" aria-label="Informações da casa">
    <section className="rounded-2xl border border-[#ddd2bf] bg-white p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black tracking-[-0.03em] text-[#172019]">Sobre a casa</h2>
        {terreiro.verificada || terreiro.gerenciada ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.09em] text-emerald-700">Perfil oficial</span> : null}</div>
      <p className="mt-3 line-clamp-5 text-sm leading-6 text-[#59645c]">{about}</p>
      <dl className="mt-5 divide-y divide-[#eee6d8] border-y border-[#eee6d8] text-sm">
        {tradition ? <div className="flex justify-between gap-4 py-3"><dt className="text-[#788079]">Tradição</dt><dd className="text-right font-black text-[#263029]">{tradition}</dd></div> : null}
        {terreiro.bairro ? <div className="flex justify-between gap-4 py-3"><dt className="text-[#788079]">Bairro</dt><dd className="text-right font-black text-[#263029]">{terreiro.bairro}</dd></div> : null}
        {since ? <div className="flex justify-between gap-4 py-3"><dt className="text-[#788079]">No AxéCloud desde</dt><dd className="text-right font-black capitalize text-[#263029]">{since}</dd></div> : null}
      </dl>
      <button type="button" onClick={onOpenInfo} className="mt-4 min-h-11 text-sm font-black text-[#765600] underline decoration-[#b18a1e]/30 underline-offset-4">Ver informações completas</button>
    </section>
    <section className="rounded-2xl border border-[#ddd2bf] bg-white p-5">
      <h2 className="text-lg font-black tracking-[-0.03em] text-[#172019]">Antes de visitar</h2>
      <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[#59645c]">
        <li className="flex gap-3"><span className="font-black text-[#a17800]">01</span><span>Confirme o dia e o horário diretamente com a casa.</span></li>
        <li className="flex gap-3"><span className="font-black text-[#a17800]">02</span><span>Consulte orientações sobre roupas e chegada.</span></li>
        <li className="flex gap-3"><span className="font-black text-[#a17800]">03</span><span>Respeite as orientações da comunidade anfitriã.</span></li>
      </ol>
    </section>
    <section className="overflow-hidden rounded-2xl border border-[#ddd2bf] bg-white">
      <div className="flex items-center justify-between gap-3 p-5"><h2 className="text-lg font-black tracking-[-0.03em] text-[#172019]">Fotos da casa</h2>
        <button type="button" onClick={onOpenPhotos} className="min-h-11 text-xs font-black text-[#765600]">Ver fotos</button></div>
      {terreiro.fotoUrl ? <div className="h-44 overflow-hidden"><ProfilePhoto fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} /></div> :
        <div className="grid h-36 place-items-center bg-[#f0e8da] text-center text-xs font-bold text-[#7c827d]"><span><ImageOff className="mx-auto mb-2 h-5 w-5" />Nenhuma foto publicada</span></div>}
    </section>
    <section className="rounded-2xl border border-[#ddd2bf] bg-white p-5">
      <h2 className="text-lg font-black tracking-[-0.03em] text-[#172019]">Localização</h2>
      <p className="mt-3 text-sm leading-6 text-[#59645c]">{terreiro.bairro || terreiro.cidade || 'Localização não informada'}{terreiro.estado ? ', ' + terreiro.estado : ''}</p>
      {terreiro.linkMaps ? <a href={terreiro.linkMaps} target="_blank" rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#cdbf9e] px-4 py-3 text-sm font-black text-[#172019]">
        <Route className="h-4 w-4" />Abrir rota no Google Maps</a> : null}
    </section>
  </aside>;
}

function AgendaPanel({ schedules, whatsappHref, onWhatsapp }: {
  schedules: GiraScheduleItem[]; whatsappHref: string | null; onWhatsapp: () => void;
}) {
  return <section className="rounded-2xl border border-[#ddd2bf] bg-[#fbf6ec] p-5 sm:p-8" aria-labelledby="agenda-title">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#987000]">Programação pública</p>
    <h2 id="agenda-title" className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#172019]">Agenda da casa</h2>
    {schedules.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {schedules.map((item, index) => <article key={item.diaSemana + '-' + item.horario + '-' + index} className="rounded-2xl border border-[#ded3c0] bg-white p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#967000]">{GIRA_WEEKDAYS[item.diaSemana]}</p>
        <p className="mt-2 text-2xl font-black text-[#172019]">{formatGiraTime(item.horario)}</p>
        <h3 className="mt-3 font-black text-[#263029]">{item.titulo || 'Gira da casa'}</h3>
        {item.observacao ? <p className="mt-2 text-sm leading-relaxed text-[#647067]">{item.observacao}</p> : null}
      </article>)}
    </div> : <div className="mt-6 rounded-2xl border border-dashed border-[#cfc2ac] bg-white/70 px-6 py-12 text-center">
      <CalendarDays className="mx-auto h-7 w-7 text-[#a57b00]" /><h3 className="mt-3 font-black text-[#172019]">Agenda ainda não publicada</h3>
      <p className="mt-2 text-sm text-[#647067]">Confirme as próximas atividades diretamente com a casa.</p>
      {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={onWhatsapp}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#16794b] px-5 py-3 text-sm font-black text-white"><WhatsAppIcon />Falar no WhatsApp</a> : null}
    </div>}
    <p className="mt-5 text-xs leading-relaxed text-[#6b746d]">A programação pode mudar. Confirme diretamente com a casa antes de visitar.</p>
  </section>;
}

function PhotosPanel({ terreiro }: { terreiro: DiretorioTerreiro }) {
  return <section className="rounded-2xl border border-[#ddd2bf] bg-[#fbf6ec] p-5 sm:p-8" aria-labelledby="photos-title">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#987000]">Galeria pública</p>
    <h2 id="photos-title" className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#172019]">Fotos da casa</h2>
    {terreiro.fotoUrl ? <figure className="mt-6 overflow-hidden rounded-2xl border border-[#d8ccb8] bg-[#13241a]">
      <div className="h-[22rem] max-h-[60vh]"><ProfilePhoto fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} /></div>
      <figcaption className="bg-white px-5 py-4 text-sm font-semibold text-[#59645c]">Imagem pública de {terreiro.nome}</figcaption>
    </figure> : <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#cfc2ac] bg-white/70 text-center">
      <span><Camera className="mx-auto h-7 w-7 text-[#a57b00]" /><strong className="mt-3 block text-[#172019]">Nenhuma foto publicada</strong><small className="mt-2 block text-[#647067]">A galeria aparecerá quando a casa adicionar imagens.</small></span>
    </div>}
  </section>;
}

function ContactPanel({ terreiro, whatsappHref, onWhatsapp }: {
  terreiro: DiretorioTerreiro; whatsappHref: string | null; onWhatsapp: () => void;
}) {
  return <section className="rounded-2xl border border-[#ddd2bf] bg-[#fbf6ec] p-5 sm:p-8" aria-labelledby="information-title">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#987000]">Planeje sua visita</p>
    <h2 id="information-title" className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#172019]">Informações da casa</h2>
    <div className="mt-6 rounded-2xl border border-[#ded3c0] bg-white px-5">
      <InfoRow icon={MapPin} label="Endereço">{terreiro.endereco || 'Endereço não informado'}</InfoRow>
      <InfoRow icon={MessageCircle} label="WhatsApp">{whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={onWhatsapp}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#16794b] px-4 py-2.5 text-sm font-black text-white"><WhatsAppIcon />Conversar com a casa</a> : 'WhatsApp não disponível'}</InfoRow>
      {terreiro.instagramUrl ? <InfoRow icon={Instagram} label="Instagram"><a href={terreiro.instagramUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 py-2 font-black text-[#765600]">Abrir Instagram<ExternalLink className="h-4 w-4" /></a></InfoRow> : null}
    </div>
    {terreiro.linkMaps ? <a href={terreiro.linkMaps} target="_blank" rel="noopener noreferrer"
      className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#efbd14] px-5 py-3 text-sm font-black text-[#102118]"><Compass className="h-4 w-4" />Traçar rota no Google Maps<ExternalLink className="h-4 w-4" /></a> : null}
  </section>;
}

function ClaimSection({ terreiro, official }: { terreiro: DiretorioTerreiro; official: boolean }) {
  if (official) return <section className="mt-6 grid gap-5 rounded-2xl bg-[#102118] p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" aria-labelledby="owner-title">
    <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#efbd14]">Para dirigentes e zeladores</p>
      <h2 id="owner-title" className="mt-2 text-2xl font-black tracking-[-0.04em]">Sua casa também pode ter uma presença oficial no AxéCloud.</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/62">Publique agenda, fotos, comunicados e informações de visita em um perfil administrado pela própria comunidade.</p></div>
    <a href={ROUTES.register} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#efbd14] px-6 py-3 text-sm font-black text-[#102118]">Criar perfil da minha casa<ArrowRight className="h-4 w-4" /></a>
  </section>;
  return <section id="reivindicar-perfil" className="mt-6 scroll-mt-28 rounded-2xl bg-[#102118] p-6 text-white sm:p-8" aria-labelledby="claim-title">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#efbd14]">Sistema AxéCloud de gestão de terreiros</p>
        <h2 id="claim-title" className="mt-2 text-2xl font-black tracking-[-0.04em]">Transforme este perfil na voz oficial da sua casa.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/62">Assuma os dados públicos e administre financeiro, membros, giras e comunicação. Teste {TRIAL_DAYS} dias grátis; depois, {PLAN_PRICE_STANDARD_LABEL}.</p>
        <ul className="mt-5 grid gap-3 text-xs font-bold text-white/72 sm:grid-cols-3">
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Gestão da casa</li>
          <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#efbd14]" />{TRIAL_DAYS} dias grátis</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" />Análise humana</li>
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <TerreiroClaimDialog slug={terreiro.slug} terreiroNome={terreiro.nome}
          onTrack={() => void trackConversionEvent('claim_started', {
            ctaId: 'directory-profile-claim', ctaLabel: 'Assumir a gestão deste perfil',
            metadata: { slug: terreiro.slug },
          })} />
        <TerreiroClaimStatusDialog slug={terreiro.slug} terreiroNome={terreiro.nome} />
      </div>
    </div>
  </section>;
}

export default function DiretorioTerreiroPage() {
  const slug = slugFromPath();
  const [terreiro, setTerreiro] = useState<DiretorioTerreiro | null>(null);
  const [servicosData, setServicosData] = useState<TerreiroServicosPublic>({ servicos: [], whatsappAtendimento: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('visao-geral');
  const [shareStatus, setShareStatus] = useState('');
  const tabRefs = useRef<Record<ProfileTab, HTMLButtonElement | null>>({
    'visao-geral': null, agenda: null, publicacoes: null, fotos: null, informacoes: null,
  });

  useEffect(() => {
    if (!slug) { setError('Endereço inválido.'); setLoading(false); return; }
    void Promise.all([fetchDiretorioTerreiro(slug), fetchDiretorioTerreiroServicos(slug)])
      .then(([profile, services]) => {
        setTerreiro(profile); setServicosData(services); trackDiretorioGoogleProfileView(profile.slug);
        const location = [profile.cidade, profile.estado].filter(Boolean).join(', ');
        const featured = getFeaturedTerreiroCopy(profile.slug);
        applyCustomPageSeo({
          title: featured?.title || profile.nome + (location ? ' — ' + location : '') + ' | Diretório AxéCloud',
          description: featured?.description || profile.descricao ||
            ('Informações de ' + profile.nome + (location ? ' em ' + location : '') + ': agenda, endereço e contato.'),
          canonicalPath: '/terreiro/' + profile.slug,
          robots: profile.indexable === false ? 'noindex, follow' : 'index, follow',
        });
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não encontrado'))
      .finally(() => setLoading(false));
  }, [slug]);

  useDiretorioTerreiroJsonLd(terreiro);

  const activateTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => tabRefs.current[tab]?.focus());
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % PROFILE_TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + PROFILE_TABS.length) % PROFILE_TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = PROFILE_TABS.length - 1;
    else return;
    event.preventDefault(); activateTab(PROFILE_TABS[nextIndex].id);
  };

  if (loading) return <MatrizEditorialLayout showFooter={false}><div className="relative z-[1] grid min-h-dvh place-items-center pt-24">
    <div className="flex flex-col items-center gap-4"><Loader2 className="h-8 w-8 animate-spin text-[#b98500]" /><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1b1813]/45">Abrindo o perfil da casa</p></div>
  </div></MatrizEditorialLayout>;

  if (error || !terreiro) return <MatrizEditorialLayout><main className="relative z-[1] mx-auto grid min-h-[72vh] w-full max-w-[1180px] place-items-center px-5 pb-24 pt-36 text-center">
    <div className="max-w-xl rounded-2xl border border-[#d9ccb7] bg-[#fffaf1] p-8 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b6a00]">Diretório AxéCloud</p>
      <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#1b1813]">{error || 'Terreiro não encontrado'}</h1>
      <a href={ROUTES.terreiros} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#172018] px-6 py-3 text-sm font-black text-white"><ArrowLeft className="h-4 w-4" />Voltar ao diretório</a>
    </div>
  </main></MatrizEditorialLayout>;

  const official = Boolean(terreiro.verificada || terreiro.gerenciada);
  const whatsappHref = whatsappHrefFor(terreiro, servicosData.whatsappAtendimento);
  const tradition = traditionLabel(terreiro.tradicao);
  const location = [terreiro.cidade, terreiro.estado].filter(Boolean).join(', ');
  const summary = terreiro.descricao || (official
    ? 'Conheça a agenda, os atendimentos e as informações oficiais desta casa.'
    : 'Perfil público com informações para ajudar você a conhecer e visitar esta casa.');
  const trackWhatsapp = () => {
    trackDiretorioWhatsappClick(terreiro.slug);
    void trackConversionEvent('cta_click', {
      ctaId: 'directory-profile-whatsapp', ctaLabel: 'Conversar pelo WhatsApp',
      metadata: { slug: terreiro.slug },
    });
  };
  const shareProfile = async () => {
    const data = { title: terreiro.nome, text: 'Conheça ' + terreiro.nome + ' no AxéCloud.', url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(window.location.href); setShareStatus('Link copiado'); window.setTimeout(() => setShareStatus(''), 2200); }
    } catch { setShareStatus(''); }
  };

  return <MatrizEditorialLayout>
    <main className="relative z-[1] mx-auto w-full max-w-[1180px] px-2 pb-20 pt-28 sm:px-5 lg:px-0">
      <article className="overflow-hidden rounded-2xl border border-[#d8cdb9] bg-white shadow-[0_22px_65px_rgba(48,39,23,.12)]">
        <header>
          <div className="relative min-h-[13rem] overflow-hidden bg-[#102118] sm:min-h-[17rem]">
            <div className="absolute inset-0"><ProfilePhoto fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} eager className="opacity-75" /></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#09130e]/90 via-[#102118]/25 to-black/20" />
            <a href={ROUTES.terreiros} className="absolute left-4 top-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-[#0b1510]/65 px-4 py-2 text-xs font-black text-white backdrop-blur sm:left-6 sm:top-6">
              <ArrowLeft className="h-4 w-4" />Voltar para o Mapa
            </a>
            <span className="absolute bottom-5 right-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#0b1510]/70 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-white backdrop-blur sm:bottom-6 sm:right-6">
              <img src="/axecloud-trident.png" alt="" className="h-4 w-3 object-contain" />{official ? 'Perfil oficial no AxéCloud' : 'Perfil público no AxéCloud'}
            </span>
          </div>
          <div className="relative px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-12 h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[#102118] shadow-lg sm:-mt-14 sm:h-28 sm:w-28">
              <ProfilePhoto fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} eager />
            </div>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-balance text-[clamp(1.8rem,3.8vw,2.7rem)] font-black leading-[1.02] tracking-[-0.045em] text-[#172019]">{terreiro.nome}</h1>
                  {official ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.09em] text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" />Oficial</span> : null}
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-[#687169]">
                  {location ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#a77b00]" />{location}</span> : null}
                  {location && tradition ? <span>·</span> : null}{tradition ? <span>{tradition}</span> : null}
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[#566159] sm:text-base">{summary}</p>
              </div>
              <div className="flex flex-wrap gap-2.5" aria-label="Ações do perfil">
                {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={trackWhatsapp}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#16794b] px-5 py-3 text-sm font-black text-white shadow-[0_10px_25px_rgba(22,121,75,.2)]"><WhatsAppIcon />Falar no WhatsApp</a> : null}
                {terreiro.linkMaps ? <a href={terreiro.linkMaps} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#cfc3ad] px-5 py-3 text-sm font-black text-[#172019]"><Route className="h-4 w-4" />Como chegar</a> : null}
                <button type="button" onClick={() => void shareProfile()}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#cfc3ad] px-5 py-3 text-sm font-black text-[#172019]" aria-live="polite">
                  <Share2 className="h-4 w-4" />{shareStatus || 'Compartilhar'}
                </button>
              </div>
            </div>
          </div>
        </header>
        <div className="grid border-y border-[#e7dfd1] bg-[#f8f4eb] sm:grid-cols-3" aria-label="Informações rápidas">
          <div className="flex gap-3 px-5 py-4 sm:border-r sm:border-[#e1d8c8]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div><strong className="block text-xs text-[#263029]">{official ? 'Perfil atualizado' : 'Perfil mapeado'}</strong><span className="text-[11px] text-[#707970]">{official ? 'pela própria casa' : 'com dados públicos'}</span></div></div>
          <div className="flex gap-3 border-t border-[#e1d8c8] px-5 py-4 sm:border-r sm:border-t-0"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#9d7400]" />
            <div><strong className="block text-xs text-[#263029]">Visitas com confirmação</strong><span className="text-[11px] text-[#707970]">consulte a agenda antes de ir</span></div></div>
          <div className="flex gap-3 border-t border-[#e1d8c8] px-5 py-4 sm:border-t-0"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div><strong className="block text-xs text-[#263029]">Contato protegido</strong><span className="text-[11px] text-[#707970]">o número não fica exposto</span></div></div>
        </div>
        <div className="overflow-x-auto"><div className="flex min-w-max gap-1 px-3 pt-2 sm:px-6" role="tablist" aria-label="Seções do perfil">
          {PROFILE_TABS.map((tab, index) => <button key={tab.id} id={'tab-' + tab.id}
            ref={(node) => { tabRefs.current[tab.id] = node; }} type="button" role="tab"
            aria-selected={activeTab === tab.id} aria-controls={'panel-' + tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={(activeTab === tab.id ? 'border-[#d7a500] text-[#172019]' : 'border-transparent text-[#727a73] hover:text-[#172019]') +
              ' min-h-12 border-b-2 px-4 py-3 text-sm font-black transition'}>{tab.label}</button>)}
        </div></div>
      </article>

      <div className="mt-5 motion-safe:animate-[fadeIn_.35s_ease-out]" id={'panel-' + activeTab}
        role="tabpanel" aria-labelledby={'tab-' + activeTab}>
        {activeTab === 'visao-geral' ? <div className="grid gap-5 min-[900px]:grid-cols-[minmax(0,1.55fr)_minmax(18rem,.85fr)]">
          <div className="space-y-5">
            <NextGiraCard schedules={terreiro.horariosGira || []} whatsappHref={whatsappHref}
              onWhatsapp={trackWhatsapp} onOpenAgenda={() => activateTab('agenda')} />
            <PublicationFeed terreiro={terreiro} services={servicosData.servicos}
              onOpenInfo={() => activateTab('informacoes')} />
          </div>
          <OverviewSidebar terreiro={terreiro} onOpenInfo={() => activateTab('informacoes')}
            onOpenPhotos={() => activateTab('fotos')} />
        </div> : null}
        {activeTab === 'agenda' ? <AgendaPanel schedules={terreiro.horariosGira || []}
          whatsappHref={whatsappHref} onWhatsapp={trackWhatsapp} /> : null}
        {activeTab === 'publicacoes' ? <PublicationFeed terreiro={terreiro}
          services={servicosData.servicos} onOpenInfo={() => activateTab('informacoes')} /> : null}
        {activeTab === 'fotos' ? <PhotosPanel terreiro={terreiro} /> : null}
        {activeTab === 'informacoes' ? <div className="space-y-5">
          <ContactPanel terreiro={terreiro} whatsappHref={whatsappHref} onWhatsapp={trackWhatsapp} />
          <ServicesPanel services={servicosData.servicos} />
        </div> : null}
      </div>
      <ClaimSection terreiro={terreiro} official={official} />
    </main>
  </MatrizEditorialLayout>;
}
