import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Ticket, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

type SenhaInfo = {
  eventId: string;
  titulo: string;
  data: string;
  hora: string;
  terreiroName: string;
  senhasEmitidas: number;
};

function parseSenhasPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('senhas');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '').trim() : '';
}

export default function GiraSenhasPublicPage() {
  const token = parseSenhasPath();
  const [info, setInfo] = useState<SenhaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [senha, setSenha] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Link inválido.');
      setLoading(false);
      return;
    }
    void fetch(`/api/v1/public/senhas/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Indisponível');
        if (typeof json.eventoPageUrl === 'string' && json.eventoPageUrl) {
          window.location.replace(json.eventoPageUrl);
          return;
        }
        setInfo(json);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleEmitir(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !nome.trim() || !telefone.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/public/senhas/${encodeURIComponent(token)}/emitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), telefone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao emitir senha');
      setSenha(json.senha);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#080A0D]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (senha != null && info) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#080A0D] px-4">
        <div className="max-w-md rounded-2xl border border-primary/40 bg-[#13171D] p-8 text-center shadow-[0_0_40px_rgba(251,188,0,0.12)]">
          <Ticket className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
            {info.terreiroName}
          </p>
          <p className="text-sm text-[#94A3B8]">{info.titulo}</p>
          <p className="mt-6 text-6xl font-black tabular-nums text-primary">{senha}</p>
          <p className="mt-2 text-lg font-bold text-white">{nome}</p>
          <p className="mt-4 text-xs text-[#64748B]">
            Enviamos sua senha e o link de check-in no WhatsApp. Na portaria, abra o link e aponte para o QR do
            terreiro.
          </p>
          <CheckCircle2 className="mx-auto mt-6 h-8 w-8 text-emerald-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#080A0D] px-4 py-10">
      <div className="mx-auto max-w-md">
        {error && !info ? (
          <div className="rounded-2xl border border-red-500/30 bg-[#13171D] p-6 text-center">
            <XCircle className="mx-auto h-10 w-10 text-red-400" />
            <p className="mt-3 text-sm text-red-300">{error}</p>
          </div>
        ) : info ? (
          <div className="rounded-2xl border border-[#1E242B] bg-[#13171D] p-6">
            <div className="mb-6 text-center">
              <Ticket className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                {info.terreiroName}
              </p>
              <h1 className="mt-1 text-lg font-black text-white">{info.titulo}</h1>
              <p className="text-sm text-[#94A3B8]">
                {info.data} · {info.hora}
              </p>
              <p className="mt-1 text-[10px] text-gray-600">{info.senhasEmitidas} senhas já emitidas</p>
            </div>
            <form onSubmit={(e) => void handleEmitir(e)} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Seu nome</label>
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2.5 text-sm text-white"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">WhatsApp</label>
                <input
                  required
                  type="tel"
                  className="mt-1 w-full rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2.5 text-sm text-white"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              {error ? <p className="text-xs text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting || !nome.trim() || !telefone.trim()}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-[#080A0D]',
                  submitting && 'opacity-70',
                )}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Emitir minha senha'}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
