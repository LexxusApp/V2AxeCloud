import { FormEvent, useEffect, useMemo, useState } from 'react';
import { HandHeart, Loader2, Send } from 'lucide-react';
import { cn } from '../lib/utils';

type PortalInfo = {
  nomeTerreiro: string;
  fotoUrl?: string | null;
  tradicao?: string;
  mensagem?: string | null;
  slug?: string;
};

function slugFromPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('consulente');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '') : '';
}

export default function ConsulentePortalPage() {
  const slug = useMemo(() => slugFromPath(), []);
  const [portal, setPortal] = useState<PortalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    void fetch(`/api/v1/public/consulente/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json() as Promise<PortalInfo>;
      })
      .then((data) => {
        if (data) setPortal(data);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/public/consulente/${encodeURIComponent(slug)}/pedidos-reza`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, whatsapp, mensagem }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível enviar');
      setSuccess(json.message || 'Pedido enviado com sucesso.');
      setNome('');
      setWhatsapp('');
      setMensagem('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar pedido');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0a] text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (notFound || !portal) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 text-center">
        <p className="text-lg font-bold text-white">Portal não encontrado</p>
        <p className="mt-2 text-sm text-zinc-500">Este endereço não está activo ou a casa desactivou o acesso.</p>
        <a href="/" className="mt-6 text-sm font-bold text-primary hover:underline">
          Voltar ao AxéCloud
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <header className="text-center">
          {portal.fotoUrl ? (
            <img
              src={portal.fotoUrl}
              alt=""
              className="mx-auto h-20 w-20 rounded-full border border-primary/30 object-cover"
            />
          ) : (
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-primary/30 bg-primary/10">
              <HandHeart className="h-9 w-9 text-primary" />
            </div>
          )}
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.25em] text-primary">Portal do Consulente</p>
          <h1 className="mt-2 text-2xl font-extrabold">{portal.nomeTerreiro}</h1>
          {portal.mensagem ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{portal.mensagem}</p>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Envie seu pedido de reza ou mensagem para a casa.</p>
          )}
        </header>

        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">Seu nome</label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">WhatsApp (opcional)</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">Pedido de reza / mensagem</label>
            <textarea
              required
              rows={5}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-black',
              submitting && 'opacity-70',
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar pedido
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] text-zinc-600">
          Portal seguro ·{' '}
          <a href="/" className="text-primary/80 hover:text-primary">
            AxéCloud
          </a>
        </p>
      </div>
    </div>
  );
}
