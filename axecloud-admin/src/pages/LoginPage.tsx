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
        "mb-6 rounded-[var(--ac-radius-sm)] border px-4 py-3.5 text-sm leading-relaxed",
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
    <div className="admin-login-shell">
      <aside className="admin-login-brand">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--ac-radius)] bg-white/10 text-white">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight leading-tight">
            AxéCloud
            <br />
            <span className="text-[#d0d5dd]">Console</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#98a2b3]">
            Centro de comando para administradores globais — terreiros, assinaturas, auditoria e
            infraestrutura num só lugar.
          </p>
        </div>
        <p className="text-[11px] text-[#667085]">Acesso restrito · sessão auditável</p>
      </aside>

      <div className="admin-login-form-wrap">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--ac-radius-sm)] bg-[var(--ac-accent)] text-white">
              <Shield className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--ac-text)]">
              Entrar no console
            </h2>
            <p className="mt-1 text-sm text-[var(--ac-text-muted)]">Administradores globais</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--ac-text)]">
              Entrar no console
            </h2>
            <p className="mt-1 text-sm text-[var(--ac-text-muted)]">
              Use as credenciais de administrador global
            </p>
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

          <form
            onSubmit={submit}
            className="rounded-[var(--ac-radius)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-surface)] p-6 sm:p-8 shadow-[var(--ac-shadow)] space-y-5"
          >
            <div>
              <label className="admin-label">E-mail</label>
              <input
                className="admin-input mt-2"
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
                className="admin-input mt-2"
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
            <button type="submit" disabled={loading} className="admin-btn-primary w-full !py-3.5">
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
        </div>
      </div>
    </div>
  );
}
