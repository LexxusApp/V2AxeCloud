import { useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiJson, isApiUnreachable, setAccessToken } from "@/lib/api";
import { admin } from "@/lib/adminTheme";

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
    <div className="flex min-h-full flex-col items-center justify-center bg-black px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950">
            <span className="text-sm font-bold text-white">AC</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">AxéCloud Admin</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Acesso restrito a administradores globais do ecossistema.
          </p>
        </div>

        {session && consoleGate === "network" && (
          <div className={`mb-6 ${admin.alertError}`}>
            O proxy não consegue falar com a API na porta <strong>3000</strong>. Na raiz do AxéCloud corre{" "}
            <code className="rounded border border-neutral-700 bg-black px-1.5 py-0.5 text-sm">npm run dev:with-admin</code>.
          </div>
        )}
        {session && consoleGate === "forbidden" && (
          <div className={`mb-6 ${admin.alertInfo}`}>
            Conta com sessão AxéCloud, mas <strong>sem acesso</strong> a este painel. Define{" "}
            <code className="text-sm text-neutral-300">ADMIN_CONSOLE_EMAILS</code> ou{" "}
            <code className="text-sm text-neutral-300">is_admin_global = true</code> em{" "}
            <code className="text-sm text-neutral-300">perfil_lider</code>.
          </div>
        )}

        <form onSubmit={submit} className={`${admin.card} space-y-4 p-6`}>
          <div>
            <label className={admin.label}>E-mail</label>
            <input className={`${admin.input} mt-1`} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className={admin.label}>Senha</label>
            <input className={`${admin.input} mt-1`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <p className="text-sm text-neutral-300">{err}</p>}
          <button type="submit" disabled={loading} className={`${admin.btnPrimary} w-full`}>
            <KeyRound className="h-4 w-4" />
            {loading ? "A entrar…" : "Entrar"}
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-neutral-600">
          Dev: <span className="text-neutral-500">npm run dev:with-admin</span> — painel :5174, API :3000
        </p>
      </div>
    </div>
  );
}
