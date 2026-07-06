import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

function parseCheckinPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('checkin');
  return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '').trim() : '';
}

/** Legado: redireciona para a página kiosk da portaria. */
export default function GiraCheckInPage() {
  const token = parseCheckinPath();

  useEffect(() => {
    if (!token) return;
    const target = `/checkin-portaria/${encodeURIComponent(token)}`;
    window.location.replace(target);
  }, [token]);

  return (
    <div className="grid min-h-dvh place-items-center bg-[#080A0D]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
