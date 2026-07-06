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
import { cn } from '../../lib/utils';
import { espacoFielInsetClass, espacoFielPanelClass, landingMockupKickerClass } from '../landing/landingMockupUi';
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

function formatWhatsappInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidWhatsapp(digits: string): boolean {
  const d = digits.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13;
}

export function EspacoFielV3Portal() {
  const { terreiros, terreirosLoading, pedidos, submitPedido } = useEspacoFielPedidos();
  const [notification, setNotification] = useState<string | null>(null);
  const [publicPrayerRequest, setPublicPrayerRequest] = useState<PublicPrayerForm>(PUBLIC_FORM_INITIAL);
  const [publicSelectedId, setPublicSelectedId] = useState<string | null>(null);
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
    if (!isValidWhatsapp(publicPrayerRequest.whatsapp)) {
      showNotification('Informe um WhatsApp válido com DDD para receber o aviso quando o pedido for aceito.');
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
        whatsapp: publicPrayerRequest.whatsapp.replace(/\D/g, ''),
      });
      if (created?.id) setPublicSelectedId(created.id);
      setPublicPrayerRequest({
        ...PUBLIC_FORM_INITIAL,
        casa: publicPrayerRequest.casa,
        slug: publicPrayerRequest.slug,
      });
      showNotification(
        `Seu pedido foi registrado na casa "${publicPrayerRequest.casa}". Você será avisado no WhatsApp quando o zelador aceitar.`,
      );
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Erro ao enviar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {notification ? (
        <div className="fixed right-4 top-[max(1.5rem,env(safe-area-inset-top))] z-50 flex max-w-[calc(100vw-2rem)] animate-bounce items-center gap-3 rounded-xl border border-amber-400/40 bg-[#161310] px-5 py-4 text-neutral-100 shadow-2xl sm:right-6 md:right-12 md:max-w-sm">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#FACC15]" />
          <p className="text-sm font-medium">{notification}</p>
        </div>
      ) : null}

      <div
        id="portal-do-fiel"
        className="espaco-fiel-portal relative z-[1] mx-auto max-w-7xl animate-fadeIn px-4 py-12 sm:px-6 md:py-16 lg:px-8"
      >
        <div className="relative mx-auto mb-16 max-w-3xl text-center">
          <span className={cn('mb-3 inline-flex', landingMockupKickerClass)}>❤️ Espaço do Fiel & Caridade Litúrgica</span>
          <h2 className="font-display text-4xl font-black tracking-tight text-[#1b1813] md:text-5xl">
            Portal Público de Pedidos de Reza
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-light text-neutral-600 md:text-base">
            Este é o <strong className="font-semibold text-[#1b1813]">ambiente dedicado do visitante e herdeiro de fé</strong>.
            Com total privacidade e respeito, você pode selecionar uma casa de acolhimento parceira por cidade, firmar seus
            pedidos secretos de reza e sintonizar as correntes virtuais no Altar do Congá.
          </p>
        </div>

        <div className={cn('relative mb-8 overflow-hidden p-6', espacoFielPanelClass, 'rounded-3xl')}>
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-amber-400/10 blur-2xl filter" />

          <div className="mb-6 flex flex-col gap-6 border-b border-[#cfc0a8] pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
                Passo 1 • Localização da Fé
              </span>
              <h3 className="flex items-center gap-2 font-display text-xl font-extrabold text-[#1b1813]">
                <MapPin className="h-5 w-5 text-amber-600" />
                Selecione o Terreiro por Cidade
              </h3>
              <p className="mt-1 text-xs font-light text-neutral-600">
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
                        : 'border border-[#cfc0a8] bg-white text-neutral-600 hover:border-amber-400/60 hover:bg-amber-50 hover:text-[#1b1813]'
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
              <div className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-neutral-600">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
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
                  className={cn(
                    'flex cursor-pointer flex-col justify-between rounded-2xl p-4 transition-all',
                    isSelected
                      ? 'scale-[1.02] border-2 border-[#FACC15] bg-amber-50 shadow-lg shadow-[#FACC15]/10'
                      : cn(espacoFielInsetClass, 'hover:border-amber-400/55 hover:bg-amber-50/60'),
                  )}
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-1 rounded border border-[#FACC15]/10 bg-white px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-wider text-amber-500">
                        <Building2 className="h-3 w-3" /> Terreiro Parceiro
                      </span>
                      <span className="text-[10px] font-bold text-[#FACC15]">{casa.estado}</span>
                    </div>
                    <h4 className="mb-1.5 line-clamp-1 font-display text-xs font-bold text-[#1b1813]">{casa.nome}</h4>
                    <p className="mb-4 flex items-start gap-1 text-[10.5px] font-light leading-relaxed text-neutral-500">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-neutral-500" />
                      <span className="line-clamp-2">{casa.cidade}{casa.estado ? ` — ${casa.estado}` : ''}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#cfc0a8]/80 pt-3 text-[10px]">
                    <span className="font-mono italic text-neutral-500">{casa.cidade}</span>
                    <span
                      className={`font-bold uppercase tracking-wider transition-all ${
                        isSelected ? 'text-[10.5px] text-[#FACC15]' : 'text-neutral-500 hover:text-[#FACC15]'
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
            <div className="my-2 rounded-2xl border border-dashed border-[#cfc0a8] bg-[#fffdf9] p-8 text-center text-neutral-500">
              {terreiros.length === 0
                ? 'Nenhum terreiro com portal de pedidos activo no momento. As casas podem activar o portal em Configurações no app AxéCloud.'
                : 'Nenhum terreiro cadastrado nesta cidade ainda. Experimente selecionar "Todas as Cidades" ou escolher uma cidade vizinha.'}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          <div className={cn('flex flex-col justify-between p-6 lg:col-span-5', espacoFielPanelClass, 'rounded-3xl')}>
            <div>
              <div className="mb-4 flex items-center gap-2.5 border-b border-[#cfc0a8] pb-3">
                <Flame className="h-5 w-5 animate-pulse fill-amber-500/10 text-amber-600" />
                <h3 className="font-display text-base font-bold text-[#1b1813]">Formulário Oficial de Amparo</h3>
              </div>

              <form onSubmit={handleAddPublicPrayer} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                    Terreiro de Destino Selecionado
                  </label>
                  <div className="espaco-fiel-field flex items-center justify-between rounded-lg border p-3">
                    <span className="text-xs font-bold text-amber-400">
                      {publicPrayerRequest.casa || 'Selecione um terreiro acima'}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                      {publicPrayerRequest.slug ? 'Pronto' : 'Pendente'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                    Nome Completo (ou Iniciais de quem precisa)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos de Souza"
                    value={publicPrayerRequest.solicitante}
                    onChange={(e) => setPublicPrayerRequest({ ...publicPrayerRequest, solicitante: e.target.value })}
                    className="w-full rounded-lg border border-[#cfc0a8] bg-white p-2.5 text-xs text-[#1b1813] placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                      Tipo de Pedido
                    </label>
                    <select
                      value={publicPrayerRequest.categoria}
                      onChange={(e) => setPublicPrayerRequest({ ...publicPrayerRequest, categoria: e.target.value })}
                      className="w-full rounded-lg border border-[#cfc0a8] bg-white p-2 text-xs text-[#1b1813] focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                    >
                      <option value="Proteção / Defesa Espiritual">Proteção / Defesa</option>
                      <option value="Saúde / Restabelecimento">Saúde / Cura</option>
                      <option value="Abertura de Caminhos / Prosperidade">Caminhos / Emprego</option>
                      <option value="Limpeza Espiritual / Descarrego">Limpeza / Cansaço</option>
                      <option value="Equilíbrio Emocional / Clamor por Paz">Paz de Espírito</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                      Linha de Trabalho
                    </label>
                    <select
                      value={publicPrayerRequest.linha}
                      onChange={(e) => setPublicPrayerRequest({ ...publicPrayerRequest, linha: e.target.value })}
                      className="w-full rounded-lg border border-[#cfc0a8] bg-white p-2 text-xs text-[#1b1813] focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
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
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-neutral-600">
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
                              ? 'border-[#FACC15] bg-white'
                              : 'border-[#cfc0a8] bg-amber-50/40 hover:bg-amber-50'
                          }`}
                        >
                          <span className={`flex h-3 w-3 items-center justify-center rounded-full border shadow ${v.bg}`}>
                            {isSelected ? <Check className="h-2 w-2" /> : null}
                          </span>
                          <span className="mt-1 text-[8px] font-bold text-[#1b1813]">{v.color}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                    Seu WhatsApp (obrigatório)
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="(11) 99999-9999"
                    value={publicPrayerRequest.whatsapp}
                    onChange={(e) =>
                      setPublicPrayerRequest({
                        ...publicPrayerRequest,
                        whatsapp: formatWhatsappInput(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-[#cfc0a8] bg-white p-2.5 text-xs text-[#1b1813] placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                  />
                  <p className="mt-1 text-[9px] text-neutral-500">
                    Usado somente para avisar quando o zelador aceitar seu pedido.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                    Sua Intenção / Prece Particular
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Escreva com sinceridade suas aflições ou dificuldades... Suas palavras serão enviadas com total privacidade diretamente ao Congá da casa."
                    value={publicPrayerRequest.intencao}
                    onChange={(e) => setPublicPrayerRequest({ ...publicPrayerRequest, intencao: e.target.value })}
                    className="w-full resize-none rounded-lg border border-[#cfc0a8] bg-white p-2.5 text-xs text-[#1b1813] placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !publicPrayerRequest.slug}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-xs font-bold uppercase tracking-wider text-neutral-900 shadow-md transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart className="h-4 w-4 animate-pulse fill-current text-neutral-900/30" />
                  )}
                  Enviar Pedido de Reza & Acender Vela
                </button>
              </form>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] text-neutral-600">
              🔒 <strong>Amparo Privado:</strong> Seu pedido é restrito ao zelador da casa. Você receberá aviso no
              WhatsApp quando o pedido for aceito — não há chat no site.
            </div>
          </div>

          <div className={cn('flex flex-col justify-between p-6 lg:col-span-7', espacoFielPanelClass, 'rounded-3xl')}>
            <div className="space-y-4">
              <div className="flex flex-col gap-2 border-b border-[#cfc0a8] pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 animate-ping rounded-full bg-amber-400" />
                  <h3 className="font-display text-base font-bold leading-snug text-[#1b1813]">
                    Altar Virtual & Seus Pedidos Ativos
                  </h3>
                </div>
                <span className="w-max shrink-0 self-start rounded border border-[#cfc0a8] bg-white px-2 py-1 text-[10px] text-neutral-600 sm:self-auto">
                  Dispositivo Autenticado
                </span>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                  Pedidos na sua corrente de fé:
                </p>
                <div className="grid max-h-[140px] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  {prayerRequests.length === 0 ? (
                    <p className="col-span-full rounded-lg border border-dashed border-[#cfc0a8] bg-[#fffdf9] p-3 text-center text-[10px] text-neutral-500">
                      Nenhum pedido neste dispositivo. Envie um pedido no formulário ao lado para acompanhar aqui.
                    </p>
                  ) : null}
                  {prayerRequests.map((req) => {
                    const isSelected = req.id === publicSelectedId;
                    const statusColorMap = {
                      Pendente: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
                      Aceito: 'border-amber-400/30 bg-amber-50 text-amber-700',
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
                        className={cn(
                          'cursor-pointer rounded-xl border p-2.5 transition-all',
                          isSelected
                            ? 'border-2 border-[#FACC15] bg-amber-50 shadow-sm'
                            : cn(espacoFielInsetClass, 'hover:border-amber-400/50 hover:bg-amber-50/70'),
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[11px] font-bold text-[#1b1813]">{req.solicitante}</span>
                          <span className="text-[8px] text-neutral-500">{req.data.split(' ')[0] || req.data}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-1 text-[9px]">
                          <span className="truncate text-neutral-500">
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
                <div className={cn('rounded-2xl border border-dashed border-[#cfc0a8] bg-[#fffdf9] p-8 text-center text-neutral-500', espacoFielInsetClass)}>
                  Nenhum pedido de oração selecionado para acompanhamento. Clique em um pedido acima ou adicione um no
                  formulário.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  <div className={cn('relative flex h-[180px] flex-col items-center justify-center overflow-hidden rounded-2xl p-4 md:col-span-4', espacoFielInsetClass)}>
                    <div className="absolute left-1/2 top-1.5 -translate-x-1/2 text-center text-[7.5px] font-bold uppercase tracking-wider text-neutral-500">
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
                        <span className="mt-2 text-[8px] font-bold uppercase text-[#1b1813]">Vela {selectedReq.vela}</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Heart className="mx-auto mb-1 h-5 w-5 animate-pulse text-neutral-500" />
                        <span className="block text-[8px] font-bold uppercase text-neutral-500">Emanações de Fé</span>
                      </div>
                    )}
                  </div>

                  <div className={cn('flex flex-col justify-between rounded-2xl p-3.5 md:col-span-8', espacoFielInsetClass, 'bg-amber-50/80')}>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase text-neutral-500">
                          Destino: <strong className="text-[#1b1813]">{selectedReq.casa}</strong>
                        </span>
                        <span className="text-neutral-600">{selectedReq.data}</span>
                      </div>
                      <p className="mb-1 line-clamp-3 text-xs italic leading-relaxed text-[#1b1813]/65">
                        &quot;{selectedReq.intencao}&quot;
                      </p>
                    </div>

                    <div className="mt-1 space-y-1 border-t border-[#cfc0a8] pt-2">
                      <span className="block text-[8px] font-bold uppercase text-neutral-600">Estado Litúrgico Atual:</span>
                      {selectedReq.status === 'Pendente' ? (
                        <div className="flex items-center gap-1.5 rounded border border-amber-500/10 bg-amber-500/5 p-1 text-[10px] font-bold text-amber-400">
                          <Clock className="h-3.5 w-3.5 animate-spin" />
                          <span>Enviado ao terreiro. O Zelador da casa acolherá o pedido em breve.</span>
                        </div>
                      ) : selectedReq.status === 'Aceito' ? (
                        <div className="flex items-center gap-1.5 rounded border border-amber-300/40 bg-amber-50 p-1 text-[10px] font-bold text-amber-700">
                          <Check className="h-3.5 w-3.5" />
                          <span>Pedido aceito! A reza será realizada na próxima gira. Confira seu WhatsApp.</span>
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

            </div>

            <div className="mt-4 rounded-xl border border-dashed border-[#cfc0a8] bg-amber-50/70 p-2.5 text-center text-[10px] text-neutral-600">
              💡 <strong>Como funciona:</strong> ao enviar o pedido, o zelador recebe alerta no WhatsApp ou no painel{' '}
              <strong>Atendimentos</strong> do AxéCloud. Quando ele aceitar, você recebe mensagem no WhatsApp informando
              que a reza será na próxima gira. Acompanhe o status aqui no Altar Virtual. Veja a{' '}
              <a href={`${ROUTES.home}#demonstracao`} className="font-semibold text-[#FACC15] hover:underline">
                Demo Interativa
              </a>{' '}
              na aba <strong>Pedidos de Reza</strong>.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
