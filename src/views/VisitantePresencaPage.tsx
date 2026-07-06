import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, QrCode, XCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

type PresencaInfo = {
  senha: number;
  nome: string;
  checkedIn: boolean;
  eventTitle: string;
  data: string;
  hora: string;
  terreiroName: string;
};

function parsePresencaPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('presenca');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '').trim() : '';
}

function extractVenueToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.replace(/\/+$/, '').split('/');
    const idx = parts.indexOf('checkin-portaria');
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
    const legacyIdx = parts.indexOf('checkin');
    if (legacyIdx >= 0 && parts[legacyIdx + 1]) return decodeURIComponent(parts[legacyIdx + 1]);
  } catch {
    /* raw token */
  }
  return trimmed;
}

export default function VisitantePresencaPage() {
  const token = parsePresencaPath();
  const [info, setInfo] = useState<PresencaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ senha: number; nome: string; eventTitle: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Link inválido.');
      setLoading(false);
      return;
    }
    void fetch(`/api/v1/public/presenca/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Indisponível');
        setInfo(json);
        if (json.checkedIn) {
          setResult({ senha: json.senha, nome: json.nome, eventTitle: json.eventTitle });
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (loading || error || result || !info || info.checkedIn || startedRef.current) return;
    startedRef.current = true;

    const scannerId = 'visitante-qr-scanner';
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;
    setScanning(true);

    void scanner
      .start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          void confirmarPresenca(decoded);
        },
        () => {
          /* ignore scan misses */
        },
      )
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Não foi possível abrir a câmera.');
        setScanning(false);
      });

    return () => {
      void scanner.stop().catch(() => undefined);
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start scanner once when info loads
  }, [loading, error, result, info]);

  async function confirmarPresenca(rawQr: string) {
    if (!token || submitting || result) return;
    const venueToken = extractVenueToken(rawQr);
    if (!venueToken) return;

    setSubmitting(true);
    setError(null);
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => undefined);
        setScanning(false);
      }

      const res = await fetch(`/api/v1/public/presenca/${encodeURIComponent(token)}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível confirmar presença');
      setResult({ senha: json.senha, nome: json.nome, eventTitle: json.eventTitle });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro no check-in');
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
          <h1 className="mt-4 text-xl font-black text-white">Presença confirmada!</h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            <span className="font-semibold text-white">{result.nome}</span> — senha{' '}
            <span className="font-black text-primary">#{result.senha}</span>
          </p>
          <p className="mt-1 text-xs text-[#64748B]">{result.eventTitle}</p>
          <p className="mt-4 text-xs text-primary">Axé!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#080A0D] px-4 py-8">
      <div className="mx-auto max-w-md">
        {error && !info ? (
          <div className="rounded-2xl border border-red-500/30 bg-[#13171D] p-6 text-center">
            <XCircle className="mx-auto h-10 w-10 text-red-400" />
            <p className="mt-3 text-sm text-red-300">{error}</p>
          </div>
        ) : info ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 text-center">
              <QrCode className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                {info.terreiroName}
              </p>
              <h1 className="mt-1 text-lg font-black text-white">{info.eventTitle}</h1>
              <p className="text-sm text-[#94A3B8]">
                Senha <span className="font-black text-primary">#{info.senha}</span> · {info.nome}
              </p>
              <p className="mt-3 text-xs text-[#64748B]">
                Aponte a câmera para o QR Code na portaria do terreiro.
              </p>
            </div>

            {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}

            <div
              id="visitante-qr-scanner"
              className="overflow-hidden rounded-2xl border border-[#1E242B] bg-black"
            />

            {scanning ? (
              <p className="text-center text-xs text-[#64748B]">
                {submitting ? 'Confirmando presença…' : 'Aguardando leitura do QR…'}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
