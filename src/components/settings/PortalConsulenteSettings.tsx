import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Globe, Loader2, Save } from 'lucide-react';
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

  function publicHref(path: string): string {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${marketingHref(path)}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-white">
          <Globe className="h-5 w-5 text-primary" />
          Tradição e portal do consulente
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Com o portal activo, a sua casa aparece no{' '}
          <a
            href={marketingHref(ROUTES.espacoDoFiel)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Espaço do Fiel — Pedidos de Reza
          </a>
          , onde consulentes escolhem o terreiro e enviam pedidos com altar virtual.
        </p>
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
            <span className="text-sm font-semibold text-white">Pedidos de reza activos</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex-1">
            <input
              type="checkbox"
              checked={data.portalPublicoAtivo}
              onChange={(e) => setData({ ...data, portalPublicoAtivo: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 accent-primary"
            />
            <span className="text-sm font-semibold text-white">Perfil no diretório /terreiros</span>
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
                Portal directo da casa
              </a>
            ) : null}
            {previewUrl ? (
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copiado!' : 'Copiar portal directo'}
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
      {success ? <p className="text-sm text-emerald-400">Configurações guardadas.</p> : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-black',
          saving && 'opacity-70',
        )}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar portal
      </button>
    </div>
  );
}
