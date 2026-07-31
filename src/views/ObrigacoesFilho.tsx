import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { cn } from '../lib/utils';
import { AppPageShell } from '../components/app/AppTopNav';
import { markObrigacoesSeen } from '../hooks/useObrigacoesUnread';

type Tenant =
  | { nome?: string; plan?: string; tenant_id?: string; foto_url?: string }
  | null
  | undefined;

interface ObrigacoesFilhoProps {
  user: SupabaseUser;
  tenantData?: Tenant;
  setActiveTab: (tab: string) => void;
}

type FilhoObrigacao = {
  id: string;
  titulo: string;
  data: string;
  hora?: string;
  descricao: string;
  status_confirmacao?: string;
  pdfViewUrl: string | null;
};

function stripObligationMetadata(descricao: string): string {
  return String(descricao || '').split('\n\n=== METADADOS ===')[0].trim();
}

function formatObligationDate(data: string, hora?: string): string {
  try {
    const datePart = format(parseISO(data.length > 10 ? data : `${data}T12:00:00`), "dd 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    });
    const horaRaw = String(hora || '').trim();
    if (!horaRaw || horaRaw === '00:00' || horaRaw === '00:00:00') return datePart;
    const match = horaRaw.match(/^(\d{1,2}):(\d{2})/);
    const horaFmt = match ? `${match[1].padStart(2, '0')}:${match[2]}` : horaRaw.slice(0, 5);
    return `${datePart} · ${horaFmt}`;
  } catch {
    return data;
  }
}

function buildPdfViewUrl(tenantId: string, storagePath: string | null | undefined): string | null {
  if (!storagePath || !tenantId) return null;
  return `/api/v1/library/pdf-proxy?tenantId=${encodeURIComponent(tenantId)}&path=${encodeURIComponent(storagePath)}`;
}

export default function ObrigacoesFilho({ user, tenantData, setActiveTab }: ObrigacoesFilhoProps) {
  const tenantId = tenantData?.tenant_id;
  const [filhoId, setFilhoId] = useState<string | null>(null);
  const [obrigacoes, setObrigacoes] = useState<FilhoObrigacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingPdfUrl, setOpeningPdfUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todas' | 'proximas' | 'concluidas'>('todas');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let { data: filho, error: filhoErr } = await supabase
          .from('filhos_de_santo')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!filho && user.email) {
          const byEmail = await supabase
            .from('filhos_de_santo')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (!byEmail.error && byEmail.data) filho = byEmail.data;
        }

        if (filhoErr || !filho?.id) {
          if (!cancelled) {
            setFilhoId(null);
            setObrigacoes([]);
          }
          return;
        }

        if (!cancelled) setFilhoId(String(filho.id));

        const { data: rows, error: obsErr } = await supabase
          .from('calendario_axe')
          .select('id, titulo, data, hora, descricao, status_confirmacao, pdf_storage_path')
          .eq('tipo', 'Obrigação')
          .like('descricao', `%FILHO_ID:${filho.id}%`)
          .eq('tenant_id', tenantId)
          .order('data', { ascending: false });

        if (obsErr) throw obsErr;

        const mapped: FilhoObrigacao[] = (rows || []).map((ob) => ({
          id: String(ob.id),
          titulo: String(ob.titulo || 'Obrigação'),
          data: String(ob.data || ''),
          hora: ob.hora ? String(ob.hora) : undefined,
          descricao: stripObligationMetadata(String(ob.descricao || '')),
          status_confirmacao: ob.status_confirmacao ? String(ob.status_confirmacao) : undefined,
          pdfViewUrl: buildPdfViewUrl(tenantId, ob.pdf_storage_path),
        }));

        if (!cancelled) {
          setObrigacoes(mapped);
          markObrigacoesSeen(String(filho.id), mapped.map((ob) => ob.id));
        }
      } catch (err) {
        console.error('[ObrigacoesFilho] erro ao carregar:', err);
        if (!cancelled) setObrigacoes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user.id, user.email, tenantId]);

  async function openObligationPdf(url: string) {
    try {
      setOpeningPdfUrl(url);
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Não foi possível abrir o PDF');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao abrir PDF');
    } finally {
      setOpeningPdfUrl(null);
    }
  }

  const journey = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const all = obrigacoes.map((ob) => {
      const date = new Date(`${ob.data.slice(0, 10)}T12:00:00`);
      const status = String(ob.status_confirmacao || '').toLowerCase();
      const done = ['confirmado', 'concluído', 'concluido'].includes(status);
      return { ...ob, date, done, upcoming: !done && date.getTime() >= now.getTime() };
    });
    const next = [...all]
      .filter((ob) => ob.upcoming)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] || null;
    const filtered = all.filter((ob) => (
      filter === 'todas' ? true : filter === 'proximas' ? ob.upcoming : ob.done
    ));
    return {
      all,
      filtered,
      next,
      completed: all.filter((ob) => ob.done).length,
      upcoming: all.filter((ob) => ob.upcoming).length,
    };
  }, [filter, obrigacoes]);

  return (
    <AppPageShell fullWidth>
      <div className="filho-journey-page">
        <header className="filho-journey-hero">
          <div className="filho-journey-hero__mark"><Flame /></div>
          <div className="filho-journey-hero__copy">
            <p><Sparkles /> Seu caminho no Axé</p>
            <h1>Caderno de<br /><strong>caminhada.</strong></h1>
            <span>Obrigações e marcos guardados com cuidado pela sua casa.</span>
          </div>
          <div className="filho-journey-hero__summary">
            <div><small>Registros</small><strong>{journey.all.length}</strong></div>
            <div><small>Concluídos</small><strong>{journey.completed}</strong></div>
            <div><small>Próximos</small><strong>{journey.upcoming}</strong></div>
          </div>
        </header>

        {loading ? (
          <div className="filho-journey-loading"><Loader2 /></div>
        ) : !filhoId ? (
          <section className="filho-journey-unlinked">
            <ShieldCheck />
            <div><h2>Seu vínculo ainda está sendo preparado</h2><p>Peça à zeladoria para conferir a vinculação do seu acesso ao cadastro da corrente.</p></div>
            <button type="button" onClick={() => setActiveTab('chat')}><MessageCircle /> Falar com a casa</button>
          </section>
        ) : obrigacoes.length === 0 ? (
          <section className="filho-journey-empty">
            <div className="filho-journey-empty__preview" aria-hidden>
              <span /><span /><span />
            </div>
            <div className="filho-journey-empty__copy">
              <p>Seu caderno está pronto</p>
              <h2>A caminhada será registrada aqui.</h2>
              <span>Quando a zeladoria cadastrar uma obrigação, você encontrará a data, as orientações e os documentos neste espaço.</span>
              <button type="button" onClick={() => setActiveTab('chat')}><MessageCircle /> Tirar uma dúvida</button>
            </div>
          </section>
        ) : (
          <>
            {journey.next ? (
              <section className="filho-journey-next">
                <div className="filho-journey-next__date">
                  <span>{format(journey.next.date, 'MMM', { locale: ptBR }).replace('.', '')}</span>
                  <strong>{format(journey.next.date, 'dd')}</strong>
                </div>
                <div className="filho-journey-next__copy">
                  <p>Próximo marco</p>
                  <h2>{journey.next.titulo}</h2>
                  <span><CalendarDays /> {formatObligationDate(journey.next.data, journey.next.hora)}</span>
                  {journey.next.descricao ? <em>{journey.next.descricao}</em> : null}
                </div>
                {journey.next.pdfViewUrl ? (
                  <button type="button" onClick={() => void openObligationPdf(journey.next!.pdfViewUrl!)} disabled={openingPdfUrl === journey.next.pdfViewUrl}>
                    {openingPdfUrl === journey.next.pdfViewUrl ? <Loader2 className="animate-spin" /> : <FileText />}
                    Abrir orientações
                  </button>
                ) : <span className="filho-journey-next__pending"><Clock /> Orientações em preparação</span>}
              </section>
            ) : (
              <section className="filho-journey-rest">
                <span><Check /></span>
                <div><p>Sua jornada está em dia</p><h2>Nenhum próximo marco agendado.</h2></div>
              </section>
            )}

            <section className="filho-journey-ledger">
              <header>
                <div><p>Memória da caminhada</p><h2>Seus registros</h2></div>
                <div className="filho-journey-filters">
                  {([
                    ['todas', 'Toda a jornada'],
                    ['proximas', 'Próximas'],
                    ['concluidas', 'Concluídas'],
                  ] as const).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? 'is-active' : ''}>{label}</button>
                  ))}
                </div>
              </header>

              {journey.filtered.length ? (
                <div className="filho-journey-list">
                  {journey.filtered.map((ob, index) => (
                    <article key={ob.id} className={cn(ob.done && 'is-done')}>
                      <div className="filho-journey-list__rail">
                        <span>{ob.done ? <Check /> : <Flame />}</span>
                        {index < journey.filtered.length - 1 ? <i /> : null}
                      </div>
                      <div className="filho-journey-list__date">
                        <strong>{format(ob.date, 'dd')}</strong>
                        <span>{format(ob.date, 'MMM yyyy', { locale: ptBR }).replace('.', '')}</span>
                      </div>
                      <div className="filho-journey-list__content">
                        <div>
                          <span>{ob.done ? 'Marco concluído' : ob.upcoming ? 'Próximo marco' : 'Registro da casa'}</span>
                          <h3>{ob.titulo}</h3>
                          <p>{formatObligationDate(ob.data, ob.hora)}</p>
                        </div>
                        {ob.descricao ? <p className="filho-journey-list__description">{ob.descricao}</p> : null}
                      </div>
                      <div className="filho-journey-list__action">
                        {ob.pdfViewUrl ? (
                          <button type="button" onClick={() => void openObligationPdf(ob.pdfViewUrl!)} disabled={openingPdfUrl === ob.pdfViewUrl}>
                            {openingPdfUrl === ob.pdfViewUrl ? <Loader2 className="animate-spin" /> : <FileText />}
                            <span>Orientações</span><ChevronRight />
                          </button>
                        ) : <span><Clock /> Documento não anexado</span>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="filho-journey-filter-empty"><Clock /><p>Nenhum registro encontrado neste filtro.</p></div>
              )}
            </section>
          </>
        )}
      </div>
    </AppPageShell>
  );
}
