import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { marketingHref } from '../../lib/appHref';
import { AppPrimaryButton } from '../ui/appDemoUi';

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number | null;
  valor_min: number | null;
  valor_max: number | null;
  disponivel: boolean;
  ordem: number;
  created_at?: string;
};

type ServicosResponse = {
  claimed: boolean;
  servicos: Servico[];
  whatsappAtendimento: string | null;
};

const paperLabel =
  'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]';
const paperInput =
  'min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15';

const SERVICOS_SUGERIDOS = [
  'Jogo de Búzios',
  'Jogo de Cartas / Tarô',
  'Limpeza Espiritual',
  'Despacho',
  'Ebó',
  'Consulta com o Orixá',
  'Bori',
  'Atendimento de Umbanda',
  'Corrente de Cura',
  'Sessão de Preto Velho',
  'Sessão de Caboclo',
];

function formatValor(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'Sob consulta';
  if (min != null && max != null && min !== max) {
    return `R$ ${min.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} – R$ ${max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }
  const val = min ?? max ?? 0;
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function ServicoForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Servico>;
  onSave: (data: Omit<Servico, 'id' | 'created_at'>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [duracao, setDuracao] = useState(initial?.duracao_minutos?.toString() ?? '');
  const [valor, setValor] = useState(initial?.valor_min?.toString() ?? '');
  const [valorAte, setValorAte] = useState(
    initial?.valor_max != null && initial.valor_max !== initial.valor_min
      ? initial.valor_max.toString()
      : '',
  );
  const [disponivel, setDisponivel] = useState(initial?.disponivel ?? true);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSave() {
    setLocalError(null);
    if (nome.trim().length < 2) {
      setLocalError('Informe um nome para o atendimento.');
      return;
    }
    const valorMin = valor ? parseFloat(valor) || null : null;
    const valorMax = valorAte ? parseFloat(valorAte) || null : null;
    onSave({
      nome: nome.trim().slice(0, 120),
      descricao: descricao.trim().slice(0, 600) || null,
      duracao_minutos: duracao ? parseInt(duracao, 10) || null : null,
      valor_min: valorMin,
      valor_max: valorMax ?? valorMin,
      disponivel,
      ordem: initial?.ordem ?? 0,
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#DED6C8] bg-[#FFFDF8] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={paperLabel}>Nome do atendimento *</label>
          <input
            value={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
            className={paperInput}
            placeholder="Ex: Jogo de Búzios"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SERVICOS_SUGERIDOS.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNome(s)}
                className="rounded-full border border-[#DED6C8] bg-white px-2.5 py-1 text-[10px] font-bold text-[#70695F] transition hover:border-[#C6AF78] hover:text-[#8A6200]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={paperLabel}>Descrição</label>
          <textarea
            value={descricao}
            maxLength={600}
            rows={2}
            onChange={(e) => setDescricao(e.target.value)}
            className={`${paperInput} resize-none`}
            placeholder="Explique brevemente o que o atendimento inclui…"
          />
        </div>
        <div>
          <label className={paperLabel}>Duração estimada (min)</label>
          <input
            type="number"
            min={0}
            max={999}
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            className={paperInput}
            placeholder="Ex: 60"
          />
        </div>
        <div>
          <label className={paperLabel}>Preço (R$)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={paperInput}
            placeholder="Ex: 150"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={paperLabel}>Até (R$) — só se o preço variar</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={valorAte}
            onChange={(e) => setValorAte(e.target.value)}
            className={paperInput}
            placeholder="Deixe em branco se o valor for único"
          />
          <p className="mt-1.5 text-[11px] font-semibold text-[#70695F]">
            Preenche só quando o atendimento tem faixa, tipo de R$ 150 a R$ 250. Se for um valor só, deixa vazio.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#211D17]">
        <input
          type="checkbox"
          checked={disponivel}
          onChange={(e) => setDisponivel(e.target.checked)}
          className="h-4 w-4 accent-[#526A55]"
        />
        Disponível para agendamento
      </label>

      {localError ? (
        <p className="rounded-xl border border-[#B96545]/30 bg-[#B96545]/10 px-3 py-2 text-xs font-bold text-[#B96545]">
          {localError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <AppPrimaryButton className="app-v5-primary-button inline-flex items-center justify-center gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {saving ? 'Salvando…' : 'Salvar atendimento'}
        </AppPrimaryButton>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DED6C8] bg-white px-4 text-sm font-bold text-[#70695F] transition hover:bg-[#F7F1E7]"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function TerreiroServicosSettings() {
  const [data, setData] = useState<ServicosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [globalMsg, setGlobalMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const [whatsappAtendimento, setWhatsappAtendimento] = useState('');
  const [savingWa, setSavingWa] = useState(false);

  useEffect(() => {
    void authFetch('/api/v1/settings/terreiro-servicos')
      .then(async (res) => {
        const json = (await res.json()) as ServicosResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || 'Erro ao carregar.');
        setData(json);
        setWhatsappAtendimento(json.whatsappAtendimento || '');
      })
      .catch((e: unknown) =>
        setGlobalMsg({ text: e instanceof Error ? e.message : 'Erro ao carregar.', kind: 'error' }),
      )
      .finally(() => setLoading(false));
  }, []);

  async function createServico(payload: Omit<Servico, 'id' | 'created_at'>) {
    setSavingId('new');
    setGlobalMsg(null);
    try {
      const res = await authFetch('/api/v1/settings/terreiro-servicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ordem: data?.servicos.length ?? 0 }),
      });
      const json = (await res.json()) as { success?: boolean; servico?: Servico; error?: string };
      if (!res.ok) throw new Error(json.error || 'Erro ao criar.');
      setData((prev) => (prev ? { ...prev, servicos: [...prev.servicos, json.servico!] } : prev));
      setCreating(false);
      setGlobalMsg({ text: 'Atendimento criado com sucesso!', kind: 'success' });
    } catch (e: unknown) {
      setGlobalMsg({ text: e instanceof Error ? e.message : 'Erro ao criar.', kind: 'error' });
    } finally {
      setSavingId(null);
    }
  }

  async function updateServico(id: string, payload: Omit<Servico, 'id' | 'created_at'>) {
    setSavingId(id);
    setGlobalMsg(null);
    try {
      const res = await authFetch(`/api/v1/settings/terreiro-servicos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; servico?: Servico; error?: string };
      if (!res.ok) throw new Error(json.error || 'Erro ao atualizar.');
      setData((prev) =>
        prev ? { ...prev, servicos: prev.servicos.map((s) => (s.id === id ? json.servico! : s)) } : prev,
      );
      setEditingId(null);
      setGlobalMsg({ text: 'Atendimento atualizado!', kind: 'success' });
    } catch (e: unknown) {
      setGlobalMsg({ text: e instanceof Error ? e.message : 'Erro ao atualizar.', kind: 'error' });
    } finally {
      setSavingId(null);
    }
  }

  async function deleteServico(id: string) {
    if (!window.confirm('Excluir este atendimento?')) return;
    setDeletingId(id);
    setGlobalMsg(null);
    try {
      const res = await authFetch(`/api/v1/settings/terreiro-servicos/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error || 'Erro ao excluir.');
      }
      setData((prev) => (prev ? { ...prev, servicos: prev.servicos.filter((s) => s.id !== id) } : prev));
      setGlobalMsg({ text: 'Atendimento removido.', kind: 'success' });
    } catch (e: unknown) {
      setGlobalMsg({ text: e instanceof Error ? e.message : 'Erro ao excluir.', kind: 'error' });
    } finally {
      setDeletingId(null);
    }
  }

  async function saveWhatsapp() {
    setSavingWa(true);
    setGlobalMsg(null);
    try {
      const res = await authFetch('/api/v1/settings/terreiro-whatsapp-atendimento', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappAtendimento }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar.');
      setGlobalMsg({ text: 'WhatsApp de atendimento salvo!', kind: 'success' });
    } catch (e: unknown) {
      setGlobalMsg({ text: e instanceof Error ? e.message : 'Erro ao salvar.', kind: 'error' });
    } finally {
      setSavingWa(false);
    }
  }

  if (loading) {
    return (
      <div className="app-v5-panel grid min-h-40 place-items-center rounded-2xl">
        <Loader2 className="h-6 w-6 animate-spin text-[#526A55]" />
      </div>
    );
  }

  if (!data?.claimed) {
    return (
      <section className="app-v5-panel rounded-2xl p-6 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B08A22]">Atendimentos</p>
        <h3 className="mt-1 font-display text-xl font-black text-[#211D17]">Nenhum perfil reivindicado</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#70695F]">
          Reivindique o perfil da casa no diretório para cadastrar os atendimentos públicos.
        </p>
        <a
          href={marketingHref('/terreiros')}
          target="_blank"
          rel="noreferrer"
          className="app-v5-primary-button mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-black"
        >
          Encontrar minha casa no diretório
        </a>
      </section>
    );
  }

  const servicos = data.servicos || [];

  return (
    <section className="app-v5-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#DED6C8] p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B08A22]">Atendimentos</p>
        <h3 className="mt-1 font-display text-xl font-black tracking-tight text-[#211D17]">O que a casa oferece</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#70695F]">
          Cadastre os atendimentos espirituais. Eles aparecem no perfil público com contato direto pelo WhatsApp.
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp para atendimentos
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="tel"
              value={whatsappAtendimento}
              onChange={(e) => setWhatsappAtendimento(e.target.value)}
              className={`${paperInput} flex-1`}
              placeholder="Ex: 11999990000"
            />
            <AppPrimaryButton
              className="app-v5-primary-button inline-flex shrink-0 items-center justify-center gap-2"
              onClick={() => void saveWhatsapp()}
              disabled={savingWa}
            >
              {savingWa ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar
            </AppPrimaryButton>
          </div>
        </div>

        {globalMsg ? (
          <p
            className={`rounded-xl border px-3 py-2 text-xs font-bold ${
              globalMsg.kind === 'success'
                ? 'border-[#526A55]/25 bg-[#E7EFE6] text-[#3F5A42]'
                : 'border-[#B96545]/30 bg-[#B96545]/10 text-[#B96545]'
            }`}
            role="status"
          >
            {globalMsg.text}
          </p>
        ) : null}

        {servicos.length > 0 ? (
          <div className="space-y-2">
            {servicos.map((servico) =>
              editingId === servico.id ? (
                <ServicoForm
                  key={servico.id}
                  initial={servico}
                  saving={savingId === servico.id}
                  onSave={(payload) => void updateServico(servico.id, payload)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div
                  key={servico.id}
                  className={`flex items-start justify-between gap-4 rounded-xl border border-[#DED6C8] bg-white px-4 py-3 ${
                    servico.disponivel ? '' : 'opacity-55'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-black text-[#211D17]">{servico.nome}</h4>
                      {servico.disponivel ? (
                        <span className="rounded-full bg-[#E7EFE6] px-2 py-0.5 text-[9px] font-black uppercase text-[#3F5A42]">
                          Disponível
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#EEE7DC] px-2 py-0.5 text-[9px] font-black uppercase text-[#70695F]">
                          Indisponível
                        </span>
                      )}
                    </div>
                    {servico.descricao ? (
                      <p className="mt-1 truncate text-xs font-semibold text-[#70695F]">{servico.descricao}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-[#70695F]">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-[#B08A22]" />
                        {formatValor(servico.valor_min, servico.valor_max)}
                      </span>
                      {servico.duracao_minutos ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {servico.duracao_minutos} min
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      aria-label="Editar"
                      onClick={() => setEditingId(servico.id)}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-[#DED6C8] bg-[#F7F1E7] text-[#526A55] transition hover:bg-[#EEE7DC]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir"
                      onClick={() => void deleteServico(servico.id)}
                      disabled={deletingId === servico.id}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-[#B96545]/25 bg-[#B96545]/10 text-[#B96545] transition hover:bg-[#B96545]/20 disabled:opacity-50"
                    >
                      {deletingId === servico.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#DED6C8] bg-[#FFFDF8] px-6 py-8 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-[#C6AF78]" />
            <p className="mt-3 text-sm font-bold text-[#211D17]">Nenhum atendimento cadastrado</p>
            <p className="mt-1 text-xs font-semibold text-[#70695F]">
              Adicione os serviços da casa para aparecerem no perfil público.
            </p>
          </div>
        )}

        {creating ? (
          <ServicoForm
            saving={savingId === 'new'}
            onSave={(payload) => void createServico(payload)}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
              setGlobalMsg(null);
            }}
            disabled={servicos.length >= 20}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#C6AF78] bg-[#F8F1DF] px-5 text-sm font-black text-[#8A6200] transition hover:bg-[#F3E7C4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {servicos.length >= 20 ? 'Limite de 20 atendimentos atingido' : 'Adicionar atendimento'}
          </button>
        )}
      </div>
    </section>
  );
}
