import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Clock,
  Flame,
  Heart,
  Loader2,
  MapPin,
} from 'lucide-react';
import { ROUTES } from '../../lib/routes';
import { CANDLE_COLOR_HEX, VELA_OPTIONS, type VelaCor } from './espacoFielV3Data';
import { useEspacoFielPedidos } from '../../hooks/useEspacoFielPedidos';

type PublicPrayerForm = {
  solicitante: string;
  casa: string;
  slug: string;
  categoria: string;
  linha: string;
  vela: VelaCor;
  intencao: string;
  whatsapp: string;
};

const PUBLIC_FORM_INITIAL: PublicPrayerForm = {
  solicitante: '',
  casa: '',
  slug: '',
  categoria: 'Proteção / Defesa Espiritual',
  linha: 'Caboclos',
  vela: 'Branca',
  intencao: '',
  whatsapp: '',
};

export function EspacoFielV3Portal() {
  const { terreiros, terreirosLoading, pedidos, submitPedido, sendMensagem } = useEspacoFielPedidos();
  const [notification, setNotification] = useState<string | null>(null);
  const [publicPrayerRequest, setPublicPrayerRequest] = useState<PublicPrayerForm>(PUBLIC_FORM_INITIAL);
  const [publicSelectedId, setPublicSelectedId] = useState<string | null>(null);
  const [publicChatInput, setPublicChatInput] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('Todas');
  const [submitting, setSubmitting] = useState(false);

  const cidadesFiltro = useMemo(() => {
    const cities = [...new Set(terreiros.map((t) => t.cidade).filter(Boolean))].sort();
    return ['Todas', ...cities];
  }, [terreiros]);

  const terreirosFiltrados = useMemo(
    () => terreiros.filter((c) => selectedCity === 'Todas' || c.cidade === selectedCity),
    [terreiros, selectedCity],
  );

  const prayerRequests = pedidos;
  const selectedReq = prayerRequests.find((r) => r.id === publicSelectedId) ?? prayerRequests[0] ?? null;

  useEffect(() => {
    if (pedidos.length > 0) {
      setPublicSelectedId((cur) => cur ?? pedidos[0].id);
    }
  }, [pedidos]);

  useEffect(() => {
    if (terreirosLoading || terreiros.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const slugParam = (params.get('casa') || params.get('slug') || '').trim().toLowerCase();
    if (!slugParam) return;

    const match = terreiros.find((t) => String(t.slug || '').toLowerCase() === slugParam);
    if (!match) return;

    setPublicPrayerRequest((prev) => {
      if (prev.slug === match.slug) return prev;
      return { ...prev, casa: match.nome, slug: match.slug };
    });
    setSelectedCity((cur) => (cur === 'Todas' ? match.cidade : cur));
  }, [terreiros, terreirosLoading]);

  const showNotification = useCallback((message: string) => {
    setNotification(message);
    window.setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleAddPublicPrayer = async (e: FormEvent) => {
    e.preventDefault();
    if (!publicPrayerRequest.slug) {
      showNotification('Selecione um terreiro parceiro com portal de pedidos activo.');
      return;
    }
    if (!publicPrayerRequest.solicitante.trim() || !publicPrayerRequest.intencao.trim()) {
      showNotification('Por favor, preencha o nome de quem solicita e a intenção de oração.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitPedido({
        slug: publicPrayerRequest.slug,
        nome: publicPrayerRequest.solicitante.trim(),
        mensagem: publicPrayerRequest.intencao.trim(),
        categoria: publicPrayerRequest.categoria,
        linha: publicPrayerRequest.linha,
        vela: publicPrayerRequest.vela,
        whatsapp: publicPrayerRequest.whatsapp,
      });
      if (created?.id) setPublicSelectedId(created.id);
      setPublicPrayerRequest({
        ...PUBLIC_FORM_INITIAL,
        casa: publicPrayerRequest.casa,
        slug: publicPrayerRequest.slug,
      });
      showNotification(
        `Seu pedido foi registrado na casa "${publicPrayerRequest.casa}" com sucesso! Acompanhe o Altar Virtual na coluna ao lado.`,
      );
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Erro ao enviar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPublicChatMessage = async () => {
    if (!publicChatInput.trim() || !selectedReq?.token) return;
    try {
      await sendMensagem(selectedReq.token, publicChatInput.trim());
      setPublicChatInput('');
      showNotification('Mensagem enviada com sucesso no chat do altar!');
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    }
  };

  return (
    <>
      {notification ? (
        <div className="fixed right-4 top-[max(1.5rem,env(safe-area-inset-top))] z-50 flex max-w-[calc(100vw-2rem)] animate-bounce items-center gap-3 rounded-xl border border-[#FACC15]/30 bg-[#12161A] px-5 py-4 text-[#F1F5F9] shadow-2xl sm:right-6 md:right-12 md:max-w-sm">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#FACC15]" />
          <p className="text-sm font-medium">{notification}</p>
        </div>
      ) : null}

      <div
        id="portal-do-fiel"
        className="mx-auto max-w-7xl animate-fadeIn px-4 py-12 sm:px-6 md:py-16 lg:px-8"
      >
        <div className="relative mx-auto mb-16 max-w-3xl text-center">
          <span className="mb-3 inline-block animate-pulse rounded-full border border-rose-500/20 bg-rose-950/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
            ❤️ Espaço do Fiel & Caridade Litúrgica
          </span>
          <h2 className="font-display text-4xl font-black tracking-tight text-[#F1F5F9] md:text-5xl">
            Portal Público de Pedidos de Reza
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-light text-[#94A3B8] md:text-base">
            Este é o <strong className="font-semibold text-[#F1F5F9]">ambiente dedicado do visitante e herdeiro de fé</strong>.
            Com total privacidade e respeito, você pode selecionar uma casa de acolhimento parceira por cidade, firmar seus
            pedidos secretos de reza e sintonizar as correntes virtuais no Altar do Congá.
          </p>
        </div>

        <div className="relative mb-8 overflow-hidden rounded-3xl border border-[#1E242B] bg-[#13171D] p-6">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-rose-500/5 blur-2xl filter" />

          <div className="mb-6 flex flex-col gap-6 border-b border-[#1E242B] pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400">
                Passo 1 • Localização da Fé
              </span>
              <h3 className="flex items-center gap-2 font-display text-xl font-extrabold text-[#F1F5F9]">
                <MapPin className="h-5 w-5 text-rose-500" />
                Selecione o Terreiro por Cidade
              </h3>
              <p className="mt-1 text-xs font-light text-[#94A3B8]">
                Encontre a casa religiosa na sua cidade ou a mais próxima se identificando abaixo:
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {cidadesFiltro.map((city) => {
                const isActive = selectedCity === city;
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setSelectedCity(city)}
                    className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#FACC15] font-bold text-[#080A0D] shadow-md shadow-[#FACC15]/20'
                        : 'border border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:bg-[#1C232B] hover:text-[#F1F5F9]'
                    }`}
                  >
                    {city === 'Todas' ? '📍 Todas as Cidades' : city}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {terreirosLoading ? (
              <div className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-[#94A3B8]">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Carregando terreiros parceiros...
              </div>
            ) : null}
            {!terreirosLoading &&
              terreirosFiltrados.map((casa) => {
              const isSelected = publicPrayerRequest.slug === casa.slug;
              return (
                <div
                  key={casa.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setPublicPrayerRequest({
                      ...publicPrayerRequest,
                      casa: casa.nome,
                      slug: casa.slug,
                    });
                    showNotification(`Terreiro "${casa.nome}" selecionado!`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setPublicPrayerRequest({
                        ...publicPrayerRequest,
                        casa: casa.nome,
                        slug: casa.slug,
                      });
                      showNotification(`Terreiro "${casa.nome}" selecionado!`);
                    }
                  }}
                  className={`flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'scale-[1.02] border-[#FACC15] bg-[#1E2530] shadow-lg shadow-[#FACC15]/5'
                      : 'border-[#1E242B] bg-[#0F1216] hover:border-[#94A3B8]/30 hover:bg-[#12161A]'
                  }`}
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-1 rounded border border-[#FACC15]/10 bg-[#12161A] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-wider text-amber-500">
                        <Building2 className="h-3 w-3" /> Terreiro Parceiro
                      </span>
                      <span className="text-[10px] font-bold text-[#FACC15]">{casa.estado}</span>
                    </div>
                    <h4 className="mb-1.5 line-clamp-1 font-display text-xs font-bold text-[#F1F5F9]">{casa.nome}</h4>
                    <p className="mb-4 flex items-start gap-1 text-[10.5px] font-light leading-relaxed text-gray-400">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-gray-500" />
                      <span className="line-clamp-2">{casa.cidade}{casa.estado ? ` — ${casa.estado}` : ''}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#1E242B]/80 pt-3 text-[10px]">
                    <span className="font-mono italic text-gray-500">{casa.cidade}</span>
                    <span
                      className={`font-bold uppercase tracking-wider transition-all ${
                        isSelected ? 'text-[10.5px] text-[#FACC15]' : 'text-gray-400 hover:text-[#FACC15]'
                      }`}
                    >
                      {isSelected ? '✓ Selecionado' : 'Selecionar'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {!terreirosLoading && terreirosFiltrados.length === 0 ? (
            <div className="my-2 rounded-2xl border border-dashed border-[#1E242B] bg-[#0F1216] p-8 text-center text-gray-500">
              {terreiros.length === 0
                ? 'Nenhum terreiro com portal de pedidos activo no momento. As casas podem activar o portal em Configurações no app AxéCloud.'
                : 'Nenhum terreiro cadastrado nesta cidade ainda. Experimente selecionar "Todas as Cidades" ou escolher uma cidade vizinha.'}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-between rounded-3xl border border-[#1E242B] bg-[#13171D] p-6 shadow-inner lg:col-span-5">
            <div>
              <div className="mb-4 flex items-center gap-2.5 border-b border-[#1E242B] pb-3">
                <Flame className="h-5 w-5 animate-pulse fill-rose-500/10 text-rose-500" />
                <h3 className="font-display text-base font-bold text-[#F1F5F9]">Formulário Oficial de Amparo</h3>
              </div>

              <form onSubmit={handleAddPublicPrayer} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
                    Terreiro de Destino Selecionado
                  </label>
                  <div className="flex items-center justify-between rounded-lg border border-[#1E242B] bg-[#12161A] p-3">
                    <span className="text-xs font-bold text-amber-400">
                      {publicPrayerRequest.casa || 'Selecione um terreiro acima'}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[#94A3B8]">
                      {publicPrayerRequest.slug ? 'Pronto' : 'Pendente'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
                    Nome Completo (ou Iniciais de quem precisa)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos de Souza"
                    value={publicPrayerRequest.solicitante}
                    onChange={(e) => setPublicPrayerRequest({ ...publicPrayerRequest, solicitante: e.target.value })}
                    className="w-full rounded-lg border border-[#1E242B] bg-[#12161A] p-2.5 text-xs text-[#F1F5F9] placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
                      Tipo de Pedido
                    </label>
                    <select
                      value={publicPrayerRequest.categoria}
                      onChange={(e) => setPublicPrayerRequest({ ...publicPrayerRequest, categoria: e.target.value })}
                      className="w-full rounded-lg border border-[#1E242B] bg-[#12161A] p-2 text-xs text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                    >
                      <option value="Proteção / Defesa Espiritual">Proteção / Defesa</option>
                      <option value="Saúde / Restabelecimento">Saúde / Cura</option>
                      <option value="Abertura de Caminhos / Prosperidade">Caminhos / Emprego</option>
                      <option value="Limpeza Espiritual / Descarrego">Limpeza / Cansaço</option>
                      <option value="Equilíbrio Emocional / Clamor por Paz">Paz de Espírito</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
                      Linha de Trabalho
                    </label>
                    <select
                      value={publicPrayerRequest.linha}
                      onChange={(e) => setPublicPrayerRequest({ ...publicPrayerRequest, linha: e.target.value })}
                      className="w-full rounded-lg border border-[#1E242B] bg-[#12161A] p-2 text-xs text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                    >
                      <option value="Caboclos">Caboclos (Força)</option>
                      <option value="Pretos Velhos / Almas">Pretos Velhos (Sabedoria)</option>
                      <option value="Baianos e Boiadeiros">Baianos / Boiadeiros</option>
                      <option value="Exu / Caminhos">Exu (Proteção)</option>
                      <option value="Marinheiros / Iemanjá">Marinheiros (Purificação)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
                    Firmeza Virtual - Cor da Vela
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-7">
                    {VELA_OPTIONS.map((v) => {
                      const isSelected = publicPrayerRequest.vela === v.color;
                      return (
                        <button
                          key={v.color}
                          type="button"
                          onClick={() => setPublicPrayerRequest({ ...publicPrayerRequest, vela: v.color })}
                          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-1.5 text-center transition-all ${
                            isSelected
                              ? 'border-[#FACC15] bg-[#12161A]'
                              : 'border-[#1E242B] bg-[#12161A]/40 hover:bg-[#12161A]'
                          }`}
                        >
                          <span className={`flex h-3 w-3 items-center justify-center rounded-full border shadow ${v.bg}`}>
                            {isSelected ? <Check className="h-2 w-2" /> : null}
                          </span>
                          <span className="mt-1 text-[8px] font-bold text-[#F1F5F9]">{v.color}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
                    Sua Intenção / Prece Particular
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Escreva com sinceridade suas aflições ou dificuldades... Suas palavras serão enviadas com total privacidade diretamente ao Congá da casa."
                    value={publicPrayerRequest.intencao}
                    onChange={(e) => setPublicPrayerRequest({ ...publicPrayerRequest, intencao: e.target.value })}
                    className="w-full resize-none rounded-lg border border-[#1E242B] bg-[#12161A] p-2.5 text-xs text-[#F1F5F9] placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !publicPrayerRequest.slug}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart className="h-4 w-4 animate-pulse fill-current text-rose-200" />
                  )}
                  Enviar Pedido de Reza & Acender Vela
                </button>
              </form>
            </div>

            <div className="mt-4 rounded-xl border border-rose-500/10 bg-rose-500/5 p-3 text-[10px] text-gray-400">
              🔒 <strong>Amparo Privado:</strong> Toda comunicação é criptografada e restrita estritamente ao Zelador da
              sua casa de acolhimento. Seu pedido não será divulgado publicamente no site.
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-[#1E242B] bg-[#13171D] p-6 lg:col-span-7">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E242B] pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                  <h3 className="font-display text-base font-bold text-[#F1F5F9]">Altar Virtual & Seus Pedidos Ativos</h3>
                </div>
                <span className="rounded border border-[#1E242B] bg-[#12161A] px-2 py-1 text-[10px] text-[#94A3B8]">
                  Dispositivo Autenticado
                </span>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                  Pedidos na sua corrente de fé:
                </p>
                <div className="grid max-h-[140px] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  {prayerRequests.length === 0 ? (
                    <p className="col-span-full rounded-lg border border-dashed border-[#1E242B] p-3 text-center text-[10px] text-gray-500">
                      Nenhum pedido neste dispositivo. Envie um pedido no formulário ao lado para acompanhar aqui.
                    </p>
                  ) : null}
                  {prayerRequests.map((req) => {
                    const isSelected = req.id === publicSelectedId;
                    const statusColorMap = {
                      Pendente: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
                      Aceito: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
                      'Em Oração': 'border-violet-500/30 bg-violet-500/5 text-violet-400 animate-pulse',
                    };
                    return (
                      <div
                        key={req.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPublicSelectedId(req.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setPublicSelectedId(req.id);
                        }}
                        aria-pressed={isSelected}
                        className={`cursor-pointer rounded-xl border p-2.5 transition-all ${
                          isSelected
                            ? 'border-[#FACC15] bg-[#1E2530]'
                            : 'border-[#1E242B] bg-[#12161A] hover:bg-[#1E2530]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[11px] font-bold text-[#F1F5F9]">{req.solicitante}</span>
                          <span className="text-[8px] text-gray-500">{req.data.split(' ')[0] || req.data}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-1 text-[9px]">
                          <span className="truncate text-gray-400">
                            {req.casa.replace('Terreiro ', '').replace('Centro ', '').replace('Templo ', '')}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${statusColorMap[req.status] || ''}`}>
                            {req.status === 'Em Oração' ? 'Prece Ativa' : req.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!selectedReq ? (
                <div className="rounded-2xl border border-dashed border-[#1E242B] bg-[#12161A]/50 p-8 text-center text-gray-500">
                  Nenhum pedido de oração selecionado para acompanhamento. Clique em um pedido acima ou adicione um no
                  formulário.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  <div className="relative flex h-[180px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#1E242B] bg-[#12161A] p-4 md:col-span-4">
                    <div className="absolute left-1/2 top-1.5 -translate-x-1/2 text-center text-[7.5px] font-bold uppercase tracking-wider text-gray-500">
                      Vela de Amparo
                    </div>

                    {selectedReq.vela !== 'Nenhuma' ? (
                      <div className="mt-2 flex flex-col items-center">
                        {selectedReq.status !== 'Pendente' ? (
                          <div className="relative mb-1">
                            <svg className="h-7 w-5 animate-bounce text-[#FACC15]" viewBox="0 0 20 30" fill="currentColor">
                              <path
                                d="M10 0C6 8 4 14 4 19C4 25.1 8 30 10 30C12 30 16 25.1 16 19C15.9 14 14 8 10 0Z"
                                className="animate-pulse text-amber-500"
                              />
                              <path
                                d="M10 6C8 11.3 7 15.3 7 18.7C7 22.8 9.7 26 10 26C10.3 26 13 22.8 13 18.7C13 15.3 12 11.3 10 6Z"
                                className="text-yellow-300"
                              />
                            </svg>
                            <div className="absolute left-1/2 top-1.5 h-3.5 w-3.5 -translate-x-1/2 animate-ping rounded-full bg-orange-500 opacity-75 blur-md" />
                          </div>
                        ) : (
                          <div className="mb-1 flex h-7 animate-pulse items-center justify-center text-[8px] font-black uppercase italic tracking-widest text-amber-500/50">
                            Aguardando Altar
                          </div>
                        )}

                        <div
                          className="relative h-11 w-4 rounded-sm border border-black/20 shadow-inner transition-all"
                          style={{ backgroundColor: CANDLE_COLOR_HEX[selectedReq.vela] || '#FFFFFF' }}
                        >
                          <div className="absolute left-0 top-1 h-0.5 w-full bg-black/15 opacity-40" />
                          <div className="absolute left-[5px] top-1.5 h-3 w-1 rounded bg-black/10" />
                        </div>
                        <span className="mt-2 text-[8px] font-bold uppercase text-[#F1F5F9]">Vela {selectedReq.vela}</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Heart className="mx-auto mb-1 h-5 w-5 animate-pulse text-gray-500" />
                        <span className="block text-[8px] font-bold uppercase text-gray-500">Emanações de Fé</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-[#1E242B] bg-[#12161A]/40 p-3.5 md:col-span-8">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase text-gray-500">
                          Destino: <strong className="text-[#F1F5F9]">{selectedReq.casa}</strong>
                        </span>
                        <span className="text-[#94A3B8]">{selectedReq.data}</span>
                      </div>
                      <p className="mb-1 line-clamp-3 text-xs italic leading-relaxed text-gray-300">
                        &quot;{selectedReq.intencao}&quot;
                      </p>
                    </div>

                    <div className="mt-1 space-y-1 border-t border-[#1E242B] pt-2">
                      <span className="block text-[8px] font-bold uppercase text-[#94A3B8]">Estado Litúrgico Atual:</span>
                      {selectedReq.status === 'Pendente' ? (
                        <div className="flex items-center gap-1.5 rounded border border-amber-500/10 bg-amber-500/5 p-1 text-[10px] font-bold text-amber-400">
                          <Clock className="h-3.5 w-3.5 animate-spin" />
                          <span>Enviado ao terreiro. O Zelador da casa acolherá o pedido em breve.</span>
                        </div>
                      ) : selectedReq.status === 'Aceito' ? (
                        <div className="flex items-center gap-1.5 rounded border border-emerald-500/10 bg-emerald-500/5 p-1 text-[10px] font-bold text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          <span>Vela virtual acendida no Altar Físico! Orações correndo de forma assistida.</span>
                        </div>
                      ) : (
                        <div className="flex animate-pulse items-center gap-1.5 rounded border border-violet-500/15 bg-violet-500/5 p-1 text-[10px] font-black text-violet-400">
                          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-violet-400" />
                          <span>Corrente Espiritual Ativa no terreiro! Mentalize pensamentos de cura e amparo.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedReq ? (
                <div className="flex max-h-[190px] flex-col justify-between overflow-hidden rounded-2xl border border-[#1E242B] bg-[#12161A]/85">
                  <div className="flex flex-wrap items-center justify-between gap-1 border-b border-[#1E242B] bg-[#12161A] px-3 py-1.5 text-[9px] font-black uppercase text-[#94A3B8]">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10B981]" />
                      Linha de Contato com o Altar
                    </span>
                    <span className="rounded border border-red-500/10 bg-red-950/20 px-1.5 py-0.5 text-[7.5px] font-normal uppercase text-rose-400">
                      Chat do Fiel (Privado)
                    </span>
                  </div>

                  <div className="flex min-h-[90px] max-h-[110px] flex-grow flex-col justify-end space-y-2 overflow-y-auto p-3">
                    {selectedReq.chatMessages.map((msg) => {
                      const isZelador = msg.sender === 'Zelador';
                      const isSystem = msg.isSystem || msg.sender === 'Sistema';

                      if (isSystem) {
                        return (
                          <div key={msg.id} className="my-0.5 text-center">
                            <span className="rounded-full border border-[#1E242B] bg-[#1E2530] px-1.5 py-0.5 text-[8px] text-[#FACC15]">
                              {msg.text}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex max-w-[80%] flex-col ${
                            isZelador ? 'items-start self-start' : 'items-end self-end'
                          }`}
                        >
                          <span className="mb-0.5 text-[7.5px] text-gray-500">
                            {isZelador ? 'Zelador (Terreiro)' : 'Você'} • {msg.time}
                          </span>
                          <div
                            className={`rounded-lg p-2 text-[10.5px] leading-tight ${
                              isZelador
                                ? 'rounded-tl-none border border-[#1E242B] bg-[#1E2530] text-[#F1F5F9]'
                                : 'rounded-tr-none bg-[#FBEFDB] text-[#292523]'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1.5 border-t border-[#1E242B] bg-[#12161A] p-1.5">
                    <input
                      type="text"
                      placeholder="Fale com o Zelador sobre banhos de ervas, preces ou agradecimentos..."
                      value={publicChatInput}
                      onChange={(e) => setPublicChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendPublicChatMessage();
                      }}
                      className="flex-grow rounded-md border border-[#1E242B] bg-[#12161A] px-2.5 py-1.5 text-[11px] text-[#F1F5F9] placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                    />
                    <button
                      type="button"
                      onClick={handleSendPublicChatMessage}
                      className="cursor-pointer rounded-md bg-[#10B981] px-3 py-1.5 text-[10.5px] font-bold uppercase text-white transition-all hover:bg-[#059669]"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-[#1E242B] bg-[#12161A]/60 p-2.5 text-center text-[10px] text-[#94A3B8]">
              💡 <strong>Comunicação real com o terreiro:</strong> ao enviar um pedido, o zelador recebe no painel{' '}
              <strong>Atendimentos</strong> do AxéCloud. Quando ele aceitar, iniciar a prece ou responder no chat, você
              acompanha aqui no Altar Virtual (atualização automática a cada poucos segundos). Veja também a{' '}
              <a href={`${ROUTES.home}#demonstracao`} className="font-semibold text-[#FACC15] hover:underline">
                Demo Interativa
              </a>{' '}
              na aba <strong>Pedidos de Reza</strong> para conhecer o painel do zelador.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
