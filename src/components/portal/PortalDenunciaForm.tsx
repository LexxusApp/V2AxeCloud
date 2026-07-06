import { FormEvent, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';

export function PortalDenunciaForm({ slug }: { slug?: string }) {
  const [motivo, setMotivo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/public/denuncias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo, detalhe, email, slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar');
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-[#94A3B8]">
        Denúncia registada. A equipa AxéCloud analisará o conteúdo em conformidade com as nossas políticas.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-[#94A3B8]">
        <Flag className="h-4 w-4" />
        Reportar conteúdo inadequado
      </div>
      <input
        required
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo resumido"
        className="w-full rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-2.5 text-sm text-white outline-none"
      />
      <textarea
        rows={2}
        value={detalhe}
        onChange={(e) => setDetalhe(e.target.value)}
        placeholder="Detalhes (opcional)"
        className="w-full resize-none rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-2.5 text-sm text-white outline-none"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Seu e-mail (opcional, para retorno)"
        className="w-full rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-2.5 text-sm text-white outline-none"
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl border border-[#1E242B] px-4 py-2 text-xs font-bold text-[#94A3B8] hover:border-red-500/40 hover:text-red-400 disabled:opacity-60"
      >
        {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Enviar denúncia'}
      </button>
    </form>
  );
}
