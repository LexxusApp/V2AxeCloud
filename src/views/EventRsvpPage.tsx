import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Heart, Loader2, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

type RsvpPayload = {
  success: boolean;
  status: 'Confirmado' | 'Recusado';
  alreadyResponded?: boolean;
  guestName: string;
  eventTitle: string;
  eventDate: string | null;
  eventTime: string | null;
  terreiroName: string;
};

function parseConvitePath(): { token: string; action: 'confirmar' | 'declinar' } | null {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('convite');
  if (idx < 0) return null;
  const token = decodeURIComponent(parts[idx + 1] || '').trim();
  const rawAction = decodeURIComponent(parts[idx + 2] || '').trim().toLowerCase();
  if (!token) return null;
  if (rawAction !== 'confirmar' && rawAction !== 'declinar') return null;
  return { token, action: rawAction };
}

function formatEventDate(ymd: string | null): string | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export default function EventRsvpPage() {
  const parsed = useMemo(() => parseConvitePath(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RsvpPayload | null>(null);

  useEffect(() => {
    if (!parsed) {
      setError('Link de convite inválido.');
      setLoading(false);
      return;
    }

    const { token, action } = parsed;
    void fetch(`/api/v1/public/convite/rsvp/${encodeURIComponent(token)}/${action}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((body as { error?: string }).error || 'Não foi possível registrar sua resposta.');
        }
        return body as RsvpPayload;
      })
      .then((payload) => setData(payload))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao processar convite.');
      })
      .finally(() => setLoading(false));
  }, [parsed]);

  const isConfirm = parsed?.action === 'confirmar';
  const eventDateLabel = formatEventDate(data?.eventDate ?? null);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141414] p-8 shadow-2xl text-center space-y-6">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-zinc-400">Registrando sua resposta...</p>
          </div>
        ) : error ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-black">Não foi possível concluir</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">{error}</p>
          </>
        ) : data ? (
          <>
            <div
              className={cn(
                'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
                isConfirm ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
              )}
            >
              {isConfirm ? <CheckCircle2 className="h-8 w-8" /> : <Heart className="h-8 w-8" />}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight">
                {isConfirm ? 'Presença confirmada!' : 'Resposta registrada'}
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {isConfirm ? (
                  <>
                    Obrigado, <span className="text-white font-semibold">{data.guestName}</span>. Sua presença no
                    evento <span className="text-white font-semibold">{data.eventTitle}</span> foi confirmada.
                  </>
                ) : (
                  <>
                    Obrigado por avisar, <span className="text-white font-semibold">{data.guestName}</span>. Registramos
                    que você não poderá comparecer ao evento{' '}
                    <span className="text-white font-semibold">{data.eventTitle}</span>.
                  </>
                )}
              </p>
              {data.alreadyResponded && (
                <p className="text-xs text-zinc-500">Sua resposta já estava registrada — atualizamos conforme este link.</p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Detalhes</p>
              <p className="text-sm font-bold text-white">{data.eventTitle}</p>
              <p className="text-xs text-zinc-400">
                {eventDateLabel}
                {data.eventTime ? ` · ${data.eventTime}` : ''}
              </p>
              <p className="text-xs text-primary font-semibold">{data.terreiroName}</p>
            </div>
            {isConfirm ? (
              <p className="text-xs text-emerald-400/90 font-medium">Axé! Te esperamos com muita luz. 🙏</p>
            ) : (
              <p className="text-xs text-zinc-500 font-medium">Que os Orixás te protejam. Até uma próxima oportunidade.</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
