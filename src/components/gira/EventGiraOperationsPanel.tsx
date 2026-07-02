import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  ClipboardCopy,
  Flame,
  Loader2,
  QrCode,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
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
import BodyPortal from '../BodyPortal';
import { AppPrimaryButton } from '../ui/appDemoUi';

type TabId = 'frequencia' | 'senhas' | 'velas' | 'qr';

type Props = {
  event: { id: string; titulo: string; data: string; hora: string; tipo: string };
  tenantId: string;
  onClose: () => void;
  /** Convidados externos — painel legado embutido via slot */
  guestsSlot?: React.ReactNode;
  /** Navega para Filhos de Santo (cadastro da corrente) */
  setActiveTab?: (tab: string) => void;
};

const TABS: { id: TabId; label: string; shortLabel: string; icon: typeof Users }[] = [
  { id: 'frequencia', label: 'Frequência', shortLabel: 'Freq.', icon: Users },
  { id: 'senhas', label: 'Senhas', shortLabel: 'Senhas', icon: Ticket },
  { id: 'velas', label: 'Mapa de velas', shortLabel: 'Velas', icon: Flame },
  { id: 'qr', label: 'Check-in visitantes', shortLabel: 'Portaria', icon: QrCode },
];

function participantesToVelas(participantes: EventoParticipante[]): MapaVelaItem[] {
  return participantes.map((p) => ({
    id: null,
    filho_id: p.filho_id,
    nome: p.filhos_de_santo?.nome || 'Filho',
    cargo: p.filhos_de_santo?.cargo ?? null,
    foto_url: p.filhos_de_santo?.foto_url ?? null,
    vela: null,
    quantidade: 1,
    entregue: false,
    observacao: '',
  }));
}

export function EventGiraOperationsPanel({ event, tenantId, onClose, guestsSlot, setActiveTab }: Props) {
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
    senhas_maximas: '' as string | number,
    confirmacao_automatica: true,
    senhas_ativas: false,
  });
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [senhasUrl, setSenhasUrl] = useState<string | null>(null);
  const [eventoPublicUrl, setEventoPublicUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [kioskOpen, setKioskOpen] = useState(false);
  const [senhas, setSenhas] = useState<EventoSenha[]>([]);
  const [velas, setVelas] = useState<MapaVelaItem[]>([]);
  const [velasLoading, setVelasLoading] = useState(false);
  const [velasError, setVelasError] = useState<string | null>(null);
  const [novaSenhaNome, setNovaSenhaNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchParticipantes(event.id, tenantId);
      setParticipantes(res.data);
      setStats(res.stats);
      setCheckinUrl(res.checkinUrl);
      setSenhasUrl(res.senhasUrl);
      setEventoPublicUrl(res.eventoPublicUrl);
      const ev = res.event;
      setConfig({
        vagas_maximas: ev.vagas_maximas ?? '',
        senhas_maximas: ev.senhas_maximas ?? '',
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
    setVelasLoading(true);
    setVelasError(null);
    try {
      setVelas(await fetchMapaVelas(event.id, tenantId));
    } catch (e: unknown) {
      setVelasError(e instanceof Error ? e.message : 'Erro ao carregar mapa de velas');
      setVelas((prev) => (prev.length > 0 ? prev : participantesToVelas(participantes)));
    } finally {
      setVelasLoading(false);
    }
  }, [event.id, tenantId, participantes]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (tab === 'senhas') void loadSenhas();
    if (tab === 'velas') void loadVelas();
  }, [tab, loadSenhas, loadVelas]);

  useEffect(() => {
    if (tab !== 'senhas') return;
    const id = window.setInterval(() => void loadSenhas(), 5000);
    return () => window.clearInterval(id);
  }, [tab, loadSenhas]);

  useEffect(() => {
    if (!checkinUrl) {
      setQrDataUrl(null);
      return;
    }
    void QRCode.toDataURL(checkinUrl, { width: kioskOpen ? 480 : 220, margin: 2, color: { dark: '#080A0D', light: '#FFFFFF' } }).then(
      setQrDataUrl,
    );
  }, [checkinUrl, kioskOpen]);

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      await patchGiraConfig(event.id, tenantId, {
        vagas_maximas: config.vagas_maximas === '' ? null : Number(config.vagas_maximas),
        senhas_maximas: config.senhas_maximas === '' ? null : Number(config.senhas_maximas),
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

  const senhasPresentes = useMemo(
    () => senhas.filter((s) => Boolean(s.checked_in_at)).length,
    [senhas],
  );
  const senhasAguardando = useMemo(
    () => senhas.filter((s) => !s.checked_in_at && s.status === 'aguardando').length,
    [senhas],
  );

  const velaOptions = useMemo(() => Array.from(VELAS_VALIDAS), []);

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
        <div className="relative z-10 flex min-h-full items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,env(safe-area-inset-top))] sm:p-6 sm:pt-24">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gira-ops-title"
          className="flex max-h-[min(88dvh,calc(100dvh-2.5rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-2xl"
        >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#1E242B] px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-primary sm:text-[10px]">Operações da gira</p>
            <h3 id="gira-ops-title" className="truncate text-sm font-black text-white sm:text-lg">
              {event.titulo}
            </h3>
            <p className="truncate text-[10px] text-[#94A3B8] sm:text-xs">
              {event.data} · {event.hora} · {event.tipo}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-1.5 text-gray-400 hover:bg-white/5 sm:p-2" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-4 border-b border-[#1E242B] px-1 py-1 sm:px-3 sm:py-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                title={t.label}
                aria-label={t.label}
                aria-current={tab === t.id ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[9px] font-bold leading-tight transition-all sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs',
                  tab === t.id ? 'bg-primary text-[#080A0D]' : 'text-[#94A3B8] hover:bg-white/5',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 sm:h-3.5 sm:w-3.5" />
                <span className="max-w-full truncate sm:hidden">{t.shortLabel}</span>
                <span className="hidden max-w-full truncate sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {loading && tab === 'frequencia' ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : tab === 'frequencia' ? (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                {[
                  { label: 'Filhos', value: stats.total },
                  { label: 'Confirmados', value: stats.confirmados },
                  {
                    label: 'Vagas',
                    value: stats.vagas_maximas != null ? `${stats.confirmados}/${stats.vagas_maximas}` : '∞',
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-[#1E242B] bg-[#12161A] px-1.5 py-1.5 text-center sm:px-2 sm:py-2">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-[#64748B] sm:text-[9px]">{s.label}</p>
                    <p className="text-base font-black text-white tabular-nums sm:text-lg">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#1E242B] bg-[#12161A]">
                  <p className="hidden px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] lg:block">
                    Configuração de vagas
                  </p>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left lg:hidden"
                    onClick={() => setMobileConfigOpen((v) => !v)}
                    aria-expanded={mobileConfigOpen}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#94A3B8]">
                      Configuração de vagas
                    </span>
                    <span className="text-[10px] font-normal normal-case text-[#64748B]">
                      {mobileConfigOpen ? 'Recolher' : 'Expandir'}
                    </span>
                  </button>
                  <div className={cn('space-y-2.5 px-3 pb-3 pt-0 lg:border-t lg:border-[#1E242B] lg:pt-2.5', mobileConfigOpen ? 'block' : 'hidden lg:block')}>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500">Máximo de participantes</label>
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded-lg border border-[#1E242B] bg-[#0D0F12] px-3 py-1.5 text-sm text-white"
                        placeholder="Sem limite"
                        value={config.vagas_maximas}
                        onChange={(e) => setConfig((c) => ({ ...c, vagas_maximas: e.target.value }))}
                      />
                    </div>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={config.confirmacao_automatica}
                        onChange={(e) => setConfig((c) => ({ ...c, confirmacao_automatica: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                      />
                      <span className="text-[11px] leading-snug text-[#94A3B8]">Confirmar participação automaticamente</span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={config.senhas_ativas}
                        onChange={(e) => setConfig((c) => ({ ...c, senhas_ativas: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                      />
                      <span className="text-[11px] leading-snug text-[#94A3B8]">
                        Ativar emissão pública de senhas para visitantes
                      </span>
                    </label>
                    {config.senhas_ativas ? (
                      <div>
                        <label className="text-[10px] font-bold uppercase text-gray-500">Senhas disponíveis</label>
                        <input
                          type="number"
                          min={1}
                          className="mt-1 w-full rounded-lg border border-[#1E242B] bg-[#0D0F12] px-3 py-1.5 text-sm text-white"
                          placeholder="Ex: 50"
                          value={config.senhas_maximas}
                          onChange={(e) => setConfig((c) => ({ ...c, senhas_maximas: e.target.value }))}
                        />
                      </div>
                    ) : null}
                    <AppPrimaryButton
                      type="button"
                      disabled={savingConfig}
                      className="w-full"
                      onClick={() => void handleSaveConfig()}
                    >
                      {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar configuração'}
                    </AppPrimaryButton>
                  </div>
                </div>

              <p className="text-[11px] leading-relaxed text-[#64748B]">
                As confirmações dos filhos aparecem nos cards do calendário. Use a aba Portaria para o check-in de
                visitantes com senha.
              </p>

              {guestsSlot ? <div className="border-t border-[#1E242B] pt-3">{guestsSlot}</div> : null}
            </div>
          ) : null}

          {tab === 'senhas' ? (
            <div className="space-y-4">
              {eventoPublicUrl ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Link para divulgar</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="flex-1 truncate text-xs text-[#F1F5F9]">{eventoPublicUrl}</code>
                    <button
                      type="button"
                      className="rounded-lg border border-[#1E242B] p-2 text-[#94A3B8] hover:text-white"
                      onClick={() => void navigator.clipboard.writeText(eventoPublicUrl)}
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-[#64748B]">Use este link no TikTok, Instagram e Facebook.</p>
                </div>
              ) : null}
              {senhasUrl ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Link direto de senhas</p>
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

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[#1E242B] bg-[#12161A] px-3 py-2 text-center">
                  <p className="text-[9px] font-bold uppercase text-[#64748B]">Presentes</p>
                  <p className="text-lg font-black text-emerald-400">{senhasPresentes}</p>
                </div>
                <div className="rounded-lg border border-[#1E242B] bg-[#12161A] px-3 py-2 text-center">
                  <p className="text-[9px] font-bold uppercase text-[#64748B]">Aguardando</p>
                  <p className="text-lg font-black text-white">{senhasAguardando}</p>
                </div>
              </div>

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

              <div className="space-y-2">
                {senhas.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2"
                  >
                    <div>
                      <span className="text-lg font-black text-primary tabular-nums">#{s.numero}</span>
                      <span className="ml-2 text-sm text-white">{s.nome}</span>
                      {s.checked_in_at ? (
                        <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                          Presente
                        </span>
                      ) : null}
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
              {velasLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : velasError ? (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {velasError}
                </p>
              ) : null}
              {!velasLoading && velas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#1E242B] bg-[#12161A] px-4 py-8 text-center">
                  <Flame className="mx-auto mb-3 h-8 w-8 text-[#64748B]" aria-hidden />
                  <p className="text-sm font-bold text-[#F1F5F9]">Nenhum filho de santo na corrente</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[#94A3B8]">
                    Cadastre os médiums em Filhos de Santo para definir as velas de obrigação desta gira.
                  </p>
                  {setActiveTab ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setActiveTab('children');
                      }}
                      className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                    >
                      Ir para Filhos de Santo
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!velasLoading
                ? velas.map((v, idx) => (
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
              ))
                : null}
              {!velasLoading && velas.length > 0 ? (
                <AppPrimaryButton type="button" disabled={busy} className="w-full" onClick={() => void handleSaveVelas()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar mapa de velas'}
                </AppPrimaryButton>
              ) : null}
            </div>
          ) : null}

          {tab === 'qr' ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="max-w-sm text-sm text-[#94A3B8]">
                Exiba este QR na portaria. Visitantes abrem o link do WhatsApp e apontam a câmera para este código.
              </p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code check-in visitantes" className="rounded-xl border border-white/10 bg-white p-2" />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              )}
              {checkinUrl ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                    onClick={() => void navigator.clipboard.writeText(checkinUrl)}
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" />
                    Copiar link do QR
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary"
                    onClick={() => setKioskOpen(true)}
                  >
                    Modo tablet (tela cheia)
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        </div>
        </div>
      </div>

      {kioskOpen && checkinUrl ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#080A0D] px-6 py-10 text-center">
          <button
            type="button"
            className="absolute right-4 top-4 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-[#94A3B8]"
            onClick={() => setKioskOpen(false)}
          >
            Sair do modo tablet
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{event.titulo}</p>
          <p className="mt-2 max-w-md text-sm text-[#94A3B8]">
            Visitantes: abra o link do WhatsApp e aponte a câmera para o QR abaixo.
          </p>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code portaria"
              className="mt-8 rounded-2xl border-4 border-white/10 bg-white p-4"
            />
          ) : (
            <Loader2 className="mt-8 h-10 w-10 animate-spin text-primary" />
          )}
        </div>
      ) : null}
    </BodyPortal>
  );
}
