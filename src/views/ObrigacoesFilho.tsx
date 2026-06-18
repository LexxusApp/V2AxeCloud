import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Check,
  Clock,
  FileText,
  Flame,
  Loader2,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { cn } from '../lib/utils';
import { AppPageShell } from '../components/app/AppTopNav';
import {
  filhoKickerClass,
  filhoPanelClass,
  filhoPanelInsetClass,
  filhoSectionTitleClass,
} from '../lib/filhoUiTokens';

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
    const m = horaRaw.match(/^(\d{1,2}):(\d{2})/);
    const horaFmt = m ? `${m[1].padStart(2, '0')}:${m[2]}` : horaRaw.slice(0, 5);
    return `${datePart} · ${horaFmt}`;
  } catch {
    return data;
  }
}

function buildPdfViewUrl(tenantId: string, storagePath: string | null | undefined): string | null {
  if (!storagePath || !tenantId) return null;
  return `/api/v1/library/pdf-proxy?tenantId=${encodeURIComponent(tenantId)}&path=${encodeURIComponent(storagePath)}`;
}

export default function ObrigacoesFilho({ user, tenantData }: ObrigacoesFilhoProps) {
  const tenantId = tenantData?.tenant_id;
  const [filhoId, setFilhoId] = useState<string | null>(null);
  const [obrigacoes, setObrigacoes] = useState<FilhoObrigacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingPdfUrl, setOpeningPdfUrl] = useState<string | null>(null);

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

        let obsQuery = supabase
          .from('calendario_axe')
          .select('id, titulo, data, hora, descricao, status_confirmacao, pdf_storage_path')
          .eq('tipo', 'Obrigação')
          .like('descricao', `%FILHO_ID:${filho.id}%`)
          .order('data', { ascending: false });

        obsQuery = obsQuery.eq('tenant_id', tenantId);

        const { data: rows, error: obsErr } = await obsQuery;
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

        if (!cancelled) setObrigacoes(mapped);
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

  return (
    <AppPageShell>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header className={cn(filhoPanelClass, 'px-6 py-8 sm:px-10')}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
              <Flame className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className={filhoKickerClass}>Seu caminho no Axé</p>
              <h1 className={cn(filhoSectionTitleClass, 'mt-1 text-2xl sm:text-3xl')}>Obrigações</h1>
              <p className="mt-2 text-sm text-[#94A3B8] max-w-2xl">
                Obrigações cadastradas pelo zelador no seu prontuário. Abra o PDF anexo para ver a lista de itens e
                orientações.
              </p>
            </div>
          </div>
        </header>

        <section className={cn(filhoPanelClass, 'p-6 sm:p-8')}>
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !filhoId ? (
            <div className="rounded-xl border border-dashed border-[#2F3643] bg-[#12161A] py-12 px-6 text-center">
              <p className="text-sm font-bold text-gray-400">Perfil ainda não vinculado</p>
              <p className="mt-2 text-xs text-gray-500">Contate o zelador do terreiro para liberar seu acesso.</p>
            </div>
          ) : obrigacoes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2F3643] bg-[#12161A] py-12 px-6 text-center">
              <Flame className="mx-auto mb-3 h-10 w-10 text-primary/40" />
              <p className="text-sm font-bold text-gray-300">Nenhuma obrigação registrada</p>
              <p className="mt-2 text-xs text-gray-500 max-w-sm mx-auto">
                Quando o zelador agendar uma obrigação no seu perfil, ela aparecerá aqui com data e documento, se houver.
              </p>
            </div>
          ) : (
            <div className="relative ml-4 space-y-6 border-l-2 border-[#1E242B] py-2 pl-8">
              {obrigacoes.map((ob) => {
                const done =
                  ob.status_confirmacao === 'Confirmado' || ob.status_confirmacao === 'Concluído';
                return (
                  <article key={ob.id} className="group relative">
                    <div
                      className={cn(
                        'absolute -left-[41px] top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-[#13171D]',
                        done ? 'border-primary text-primary' : 'border-[#222B36] text-gray-600',
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    </div>
                    <div
                      className={cn(
                        filhoPanelInsetClass,
                        'p-5 transition-colors hover:border-primary/25',
                      )}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <h2 className="text-base font-black text-white tracking-tight">{ob.titulo}</h2>
                          <p className="text-xs font-semibold text-primary/90">
                            {formatObligationDate(ob.data, ob.hora)}
                          </p>
                          {ob.descricao ? (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#94A3B8]">
                              {ob.descricao}
                            </p>
                          ) : null}
                          {ob.pdfViewUrl ? (
                            <button
                              type="button"
                              onClick={() => openObligationPdf(ob.pdfViewUrl!)}
                              disabled={openingPdfUrl === ob.pdfViewUrl}
                              className="mt-2 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-primary transition hover:bg-primary/20 disabled:opacity-50"
                            >
                              {openingPdfUrl === ob.pdfViewUrl ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                              Ver lista em PDF
                            </button>
                          ) : (
                            <p className="text-[11px] italic text-gray-600">Sem documento PDF anexado.</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            'shrink-0 self-start rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wider',
                            done
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-[#1E242B] bg-[#181C21] text-gray-500',
                          )}
                        >
                          {done ? 'Concluída' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppPageShell>
  );
}
