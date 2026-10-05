import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Ban,
  MessageSquare,
  History,
  Phone,
  Mail,
  Globe,
  Instagram,
  MapPin,
  Calendar,
  Loader2,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  fetchLeadDetail,
  triggerLeadAnalysis,
  qualifyLeadManual,
  blacklistLeadManual,
  updateLeadPartial,
  sendLeadWhatsApp,
  type LeadDetailResponse,
} from '@/lib/prospectingApi';

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onRefreshList: () => void;
  onMessage?: (msg: string) => void;
}

export function LeadDetailDrawer({ leadId, onClose, onRefreshList, onMessage }: LeadDetailDrawerProps) {
  const [data, setData] = useState<LeadDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [obsModalOpen, setObsModalOpen] = useState(false);
  const [obsText, setObsText] = useState('');

  const loadData = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetchLeadDetail(leadId);
      setData(res);
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : 'Falha ao carregar detalhes do lead.');
    } finally {
      setLoading(false);
    }
  }, [leadId, onMessage]);

  useEffect(() => {
    if (leadId) void loadData();
    else setData(null);
  }, [leadId, loadData]);

  if (!leadId) return null;

  const lead = data?.lead;
  const latestAnalysis = data?.analyses?.[0];

  const handleAction = async (action: 'analyze' | 'qualify' | 'interested' | 'blacklist') => {
    if (!leadId || actionBusy) return;
    setActionBusy(true);
    try {
      if (action === 'analyze') {
        await triggerLeadAnalysis(leadId);
        onMessage?.('Análise de IA concluída com sucesso.');
      } else if (action === 'qualify') {
        await qualifyLeadManual(leadId);
        onMessage?.('Lead qualificado.');
      } else if (action === 'interested') {
        await updateLeadPartial(leadId, { status: 'interested' });
        onMessage?.('Lead marcado como interessado.');
      } else if (action === 'blacklist') {
        await blacklistLeadManual(leadId);
        onMessage?.('Lead marcado como não contatar e adicionado à blacklist.');
      }
      await loadData();
      onRefreshList();
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : 'Falha ao executar ação.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!leadId || actionBusy || !lead?.phone) return;
    const confirmSend = window.confirm(
      `Deseja disparar o template oficial de apresentação via WhatsApp para ${lead.name} (${lead.phone})?`,
    );
    if (!confirmSend) return;

    setActionBusy(true);
    try {
      await sendLeadWhatsApp(leadId);
      onMessage?.('Mensagem enviada com sucesso via WhatsApp!');
      await loadData();
      onRefreshList();
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : 'Falha ao enviar mensagem via WhatsApp.');
    } finally {
      setActionBusy(false);
    }
  };

  const scoreBadgeClass = (score: number) => {
    if (score >= 75) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (score >= 50) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (score >= 25) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <aside className="w-screen max-w-2xl border-l border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] p-6 shadow-2xl overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[var(--ac-paper-border)] pb-4">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--ac-accent)]">
                Detalhes da Prospecção
              </span>
              <h2 className="text-xl font-bold text-[var(--ac-text)] truncate mt-0.5">
                {lead ? lead.name : 'Carregando...'}
              </h2>
              {lead?.city && (
                <p className="text-xs text-[var(--ac-text-muted)] flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {[lead.city, lead.state].filter(Boolean).join(' - ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--ac-text-muted)] hover:bg-[var(--ac-paper)] hover:text-[var(--ac-text)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {loading && !data ? (
            <div className="flex flex-1 items-center justify-center py-20 text-[var(--ac-text-muted)]">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando informações completas...
            </div>
          ) : lead ? (
            <div className="flex-1 space-y-6 py-4">
              {/* Barra de Ações Rápidas */}
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)]">
                {lead.phone && (
                  <button
                    type="button"
                    disabled={actionBusy || lead.status === 'do_not_contact'}
                    onClick={() => void handleSendWhatsApp()}
                    className="admin-btn-secondary text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 font-semibold shadow-sm"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Enviar WhatsApp
                  </button>
                )}
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void handleAction('analyze')}
                  className="admin-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Analisar novamente
                </button>
                <button
                  type="button"
                  disabled={actionBusy || lead.status === 'qualified'}
                  onClick={() => void handleAction('qualify')}
                  className="admin-btn-secondary text-xs flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Qualificar
                </button>
                <button
                  type="button"
                  disabled={actionBusy || lead.status === 'interested'}
                  onClick={() => void handleAction('interested')}
                  className="admin-btn-secondary text-xs flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Marcar interessado
                </button>
                <button
                  type="button"
                  disabled={actionBusy || lead.status === 'do_not_contact'}
                  onClick={() => void handleAction('blacklist')}
                  className="admin-btn-secondary text-xs flex items-center gap-1.5 text-rose-400 hover:text-rose-300"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Não contatar
                </button>
                <button
                  type="button"
                  onClick={() => setObsModalOpen(true)}
                  className="admin-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Observação
                </button>
              </div>

              {/* Score e Status */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-3">
                  <span className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)]">Score IA</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-sm font-extrabold border ${scoreBadgeClass(lead.score)}`}>
                      {lead.score}/100
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-3">
                  <span className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)]">Status</span>
                  <p className="text-sm font-semibold text-[var(--ac-text)] mt-1 capitalize">{lead.status.replace(/_/g, ' ')}</p>
                </div>
                <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-3">
                  <span className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)]">Origem</span>
                  <p className="text-sm font-semibold text-[var(--ac-text)] mt-1 truncate">{lead.source}</p>
                </div>
                <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-3">
                  <span className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)]">WhatsApp Opt-in</span>
                  <p className="text-sm font-semibold text-[var(--ac-text)] mt-1">
                    {lead.whatsapp_opt_in ? (
                      <span className="text-emerald-400">Autorizado</span>
                    ) : (
                      <span className="text-[var(--ac-text-muted)]">Sem consentimento</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Informações de Contato e Canais */}
              <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ac-text)]">Canais de Contato</h3>
                <div className="grid gap-2 sm:grid-cols-2 text-xs">
                  <div className="flex items-center gap-2 text-[var(--ac-text-muted)]">
                    <Phone className="h-3.5 w-3.5 text-[var(--ac-accent)]" />
                    {lead.phone ? (
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--ac-accent)] hover:underline font-mono"
                      >
                        {lead.phone}
                      </a>
                    ) : (
                      'Não informado'
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[var(--ac-text-muted)]">
                    <Mail className="h-3.5 w-3.5 text-[var(--ac-accent)]" />
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="text-[var(--ac-accent)] hover:underline truncate">
                        {lead.email}
                      </a>
                    ) : (
                      'Não informado'
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[var(--ac-text-muted)]">
                    <Globe className="h-3.5 w-3.5 text-[var(--ac-accent)]" />
                    {lead.website ? (
                      <a href={lead.website} target="_blank" rel="noreferrer" className="text-[var(--ac-accent)] hover:underline truncate">
                        {lead.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      'Sem site'
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[var(--ac-text-muted)]">
                    <Instagram className="h-3.5 w-3.5 text-[var(--ac-accent)]" />
                    {lead.instagram ? (
                      <a
                        href={`https://instagram.com/${lead.instagram.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--ac-accent)] hover:underline"
                      >
                        @{lead.instagram.replace(/^@/, '')}
                      </a>
                    ) : (
                      'Sem Instagram'
                    )}
                  </div>
                </div>
                {lead.address && (
                  <p className="text-xs text-[var(--ac-text-muted)] pt-1 border-t border-[var(--ac-paper-border)] flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--ac-text-faint)]" />
                    {lead.address}
                  </p>
                )}
              </div>

              {/* Diagnóstico e Análise da IA */}
              <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ac-text)] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Resumo e Diagnóstico da IA
                  </h3>
                  {latestAnalysis && (
                    <span className="text-[10px] text-[var(--ac-text-muted)]">
                      Confiança: {Math.round(latestAnalysis.confidence * 100)}%
                    </span>
                  )}
                </div>

                <p className="text-xs text-[var(--ac-text-muted)] leading-relaxed">
                  {lead.ai_summary || latestAnalysis?.summary || 'Ainda não foi executada a análise detalhada por IA para este lead.'}
                </p>

                {latestAnalysis?.possible_needs?.length ? (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--ac-text-faint)]">
                      Necessidades Operacionais Detectadas
                    </span>
                    <ul className="mt-1 space-y-1">
                      {latestAnalysis.possible_needs.map((need, idx) => (
                        <li key={idx} className="text-xs text-[var(--ac-text)] flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ac-accent)]" /> {need}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {latestAnalysis?.recommended_next_action && (
                  <div className="p-2.5 rounded-lg border border-[var(--ac-accent-soft)] bg-[var(--ac-accent-soft)]/20 text-xs">
                    <span className="font-bold text-[var(--ac-text)]">Próxima ação recomendada: </span>
                    <span className="text-[var(--ac-text-muted)]">{latestAnalysis.recommended_next_action}</span>
                  </div>
                )}
              </div>

              {/* Linha do Tempo e Histórico Comercial de Eventos */}
              <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ac-text)] flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-blue-400" /> Histórico de Eventos ({data.events?.length || 0})
                </h3>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {data.events?.length ? (
                    data.events.map((ev) => (
                      <div key={ev.id} className="text-xs border-l-2 border-[var(--ac-accent)] pl-2.5 py-1">
                        <div className="flex items-center justify-between text-[10px] text-[var(--ac-text-muted)]">
                          <span className="font-semibold uppercase text-[var(--ac-text)]">{ev.event_type}</span>
                          <span>{format(new Date(ev.created_at), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                        <p className="text-[var(--ac-text-muted)] mt-0.5">{ev.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--ac-text-muted)]">Nenhum evento registrado ainda.</p>
                  )}
                </div>
              </div>

              {/* Conversas de WhatsApp */}
              <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ac-text)] flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-400" /> Conversas WhatsApp ({data.conversations?.length || 0})
                </h3>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {data.conversations?.length ? (
                    data.conversations.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-lg border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[var(--ac-text)]">Canal: {c.channel}</span>
                          <span className="text-[10px] text-[var(--ac-text-muted)]">
                            {c.last_message_at ? format(new Date(c.last_message_at), 'dd/MM HH:mm') : 'Sem mensagens'}
                          </span>
                        </div>
                        {c.human_handoff && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            Atendimento humano solicitado
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--ac-text-muted)]">Nenhuma conversa iniciada.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Modal de Observação Manual */}
          {obsModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md rounded-2xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] p-5 shadow-2xl">
                <h3 className="text-sm font-bold text-[var(--ac-text)]">Adicionar Observação Comercial</h3>
                <textarea
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  placeholder="Escreva detalhes do contato ou alinhamento comercial..."
                  rows={4}
                  className="mt-3 w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-3 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setObsModalOpen(false);
                      setObsText('');
                    }}
                    className="admin-btn-secondary text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!obsText.trim() || actionBusy}
                    onClick={async () => {
                      if (!leadId || !obsText.trim()) return;
                      setActionBusy(true);
                      try {
                        await updateLeadPartial(leadId, {
                          ai_summary: `${lead?.ai_summary || ''}\n[Nota manual]: ${obsText}`.trim(),
                        });
                        setObsModalOpen(false);
                        setObsText('');
                        onMessage?.('Observação salva.');
                        await loadData();
                      } catch (e) {
                        onMessage?.('Falha ao salvar observação.');
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                    className="admin-btn-secondary text-xs bg-[var(--ac-accent)] text-white hover:bg-[var(--ac-accent)]/80"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
