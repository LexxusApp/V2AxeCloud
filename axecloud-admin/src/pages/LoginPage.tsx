import { useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiJson, isApiUnreachable, setAccessToken } from "@/lib/api";
type Props = {
  session: Session | null;
  consoleGate: "network" | "forbidden" | null;
  onAuthed: (s: Session) => Promise<void>;
};

export function LoginPage({ session, consoleGate, onAuthed }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (!supabase) throw new Error("Supabase não configurado");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("Sem sessão");
      setAccessToken(data.session.access_token);
      await apiJson("/api/admin-console/session");
      await onAuthed(data.session);
    } catch (e: unknown) {
      if (isApiUnreachable(e)) {
        setErr(
          "A API AxéCloud (http://localhost:3000) não está a responder. Na raiz do projecto corre npm run dev:with-admin — ou npm run dev noutro terminal enquanto o admin corre em :5174."
        );
      } else {
        setErr(e instanceof Error ? e.message : "Falha no login");
      }
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800/30 via-slate-950 to-slate-950" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-slate-700/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-slate-700/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] shadow-sm">
            <Activity className="h-6 w-6 text-slate-200" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">AxéCloud Command</h1>
          <p className="mt-2 text-[13px] text-slate-400">
            Consola administrativa paralela — acesso apenas para administradores globais.
          </p>
        </div>

        {session && consoleGate === "network" && (
          <div className="mb-6 rounded-md border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-[13px] text-rose-100">
            O proxy não consegue falar com a API na porta <strong>3000</strong>. Para desenvolvimento, na raiz do
            AxéCloud corre{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono-data text-slate-200">npm run dev:with-admin</code>{" "}
            (sobe API + este painel), ou mantém <code className="font-mono-data text-slate-200">npm run dev</code> num
            terminal e o admin noutro.
          </div>
        )}
        {session && consoleGate === "forbidden" && (
          <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100">
            Conta com sessão AxéCloud, mas <strong>sem acesso</strong> a este painel. Define{" "}
            <code className="font-mono-data text-slate-200">ADMIN_CONSOLE_EMAILS</code> com o teu e-mail ou{" "}
            <code className="font-mono-data text-slate-200">is_admin_global = true</code> em{" "}
            <code className="font-mono-data">perfil_lider</code>.
          </div>
        )}

        <form
          onSubmit={submit}
          className="rounded-md border border-white/[0.08] bg-[#0d1219]/80 p-6 shadow-lg shadow-black/40 backdrop-blur-md"
        >
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">E-mail</label>
          <input
            className="mt-1 mb-3.5 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-slate-400/30 focus:ring-2"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">Senha</label>
          <input
            className="mt-1 mb-5 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-slate-400/30 focus:ring-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {err && <p className="mb-3.5 text-[13px] text-rose-400">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-100 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {loading ? "A entrar…" : "Entrar na consola"}
          </button>
        </form>
        <p className="mt-8 text-center text-[11px] text-slate-600">
          Dev: na raiz <span className="font-mono-data text-slate-500">npm run dev:with-admin</span> — painel{" "}
          <span className="font-mono-data text-slate-500">:5174</span>, API{" "}
          <span className="font-mono-data text-slate-500">VITE_PROXY_API</span> (default :3000).
        </p>
      </div>
    </div>
  );
}
