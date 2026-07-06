import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, QrCode } from 'lucide-react';

function parsePortariaPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('checkin-portaria');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '').trim() : '';
}

export default function CheckinPortariaKioskPage() {
  const token = parsePortariaPath();
  const [info, setInfo] = useState<{
    titulo: string;
    data: string;
    hora: string;
    terreiroName: string;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('QR inválido.');
      setLoading(false);
      return;
    }
    void fetch(`/api/v1/public/checkin-portaria/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Indisponível');
        setInfo({
          titulo: json.titulo,
          data: json.data,
          hora: json.hora,
          terreiroName: json.terreiroName,
        });
        const url = `${window.location.origin}/checkin-portaria/${encodeURIComponent(token)}`;
        return QRCode.toDataURL(url, { width: 420, margin: 2, color: { dark: '#080A0D', light: '#FFFFFF' } });
      })
      .then((dataUrl) => {
        if (dataUrl) setQrDataUrl(dataUrl);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#080A0D]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#080A0D] px-4 text-center">
        <p className="text-sm text-red-400">{error || 'QR inválido.'}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#080A0D] px-6 py-10 text-center">
      <QrCode className="h-10 w-10 text-primary" />
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">{info.terreiroName}</p>
      <h1 className="mt-2 max-w-lg text-2xl font-black text-white sm:text-3xl">{info.titulo}</h1>
      <p className="mt-2 text-sm text-[#94A3B8]">
        {info.data} · {info.hora}
      </p>
      <p className="mt-6 max-w-sm text-sm text-[#64748B]">
        Visitantes: abra o link do WhatsApp e aponte a câmera para este QR Code.
      </p>
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="QR Code check-in visitantes"
          className="mt-8 rounded-2xl border-4 border-white/10 bg-white p-4 shadow-[0_0_60px_rgba(251,188,0,0.15)]"
        />
      ) : null}
    </div>
  );
}
