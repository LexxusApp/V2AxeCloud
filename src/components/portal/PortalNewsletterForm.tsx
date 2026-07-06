import { FormEvent, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';

export function PortalNewsletterForm({ cidade, estado }: { cidade?: string; estado?: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/public/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cidade, estado }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao inscrever');
      setDone(true);
      setEmail('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao inscrever');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-xl border border-emerald-500/35 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Inscrição confirmada. Em breve enviaremos a agenda da semana na sua região.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b1813]/45" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="w-full rounded-xl border border-[var(--mockup-card-border,#cfc0a8)] bg-white py-3 pl-10 pr-4 text-sm text-[#1b1813] outline-none placeholder:text-[#1b1813]/40 focus:border-[#FFC107]/55 focus:ring-1 focus:ring-[#FFC107]/25"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex shrink-0 touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#FFC107] px-5 py-3 text-sm font-black text-[#1b1813] transition hover:bg-[#ffcd38] disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Receber agenda
      </button>
      {error ? <p className="text-sm text-red-600 sm:basis-full">{error}</p> : null}
    </form>
  );
}
