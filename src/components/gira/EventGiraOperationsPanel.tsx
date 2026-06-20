import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  ClipboardCopy,
  Flame,
  Loader2,
  QrCode,
  Ticket,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  approveParticipante,
  checkinParticipante,
  emitirSenhaZelador,
  fetchMapaVelas,
  fetchParticipantes,
  fetchSenhas,
  patchGiraConfig,
  saveMapaVelas,
  toggleVelaEntregue,
  updateSenhaStatus,
  type EventoParticipante,
  type EventoSenha,
  type MapaVelaItem,
} from '../../lib/giraOperations';
import {
  CANDLE_COLOR_HEX,
  CANDLE_DOT_CLASS,
  VELAS_VALIDAS,
  type VelaCor,
} from '../../lib/pedidosRezaTypes';
import { AppPrimaryButton } from '../ui/appDemoUi';

type TabId = 'frequencia' | 'senhas' | 'velas' | 'qr';

type Props = {
  event: { id: string; titulo: string; data: string; hora: string; tipo: string };
  tenantId: string;
  onClose: () => void;
  /** Convidados externos — painel legado embutido via slot */
  guestsSlot?: React.ReactNode;
};

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'frequencia', label: 'Frequência', icon: Users },
  { id: 'senhas', label: 'Senhas', icon: Ticket },
  { id: 'velas', label: 'Mapa de velas', icon: Flame },
  { id: 'qr', label: 'QR Check-in', icon: QrCode },
];

export function EventGiraOperationsPanel({ event, tenantId, onClose, guestsSlot }: Props) {
  const [tab, setTab] = useState<TabId>('frequencia');
  const [loading, setLoading] = useState(true);
  const [participantes, setParticipantes] = useState<EventoParticipante[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    confirmados: 0,
    presentes: 0,
    vagas_maximas: null as number | null,
    vagas_restantes: null as number | null,
  });
  const [config, setConfig] = useState({
    vagas_maximas: '' as string | number,
    confirmacao_automatica: true,
    senhas_ativas: false,
  });
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [senhasUrl, setSenhasUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [senhas, setSenhas] = useState<EventoSenha[]>([]);
  const [velas, setVelas] = useState<MapaVelaItem[]>([]);
  const [novaSenhaNome, setNovaSenhaNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchParticipantes(event.id, tenantId);
      setParticipantes(res.data);
      setStats(res.stats);
      setCheckinUrl(res.checkinUrl);
      setSenhasUrl(res.senhasUrl);
      const ev = res.event;
      setConfig({
        vagas_maximas: ev.vagas_maximas ?? '',
        confirmacao_automatica: ev.confirmacao_automatica !== false,
        senhas_ativas: Boolean(ev.senhas_ativas),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [event.id, tenantId]);

  const loadSenhas = useCallback(async () => {
    try {
      setSenhas(await fetchSenhas(event.id, tenantId));
    } catch {
      /* silencioso */
    }
  }, [event.id, tenantId]);

  const loadVelas = useCallback(async () => {
    try {
      setVelas(await fetchMapaVelas(event.id, tenantId));
    } catch {
      /* silencioso */
    }
  }, [event.id, tenantId]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (tab === 'senhas') void loadSenhas();
    if (tab === 'velas') void loadVelas();
  }, [tab, loadSenhas, loadVelas]);

  useEffect(() => {
    if (!checkinUrl) {
      setQrDataUrl(null);
      return;
    }
    void QRCode.toDataURL(checkinUrl, { width: 220, margin: 2, color: { dark: '#080A0D', light: '#FFFFFF' } }).then(
      setQrDataUrl,
    );
  }, [checkinUrl]);

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      await patchGiraConfig(event.id, tenantId, {
        vagas_maximas: config.vagas_maximas === '' ? null : Number(config.vagas_maximas),
        confirmacao_automatica: config.confirmacao_automatica,
        senhas_ativas: config.senhas_ativas,
      });
      await loadCore();
      if (config.senhas_ativas) await loadSenhas();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleCheckin(filhoId: string) {
    setBusy(true);
    try {
      await checkinParticipante(event.id, tenantId, filhoId);
      await loadCore();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro no check-in');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(participanteId: string) {
    setBusy(true);
    try {
      await approveParticipante(event.id, tenantId, participanteId);
      await loadCore();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao aprovar');
    } finally {
      setBusy(false);
    }
  }

  async function handleEmitirSenha() {
    if (!novaSenhaNome.trim()) return;
    setBusy(true);
    try {
      await emitirSenhaZelador(event.id, tenantId, novaSenhaNome.trim());
      setNovaSenhaNome('');
      await loadSenhas();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao emitir senha');
    } finally {
      setBusy(false);
    }
  }

  async function handleSenhaStatus(senhaId: string, status: EventoSenha['status']) {
    setBusy(true);
    try {
      await updateSenhaStatus(event.id, tenantId, senhaId, status);
      await loadSenhas();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveVelas() {
    setBusy(true);
    try {
      const items = velas
        .filter((v) => v.vela)
        .map((v) => ({
          filho_id: v.filho_id,
          vela: v.vela as VelaCor,
          quantidade: v.quantidade,
          observacao: v.observacao,
          entregue: v.entregue,
        }));
      await saveMapaVelas(event.id, tenantId, items);
      await loadVelas();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao salvar velas');
    } finally {
      setBusy(false);
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendente: 'bg-amber-500/15 text-amber-400',
      confirmado: 'bg-emerald-500/15 text-emerald-400',
      recusado: 'bg-red-500/15 text-red-400',
      presente: 'bg-primary/15 text-primary',
    };
    return map[status] || 'bg-white/10 text-gray-400';
  };

  const velaOptions = useMemo(() => Array.from(VELAS_VALIDAS), []);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#1E242B] bg-[#13171D] shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#1E242B] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Operações da gira</p>
            <h3 className="truncate text-lg font-black text-white">{event.titulo}</h3>
            <p className="text-xs text-[#94A3B8]">
              {event.data} · {event.hora} · {event.tipo}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-white/5" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#1E242B] px-3 py-2 [scrollbar-width:none]">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all',
                  tab === t.id ? 'bg-primary text-[#080A0D]' : 'text-[#94A3B8] hover:bg-white/5',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading && tab === 'frequencia' ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : tab === 'frequencia' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Filhos', value: stats.total },
                  { label: 'Confirmados', value: stats.confirmados },
                  { label: 'Presentes', value: stats.presentes },
                  {
                    label: 'Vagas',
                    value: stats.vagas_maximas != null ? `${stats.confirmados}/${stats.vagas_maximas}` : '∞',
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{s.label}</p>
                    <p className="text-xl font-black text-white tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#1E242B] bg-[#12161A] p-3 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[#94A3B8]">Configuração de vagas</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">Máximo de participantes</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-[#1E242B] bg-[#0D0F12] px-3 py-2 text-sm text-white"
                      placeholder="Sem limite"
                      value={config.vagas_maximas}
                      onChange={(e) => setConfig((c) => ({ ...c, vagas_maximas: e.target.value }))}
                    />
                  </div>
                  <label className="flex items-center gap-2 self-end pb-2">
                    <input
                      type="checkbox"
                      checked={config.confirmacao_automatica}
                      onChange={(e) => setConfig((c) => ({ ...c, confirmacao_automatica: e.target.checked }))}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-xs text-[#94A3B8]">Confirmar participação automaticamente</span>
                  </label>
                  <label className="flex items-center gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={config.senhas_ativas}
                      onChange={(e) => setConfig((c) => ({ ...c, senhas_ativas: e.target.checked }))}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-xs text-[#94A3B8]">Ativar emissão pública de senhas para consulentes</span>
                  </label>
                </div>
                <AppPrimaryButton
                  type="button"
                  disabled={savingConfig}
                  className="w-full sm:w-auto"
                  onClick={() => void handleSaveConfig()}
                >
                  {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar configuração'}
                </AppPrimaryButton>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[#94A3B8]">Corrente — presença</p>
                {participantes.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Nenhum filho cadastrado.</p>
                ) : (
                  participantes.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">
                          {p.filhos_de_santo?.nome || 'Filho'}
                        </p>
                        <p className="text-[10px] text-gray-500">{p.filhos_de_santo?.cargo || '—'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', statusBadge(p.status))}>
                          {p.status}
                        </span>
                        {p.status === 'pendente' && p.justificativa?.includes('aprovação') ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleApprove(p.id)}
                            className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400"
                          >
                            Aprovar
                          </button>
                        ) : null}
                        {p.status !== 'presente' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleCheckin(p.filho_id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 text-[10px] font-bold text-primary"
                          >
                            <UserCheck className="h-3 w-3" />
                            Check-in
                          </button>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-primary" aria-label="Presente" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {guestsSlot ? <div className="border-t border-[#1E242B] pt-4">{guestsSlot}</div> : null}
            </div>
          ) : null}

          {tab === 'senhas' ? (
            <div className="space-y-4">
              {senhasUrl ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Link público</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="flex-1 truncate text-xs text-[#F1F5F9]">{senhasUrl}</code>
                    <button
                      type="button"
                      className="rounded-lg border border-[#1E242B] p-2 text-[#94A3B8] hover:text-white"
                      onClick={() => void navigator.clipboard.writeText(senhasUrl)}
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-400/90">
                  Ative &quot;Emissão pública de senhas&quot; na aba Frequência e salve a configuração.
                </p>
              )}

              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-[#1E242B] bg-[#12161A] px-3 py-2 text-sm text-white"
                  placeholder="Nome do consulente"
                  value={novaSenhaNome}
                  onChange={(e) => setNovaSenhaNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleEmitirSenha()}
                />
                <AppPrimaryButton type="button" disabled={busy} onClick={() => void handleEmitirSenha()}>
                  Emitir
                </AppPrimaryButton>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {senhas.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2"
                  >
                    <div>
                      <span className="text-lg font-black text-primary tabular-nums">#{s.numero}</span>
                      <span className="ml-2 text-sm text-white">{s.nome}</span>
                    </div>
                    <div className="flex gap-1">
                      {s.status === 'aguardando' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleSenhaStatus(s.id, 'chamado')}
                          className="rounded-lg bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-400"
                        >
                          Chamar
                        </button>
                      ) : null}
                      {s.status === 'chamado' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleSenhaStatus(s.id, 'atendido')}
                          className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400"
                        >
                          Atendido
                        </button>
                      ) : null}
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase text-gray-500">
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === 'velas' ? (
            <div className="space-y-3">
              <p className="text-xs text-[#94A3B8]">
                Defina a cor e quantidade de velas de obrigação por filho de santo nesta gira.
              </p>
              {velas.map((v, idx) => (
                <div
                  key={v.filho_id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] p-3"
                >
                  <div className="min-w-[120px] flex-1">
                    <p className="text-sm font-bold text-white">{v.nome}</p>
                    <p className="text-[10px] text-gray-500">{v.cargo || '—'}</p>
                  </div>
                  <select
                    className="rounded-lg border border-[#1E242B] bg-[#0D0F12] px-2 py-1.5 text-xs text-white"
                    value={v.vela || ''}
                    onChange={(e) => {
                      const val = e.target.value as VelaCor | '';
                      setVelas((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], vela: val || null };
                        return next;
                      });
                    }}
                  >
                    <option value="">—</option>
                    {velaOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="w-16 rounded-lg border border-[#1E242B] bg-[#0D0F12] px-2 py-1.5 text-xs text-white"
                    value={v.quantidade}
                    onChange={(e) => {
                      const q = Math.max(1, Number(e.target.value) || 1);
                      setVelas((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], quantidade: q };
                        return next;
                      });
                    }}
                  />
                  {v.vela ? (
                    <span
                      className={cn('h-6 w-3 rounded-full border', CANDLE_DOT_CLASS[v.vela] || 'bg-gray-400')}
                      style={{ backgroundColor: CANDLE_COLOR_HEX[v.vela] }}
                      title={v.vela}
                    />
                  ) : null}
                  <label className="flex items-center gap-1 text-[10px] text-gray-400">
                    <input
                      type="checkbox"
                      checked={v.entregue}
                      onChange={async (e) => {
                        const entregue = e.target.checked;
                        setVelas((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], entregue };
                          return next;
                        });
                        if (v.id) {
                          try {
                            await toggleVelaEntregue(event.id, tenantId, v.id, entregue);
                          } catch {
                            /* revert on next load */
                          }
                        }
                      }}
                      className="accent-primary"
                    />
                    Entregue
                  </label>
                </div>
              ))}
              <AppPrimaryButton type="button" disabled={busy} className="w-full" onClick={() => void handleSaveVelas()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar mapa de velas'}
              </AppPrimaryButton>
            </div>
          ) : null}

          {tab === 'qr' ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-[#94A3B8] max-w-sm">
                Exiba este QR na portaria da gira. Filhos de santo escaneiam e confirmam presença com CPF ou telefone
                cadastrado.
              </p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code check-in" className="rounded-xl border border-white/10 bg-white p-2" />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              )}
              {checkinUrl ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                  onClick={() => void navigator.clipboard.writeText(checkinUrl)}
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Copiar link do check-in
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
