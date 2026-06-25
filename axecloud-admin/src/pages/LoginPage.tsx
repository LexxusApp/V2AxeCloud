import { useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, KeyRound, LogOut, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiJson, isApiUnreachable, postAuthAuditLog, setAccessToken } from "@/lib/api";
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
  tone: "error" | "warn";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-5 rounded-[var(--ac-radius-sm)] border px-4 py-3.5 text-sm leading-relaxed",
        tone === "error"
          ? "border-[#fecdca] bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]"
          : "border-[#fedf89] bg-[var(--ac-warn-soft)] text-[var(--ac-warn)]"
      )}
    >
      <p className="font-semibold mb-1.5">{title}</p>
      <div className="space-y-2 text-[13px] opacity-95">{children}</div>
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
      void postAuthAuditLog(
        {
          action: "auth.login_success",
          status: "success",
          details: {
            surface: "admin-console",
            email: data.session.user.email,
            userId: data.session.user.id,
          },
        },
        data.session.access_token
      );
      await onAuthed(data.session);
    } catch (e: unknown) {
      const errMsg = isApiUnreachable(e)
        ? "Não foi possível contactar a API. Verifique se o backend está online."
        : e instanceof Error
          ? e.message
          : "Falha no login";
      void postAuthAuditLog({
        action: "auth.login_failed",
        status: "failed",
        terreiroId: null,
        details: {
          surface: "admin-console",
          email: email.trim().toLowerCase(),
          message: errMsg.slice(0, 300),
        },
      });
      setErr(errMsg);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-logo">
          <div className="admin-login-logo-icon">
            <Shield className="h-6 w-6" />
          </div>
          <div className="admin-login-logo-text">
            <h1>AxéCloud Console</h1>
            <p>Administração global da plataforma</p>
          </div>
        </div>

        {session && consoleGate === "network" && (
          <Notice tone="error" title="API indisponível">
            <p>Não foi possível validar a sessão com o servidor. Tente novamente em instantes.</p>
          </Notice>
        )}

        {session && consoleGate === "forbidden" && (
          <Notice tone="warn" title="Sem permissão">
            <p>
              A conta <strong>{session.user.email}</strong> não tem perfil de administrador global.
            </p>
            <button
              type="button"
              onClick={() => void clearSession()}
              className="mt-2 inline-flex items-center gap-2 admin-btn-secondary !text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              Usar outra conta
            </button>
          </Notice>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="admin-label">E-mail</label>
            <input
              className="admin-input mt-1.5"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="admin-label">Senha</label>
            <input
              className="admin-input mt-1.5"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err && (
            <p className="rounded-[var(--ac-radius-sm)] border border-[#fecdca] bg-[var(--ac-danger-soft)] px-3 py-2.5 text-sm text-[var(--ac-danger)]">
              {err}
            </p>
          )}
          <button type="submit" disabled={loading} className="admin-btn-primary w-full !py-3 mt-2">
            {loading ? (
              "A entrar…"
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Entrar no console
                <ArrowRight className="h-4 w-4 opacity-70" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-[var(--ac-text-faint)]">
          Acesso restrito · todas as sessões são auditadas
        </p>
      </div>
    </div>
  );
}
