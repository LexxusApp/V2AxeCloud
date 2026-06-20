import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, UserCheck, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

type CheckinInfo = {
  eventId: string;
  titulo: string;
  data: string;
  hora: string;
  tipo: string;
  terreiroName: string;
};

function parseCheckinPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('checkin');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '').trim() : '';
}

export default function GiraCheckInPage() {
  const token = parseCheckinPath();
  const [info, setInfo] = useState<CheckinInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [result, setResult] = useState<{ nome: string; eventTitle: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Link inválido.');
      setLoading(false);
      return;
    }
    void fetch(`/api/v1/public/checkin/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'QR inválido');
        setInfo(json);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/public/checkin/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: cpf.replace(/\D/g, ''),
          telefone: telefone.replace(/\D/g, ''),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível registrar presença');
      setResult({ nome: json.nome, eventTitle: json.eventTitle });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro no check-in');
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

  if (result) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#080A0D] px-4">
        <div className="max-w-md rounded-2xl border border-emerald-500/30 bg-[#13171D] p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-4 text-xl font-black text-white">Presença registrada!</h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            <span className="font-semibold text-white">{result.nome}</span> — {result.eventTitle}
          </p>
          <p className="mt-4 text-xs text-primary">Axé!</p>
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
          <div className="rounded-2xl border border-[#1E242B] bg-[#13171D] p-6 shadow-xl">
            <div className="mb-6 text-center">
              <UserCheck className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                {info.terreiroName}
              </p>
              <h1 className="mt-1 text-lg font-black text-white">{info.titulo}</h1>
              <p className="text-sm text-[#94A3B8]">
                {info.data} · {info.hora} · {info.tipo}
              </p>
            </div>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">CPF cadastrado</label>
                <input
                  className="mt-1 w-full rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2.5 text-sm text-white"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                />
              </div>
              <p className="text-center text-[10px] text-gray-600">ou</p>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Telefone / WhatsApp</label>
                <input
                  className="mt-1 w-full rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2.5 text-sm text-white"
                  placeholder="11999999999"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </div>
              {error ? <p className="text-xs text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting || (!cpf.trim() && !telefone.trim())}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-[#080A0D]',
                  submitting && 'opacity-70',
                )}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar presença'}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
