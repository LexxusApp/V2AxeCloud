import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Link2,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { marketingHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';
import { TRADICAO_OPTIONS } from '../../lib/tradicaoModules';
import { cn } from '../../lib/utils';

type PortalSettings = {
  tradicao: string;
  publicSlug: string | null;
  portalAtivo: boolean;
  portalPublicoAtivo: boolean;
  mensagem: string | null;
  cidadePublica: string | null;
  estadoPublico: string | null;
  bairroPublico: string | null;
  whatsappPublico: string | null;
  descricaoPublica: string | null;
  casaVerificada: boolean;
  visualizacoes: number;
  portalUrl: string | null;
  terreiroUrl: string | null;
  listagemPedidosUrl: string | null;
};

export function PortalConsulenteSettings() {
  const [data, setData] = useState<PortalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void authFetch('/api/v1/settings/portal-consulente')
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData({
          tradicao: json.tradicao || 'mista',
          publicSlug: json.publicSlug || '',
          portalAtivo: Boolean(json.portalAtivo),
          portalPublicoAtivo: Boolean(json.portalPublicoAtivo),
          mensagem: json.mensagem || '',
          cidadePublica: json.cidadePublica || '',
          estadoPublico: json.estadoPublico || '',
          bairroPublico: json.bairroPublico || '',
          whatsappPublico: json.whatsappPublico || '',
          descricaoPublica: json.descricaoPublica || '',
          casaVerificada: Boolean(json.casaVerificada),
          visualizacoes: Number(json.visualizacoes) || 0,
          portalUrl: json.portalUrl || null,
          terreiroUrl: json.terreiroUrl || null,
          listagemPedidosUrl: json.listagemPedidosUrl || null,
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await authFetch('/api/v1/settings/portal-consulente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradicao: data.tradicao,
          publicSlug: data.publicSlug,
          portalAtivo: data.portalAtivo,
          portalPublicoAtivo: data.portalPublicoAtivo,
          mensagem: data.mensagem,
          cidadePublica: data.cidadePublica,
          estadoPublico: data.estadoPublico,
          bairroPublico: data.bairroPublico,
          whatsappPublico: data.whatsappPublico,
          descricaoPublica: data.descricaoPublica,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao guardar');
      setData((prev) =>
        prev
          ? {
              ...prev,
              portalUrl: json.portalUrl || null,
              terreiroUrl: json.terreiroUrl || null,
              listagemPedidosUrl: json.listagemPedidosUrl || null,
              publicSlug: json.publicSlug || prev.publicSlug,
              portalPublicoAtivo: Boolean(json.portalPublicoAtivo),
            }
          : prev,
      );
      setSuccess(true);
      window.dispatchEvent(new CustomEvent('axecloud:tradicao-updated', { detail: { tradicao: data.tradicao } }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (!data?.portalUrl) return;
    const full = `${window.location.origin}${data.portalUrl}`;
    void navigator.clipboard.writeText(full);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-red-400">{error || 'Não foi possível carregar.'}</p>;
  }

  const previewUrl = data.portalUrl || (data.publicSlug ? `/consulente/${data.publicSlug}` : null);
  const listagemUrl =
    data.listagemPedidosUrl ||
    (data.portalAtivo && data.publicSlug
      ? `${ROUTES.espacoDoFiel}?casa=${encodeURIComponent(data.publicSlug)}`
      : null);
  const publicLocation =
    [data.bairroPublico, data.cidadePublica, data.estadoPublico].filter(Boolean).join(' · ') ||
    'Localização ainda não informada';
  const publicAddress = `axecloud.com.br/terreiros/${data.publicSlug || 'minha-casa'}`;

  function publicHref(path: string): string {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${marketingHref(path)}`;
  }

  return (
    <section className="portal-public-shell settings-dark-surface overflow-hidden rounded-[1.75rem] border border-[#252C35] bg-[#11151A] shadow-[0_24px_60px_-38px_rgba(0,0,0,0.95)]">
      <div className="portal-identity-hero border-b border-sky-300/15 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="portal-hero-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10">
              <Globe className="h-6 w-6 text-cyan-200" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Vitrine digital</p>
              <h3 className="mt-1 text-2xl font-black text-white">Portal público da casa</h3>
              <p className="mt-1 max-w-xl text-sm font-medium text-sky-100/65">
                Controle como sua casa será encontrada e apresentada para novos visitantes.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={cn(
              'rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wider',
              data.portalPublicoAtivo
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                : 'border-slate-500/30 bg-slate-500/10 text-slate-300',
            )}>
              Diretório {data.portalPublicoAtivo ? 'ativo' : 'oculto'}
            </span>
            <span className={cn(
              'rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wider',
              data.portalAtivo
                ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                : 'border-slate-500/30 bg-slate-500/10 text-slate-300',
            )}>
              Pedidos {data.portalAtivo ? 'ativos' : 'pausados'}
            </span>
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <div className="portal-hero-stat">
            <Eye className="h-4 w-4 text-cyan-200" />
            <div><strong>{data.visualizacoes}</strong><span>visualizações</span></div>
          </div>
          <div className="portal-hero-stat">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <div><strong>{data.casaVerificada ? 'Verificada' : 'Em análise'}</strong><span>confiança pública</span></div>
          </div>
          <div className="portal-hero-stat">
            <MapPin className="h-4 w-4 text-violet-200" />
            <div><strong>{data.cidadePublica || 'Sem cidade'}</strong><span>localização exibida</span></div>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm font-medium leading-relaxed text-sky-100/65">
          Com o portal ativo, sua casa pode aparecer no{' '}
          <a
            href={marketingHref(ROUTES.espacoDoFiel)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-cyan-200 hover:underline"
          >
            Espaço do Fiel
          </a>
          , onde visitantes encontram o terreiro e enviam pedidos de reza.
        </p>
      </div>

      <div className="portal-public-workbench grid lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-6 p-5 sm:p-7">
      <div>
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
          <Sparkles className="h-3.5 w-3.5" />
          Identidade pública
        </p>
        <h4 className="mt-1 text-lg font-black text-white">Informações da vitrine</h4>
        <p className="mt-1 text-xs text-slate-400">Edite os dados e acompanhe a prévia ao lado em tempo real.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Tradição da casa</label>
          <select
            value={data.tradicao}
            onChange={(e) => setData({ ...data, tradicao: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
          >
            {TRADICAO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-gray-600">
            Candomblé/Jurema destacam Atendimentos no menu.
          </p>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Endereço público</label>
          <div className="mt-1.5 flex items-center rounded-xl border border-white/10 bg-black/30">
            <span className="shrink-0 pl-3 text-xs text-gray-500">/terreiros/</span>
            <input
              value={data.publicSlug || ''}
              onChange={(e) =>
                setData({
                  ...data,
                  publicSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                })
              }
              placeholder="minha-casa"
              className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-sm text-white outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex-1">
            <input
              type="checkbox"
              checked={data.portalAtivo}
              onChange={(e) => setData({ ...data, portalAtivo: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 accent-primary"
            />
            <span className="text-sm font-semibold text-white">Receber pedidos de reza</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex-1">
            <input
              type="checkbox"
              checked={data.portalPublicoAtivo}
              onChange={(e) => setData({ ...data, portalPublicoAtivo: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 accent-primary"
            />
            <span className="text-sm font-semibold text-white">Exibir casa no diretório público</span>
          </label>
        </div>

        {data.portalPublicoAtivo ? (
          <>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Cidade</label>
              <input
                value={data.cidadePublica || ''}
                onChange={(e) => setData({ ...data, cidadePublica: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                placeholder="Ex: Suzano"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Estado (UF)</label>
              <input
                value={data.estadoPublico || ''}
                onChange={(e) => setData({ ...data, estadoPublico: e.target.value.toUpperCase().slice(0, 2) })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                placeholder="SP"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Bairro (opcional)</label>
              <input
                value={data.bairroPublico || ''}
                onChange={(e) => setData({ ...data, bairroPublico: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                WhatsApp público (alertas de pedidos de reza)
              </label>
              <input
                value={data.whatsappPublico || ''}
                onChange={(e) => setData({ ...data, whatsappPublico: e.target.value.replace(/\D/g, '') })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                placeholder="5511999999999"
              />
              <p className="mt-1 text-[10px] text-gray-500">
                Número que recebe alerta quando um fiel enviar pedido pelo Espaço do Fiel. Se vazio, usa notificação push
                no painel.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Descrição pública</label>
              <textarea
                rows={3}
                value={data.descricaoPublica || ''}
                onChange={(e) => setData({ ...data, descricaoPublica: e.target.value })}
                placeholder="Apresentação da casa para visitantes do portal…"
                className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-primary/40"
              />
            </div>
          </>
        ) : null}

        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Mensagem de boas-vindas</label>
          <textarea
            rows={3}
            value={data.mensagem || ''}
            onChange={(e) => setData({ ...data, mensagem: e.target.value })}
            placeholder="Orientações para quem envia pedido de reza…"
            className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-primary/40"
          />
        </div>
      </div>

      {data.portalPublicoAtivo || data.portalAtivo ? (
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary/80">Links públicos</p>
          {data.casaVerificada ? (
            <p className="text-xs text-emerald-400">Casa verificada · {data.visualizacoes} visualizações no portal</p>
          ) : (
            <p className="text-xs text-gray-500">{data.visualizacoes} visualizações no portal</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {data.terreiroUrl ? (
              <a
                href={marketingHref(data.terreiroUrl)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Perfil no diretório
              </a>
            ) : null}
            {listagemUrl ? (
              <a
                href={marketingHref(listagemUrl)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Página de Pedidos de Reza
              </a>
            ) : null}
            {previewUrl ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-300 hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Portal direto da casa
              </a>
            ) : null}
            {previewUrl ? (
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copiado!' : 'Copiar link do portal'}
              </button>
            ) : null}
          </div>
          {listagemUrl ? (
            <p className="text-[11px] text-gray-500">
              No site:{' '}
              <span className="font-mono text-gray-400">{publicHref(listagemUrl)}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-400">Configurações salvas.</p> : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className={cn(
          'portal-save-button inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#07141b]',
          saving && 'opacity-70',
        )}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar portal
      </button>
      </div>

      <aside className="portal-live-preview border-t border-white/10 p-5 lg:border-l lg:border-t-0 sm:p-6">
        <div className="sticky top-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Prévia ao vivo</p>
              <h4 className="mt-1 text-sm font-black text-white">Como o público verá</h4>
            </div>
            <span className="portal-live-dot inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              ao vivo
            </span>
          </div>

          <div className="portal-browser-card overflow-hidden rounded-[1.4rem] border border-sky-200/15 bg-[#071019] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2.5">
              <span className="h-2 w-2 rounded-full bg-rose-400/70" />
              <span className="h-2 w-2 rounded-full bg-amber-300/70" />
              <span className="h-2 w-2 rounded-full bg-emerald-300/70" />
              <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1">
                <Link2 className="h-3 w-3 shrink-0 text-cyan-300" />
                <span className="truncate text-[8px] font-semibold text-slate-400">{publicAddress}</span>
              </div>
            </div>

            <div className="portal-preview-cover relative h-28 overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#071019] to-transparent" />
              <div className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/30 backdrop-blur">
                <Globe className="h-5 w-5 text-cyan-100" />
              </div>
            </div>

            <div className="-mt-3 relative space-y-4 px-4 pb-5">
              <div className="flex flex-wrap gap-1.5">
                {data.casaVerificada ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-[8px] font-black uppercase text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> Casa verificada
                  </span>
                ) : null}
                <span className="rounded-full bg-sky-300/15 px-2 py-1 text-[8px] font-black uppercase text-sky-200">
                  {data.tradicao || 'Tradição'}
                </span>
              </div>

              <div>
                <h5 className="text-xl font-black leading-tight text-white">Sua casa de axé</h5>
                <p className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                  <MapPin className="h-3 w-3 text-cyan-300" />
                  {publicLocation}
                </p>
              </div>

              <p className="line-clamp-4 min-h-[3.8rem] text-xs leading-relaxed text-slate-300">
                {data.descricaoPublica ||
                  'Conte aqui a história da casa, sua tradição e como acolhe quem chega pela primeira vez.'}
              </p>

              <div className="grid gap-2">
                <div className={cn(
                  'rounded-xl px-3 py-2.5 text-center text-[10px] font-black',
                  data.portalAtivo ? 'bg-cyan-300 text-[#07141b]' : 'bg-white/10 text-slate-500',
                )}>
                  {data.portalAtivo ? 'Enviar pedido de reza' : 'Pedidos de reza pausados'}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-[9px] font-bold text-slate-400">
                  <span>{data.portalPublicoAtivo ? 'Publicado no diretório' : 'Não publicado'}</span>
                  <span className={data.portalPublicoAtivo ? 'text-emerald-300' : 'text-slate-600'}>
                    {data.portalPublicoAtivo ? 'VISÍVEL' : 'OCULTO'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
            A prévia muda enquanto você preenche. As alterações públicas só entram no ar depois de salvar.
          </p>
        </div>
      </aside>
      </div>
    </section>
  );
}
