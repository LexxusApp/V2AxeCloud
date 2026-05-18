import { useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { KeyRound, LogOut, ServerCrash } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiJson, isApiUnreachable, setAccessToken } from "@/lib/api";
import { cn } from "@/lib/cn";

type Props = {
  session: Session | null;
  consoleGate: "network" | "forbidden" | null;
  onAuthed: (s: Session) => Promise<void>;
};

function Notice({
  tone,
  title,
  children,
}: {
  tone: "error" | "warn" | "info";
  title: string;
  children: ReactNode;
}) {
  const tones = {
    error: "border-red-500/30 bg-red-500/10 text-red-100",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-50",
    info: "border-yellow-500/25 bg-yellow-500/10 text-zinc-200",
  };
  return (
    <div className={cn("mb-6 rounded-2xl border px-4 py-4 text-sm leading-relaxed", tones[tone])}>
      <p className="font-semibold text-white mb-2">{title}</p>
      <div className="space-y-2 text-[13px]">{children}</div>
    </div>
  );
}

export function LoginPage({ session, consoleGate, onAuthed }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function clearSession() {
    setAccessToken(null);
    setErr(null);
    await supabase?.auth.signOut();
    window.location.reload();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (!supabase) throw new Error("Supabase não configurado no .env do admin.");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("Sem sessão após login.");
      setAccessToken(data.session.access_token);
      await apiJson("/api/admin-console/session");
      await onAuthed(data.session);
    } catch (e: unknown) {
      if (isApiUnreachable(e)) {
        setErr(
          "A API local (porta 3000) não está a correr. Na pasta raiz do AxéCloud execute: npm run dev:with-admin — isso sobe a API e o painel juntos."
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
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10 shadow-lg shadow-yellow-500/20">
            <div className="h-7 w-7 rounded-full bg-yellow-500" />
          </div>
          <h1 className="text-3xl font-black tracking-wide">
            AXÉ<span className="text-yellow-500">CLOUD</span>
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-zinc-500">Painel Admin</p>
          <p className="mt-4 text-sm text-zinc-400">Acesso restrito a administradores globais.</p>
        </div>

        {session && consoleGate === "network" && (
          <Notice tone="error" title="API offline">
            <p>
              O Vite (:5174) não consegue ligar ao backend em <strong className="text-white">localhost:3000</strong>.
            </p>
            <p className="text-zinc-300">
              Na <strong className="text-white">raiz</strong> do projecto (não dentro de{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-yellow-400/90">axecloud-admin</code>):
            </p>
            <code className="block rounded-xl bg-black/50 border border-zinc-800 px-3 py-2 text-yellow-400">
              npm run dev:with-admin
            </code>
          </Notice>
        )}

        {session && consoleGate === "forbidden" && (
          <Notice tone="warn" title="Sem permissão neste painel">
            <p>
              A conta <strong className="text-white">{session.user.email}</strong> tem sessão no Supabase, mas não é
              admin global.
            </p>
            <p>No <code className="text-yellow-400/90">.env</code> da raiz do AxéCloud, adicione o e-mail:</p>
            <code className="block rounded-xl bg-black/50 border border-zinc-800 px-3 py-2 text-yellow-400 break-all">
              ADMIN_CONSOLE_EMAILS={session.user.email}
            </code>
            <p className="text-zinc-400">
              Reinicie o servidor (<code className="text-zinc-300">npm run dev:with-admin</code>) ou defina{" "}
              <code className="text-zinc-300">is_admin_global = true</code> em{" "}
              <code className="text-zinc-300">perfil_lider</code>.
            </p>
            <button
              type="button"
              onClick={() => void clearSession()}
              className="mt-2 inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold hover:border-yellow-500/40"
            >
              <LogOut className="h-3.5 w-3.5" />
              Terminar sessão e usar outra conta
            </button>
          </Notice>
        )}

        {!session && (
          <Notice tone="info" title="Desenvolvimento local">
            <p className="flex items-start gap-2">
              <ServerCrash className="h-4 w-4 shrink-0 mt-0.5 text-yellow-500" />
              <span>
                Só o Vite do admin não basta — a API Express precisa estar activa na porta{" "}
                <strong className="text-white">3000</strong>.
              </span>
            </p>
            <code className="block rounded-xl bg-black/50 border border-zinc-800 px-3 py-2 text-yellow-400">
              cd .. && npm run dev:with-admin
            </code>
          </Notice>
        )}

        <form
          onSubmit={submit}
          className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6 sm:p-8 space-y-5 shadow-xl shadow-black/40"
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">E-mail</label>
            <input
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-white outline-none focus:border-yellow-500 transition"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Senha</label>
            <input
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-white outline-none focus:border-yellow-500 transition"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{err}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-400 py-4 font-bold text-black shadow-lg shadow-yellow-500/25 hover:brightness-105 disabled:opacity-60 transition"
          >
            <KeyRound className="h-5 w-5" />
            {loading ? "A entrar…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
