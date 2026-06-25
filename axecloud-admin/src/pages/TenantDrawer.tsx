import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  Copy,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type TenantDetail = {
  profile: {
    id: string;
    tenant_id?: string | null;
    email: string | null;
    nome_terreiro: string | null;
    cargo: string | null;
    role: string | null;
    is_admin_global: boolean | null;
    is_blocked: boolean | null;
    deleted_at: string | null;
    foto_url: string | null;
    updated_at: string | null;
  } | null;
  auth: {
    id: string;
    email: string;
    phone: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
    user_metadata: Record<string, unknown>;
  } | null;
  subscription: {
    plan: string | null;
    status: string | null;
    expires_at: string | null;
  } | null;
  childrenCount: number;
  storage: {
    configured: boolean;
    objects?: number;
    bytes?: number;
    mb?: number;
    truncated?: boolean;
  };
};

interface TenantDrawerProps {
  tenantId: string | null;
  onClose: () => void;
}

function bytesToHuman(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function TenantDrawer({ tenantId, onClose }: TenantDrawerProps) {
  const [data, setData] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [pwdVisible, setPwdVisible] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);

  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const j = await apiJson<TenantDetail>(`/api/admin-console/tenant/${id}`);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar terreiro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tenantId) {
      setData(null);
      setNewPassword(null);
      setPwdVisible(false);
      setError(null);
      return;
    }
    void fetchData(tenantId);
  }, [tenantId, fetchData]);

  // ESC fecha o drawer
  useEffect(() => {
    if (!tenantId) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tenantId, onClose]);

  async function copyValue(text: string, tag: string) {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(tag);
      window.setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1500);
    } catch {
      /* clipboard pode estar bloqueado; ignorar */
    }
  }

  async function setRole(role: "admin" | "filho") {
    if (!tenantId) return;
    const current = String(data?.profile?.role || "").toLowerCase();
    if (current === role) return;
    if (!confirm(`Definir o papel deste terreiro como "${role}"?`)) return;
    setRoleBusy(true);
    setError(null);
    try {
      await apiJson(`/api/admin-console/tenant/${tenantId}/set-role`, {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      await fetchData(tenantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar papel");
    } finally {
      setRoleBusy(false);
    }
  }

  async function resetPassword() {
    if (!tenantId) return;
    if (!confirm("Gerar uma nova senha para este terreiro? A senha atual deixará de funcionar.")) return;
    setResetting(true);
    setError(null);
    try {
      const j = await apiJson<{ password: string }>(`/api/admin-console/tenant/${tenantId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNewPassword(j.password);
      setPwdVisible(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao redefinir senha");
    } finally {
      setResetting(false);
    }
  }

  if (!tenantId) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="flex-1 bg-[rgba(16,24,40,0.4)] backdrop-blur-sm"
      />
      {/* Drawer */}
      <aside className="admin-drawer">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--ac-paper-border)] bg-[var(--ac-paper-surface)] px-5 py-4">
          <div className="min-w-0">
            <p className="admin-label">Terreiro</p>
            <h3 className="mt-0.5 truncate text-lg font-bold text-[var(--ac-text)]">
              {data?.profile?.nome_terreiro || (loading ? "A carregar…" : "Sem nome")}
            </h3>
            {data?.profile?.email && (
              <p className="truncate admin-mono text-[11px] text-[var(--ac-text-muted)]">{data.profile.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="admin-btn-secondary shrink-0 !p-1.5"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="admin-alert-info flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--ac-text-muted)]" /> A carregar dados…
            </div>
          )}

          {error && (
            <div className="admin-alert-error text-sm">{error}</div>
          )}

          {data && (
            <>
              <Section title="Identificação" icon={Building2}>
                <Row label="ID" value={data.profile?.id || "—"} copyable mono onCopy={copyValue} copied={copied} tag="id" />
                <Row
                  label="Tenant ID"
                  value={data.profile?.tenant_id || "—"}
                  copyable
                  mono
                  onCopy={copyValue}
                  copied={copied}
                  tag="tenant"
                />
                <Row label="Cargo" value={data.profile?.cargo || "—"} />
                <RoleRow role={data.profile?.role || null} busy={roleBusy} onSet={setRole} />
              </Section>

              <Section title="Acesso" icon={Mail}>
                <Row
                  label="E-mail"
                  value={data.profile?.email || data.auth?.email || "—"}
                  copyable
                  mono
                  onCopy={copyValue}
                  copied={copied}
                  tag="email"
                />
                <Row label="Telefone" value={data.auth?.phone || "—"} />
                <Row
                  label="Último login"
                  value={
                    data.auth?.last_sign_in_at
                      ? format(new Date(data.auth.last_sign_in_at), "dd/MM/yyyy HH:mm")
                      : "nunca"
                  }
                />
                <Row
                  label="Criado em"
                  value={data.auth?.created_at ? format(new Date(data.auth.created_at), "dd/MM/yyyy") : "—"}
                />
                <div className="mt-3 space-y-2 rounded-md border border-white/10 bg-neutral-900 p-3">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                    <KeyRound className="h-3.5 w-3.5 text-neutral-300" /> Senha
                  </p>
                  {newPassword ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-md border border-neutral-500 bg-neutral-900 px-2 py-1.5 admin-mono text-base  text-white">
                        {pwdVisible ? newPassword : "•".repeat(newPassword.length)}
                      </code>
                      <button
                        type="button"
                        onClick={() => setPwdVisible((v) => !v)}
                        title={pwdVisible ? "Ocultar" : "Mostrar"}
                        className="shrink-0 rounded-md border border-white/10 bg-neutral-900 p-1.5 text-neutral-200 hover:bg-neutral-900"
                      >
                        {pwdVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyValue(newPassword, "pwd")}
                        title="Copiar"
                        className={cn(
                          "shrink-0 rounded-md border p-1.5 transition",
                          copied === "pwd"
                            ? "border-neutral-500 bg-neutral-900 text-white"
                            : "border-white/10 bg-neutral-900 text-neutral-200 hover:bg-neutral-900"
                        )}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400">
                      A senha original do Supabase Auth é armazenada como hash e não pode ser recuperada. Gere uma
                      nova senha numérica de 8 dígitos para reenviar ao zelador.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void resetPassword()}
                    disabled={resetting}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-xs font-bold text-neutral-300 hover:bg-neutral-900 disabled:opacity-60"
                  >
                    {resetting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {newPassword ? "Gerar outra senha" : "Gerar nova senha"}
                  </button>
                </div>
              </Section>

              <Section title="Plano" icon={Calendar}>
                <Row label="Plano" value={data.subscription?.plan || "—"} />
                <Row label="Estado" value={data.subscription?.status || "—"} />
                <Row
                  label="Expira"
                  value={
                    data.subscription?.expires_at
                      ? format(new Date(data.subscription.expires_at), "dd/MM/yyyy")
                      : "Vitalício (sem expiração)"
                  }
                />
                <Row
                  label="Bloqueio"
                  value={
                    data.profile?.is_blocked ? (
                      <span className="inline-flex items-center gap-1 text-white">
                        <ShieldAlert className="h-3.5 w-3.5" /> Bloqueado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-white">
                        <ShieldCheck className="h-3.5 w-3.5" /> Activo
                      </span>
                    )
                  }
                />
              </Section>

              <Section title="Filhos de santo" icon={Users}>
                <Row label="Total" value={String(data.childrenCount ?? 0)} />
                {data.childrenCount > 0 && (
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-neutral-800 bg-black/20 p-2">
                    {(data as any).children?.map((c: any) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-sm bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
                      >
                        <span className="truncate font-medium text-white">{c.nome}</span>
                        <span className="admin-mono text-[10px] uppercase text-neutral-500">
                          {c.cargo || c.status || ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Armazenamento (R2)" icon={HardDrive}>
                {!data.storage.configured ? (
                  <p className="text-xs text-neutral-400">R2 não configurado no servidor.</p>
                ) : (
                  <>
                    <Row label="Objectos" value={String(data.storage.objects ?? 0)} />
                    <Row
                      label="Tamanho"
                      value={`${bytesToHuman(data.storage.bytes)} (${data.storage.mb ?? 0} MB)`}
                    />
                    {data.storage.truncated && (
                      <p className="text-[11px] text-neutral-300/80">
                        Listagem truncada — o total real pode ser maior que o exibido.
                      </p>
                    )}
                  </>
                )}
              </Section>

              {data.auth?.user_metadata && Object.keys(data.auth.user_metadata).length > 0 && (
                <Section title="Metadados Auth" icon={Database}>
                  <pre className="max-h-48 overflow-auto rounded-md border border-neutral-800 bg-black/30 p-2 admin-mono text-[10px] text-neutral-300">
{JSON.stringify(data.auth.user_metadata, null, 2)}
                  </pre>
                </Section>
              )}

              {data.profile?.foto_url && (
                <Section title="Foto" icon={UserIcon}>
                  <img
                    src={data.profile.foto_url}
                    alt="Foto"
                    className="h-20 w-20 rounded-md border border-white/10 object-cover"
                    referrerPolicy="no-referrer"
                  />
                </Section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function RoleRow({
  role,
  busy,
  onSet,
}: {
  role: string | null;
  busy: boolean;
  onSet: (r: "admin" | "filho") => void;
}) {
  const normalized = String(role || "").toLowerCase().trim();
  const isFilho = normalized === "filho";
  const isAdmin = normalized === "admin";
  const isInconsistent = !!normalized && !isFilho && !isAdmin;
  const tone = isFilho
    ? "admin-badge"
    : isAdmin
      ? "admin-badge-strong"
      : "admin-badge";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="admin-label">Papel</span>
      <div className="flex items-center gap-2">
        <span className={cn(tone, "rounded-md px-2 py-0.5 text-[11px]")}>
          {role || "—"}
        </span>
        {isInconsistent && (
          <button
            type="button"
            onClick={() => onSet("admin")}
            disabled={busy}
            title="Normalizar papel para 'admin' (zelador)."
            className="admin-btn-secondary !px-2 !py-0.5 !text-[10px] uppercase"
          >
            {busy ? "..." : "definir admin"}
          </button>
        )}
        {!isInconsistent && (
          <button
            type="button"
            onClick={() => onSet(isFilho ? "admin" : "filho")}
            disabled={busy}
            title={isFilho ? "Marcar como Admin (zelador)" : "Marcar como Filho"}
            className="admin-btn-ghost !px-2 !py-0.5 !text-[10px] uppercase"
          >
            {busy ? "..." : isFilho ? "→ admin" : "→ filho"}
          </button>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-card-padded">
      <h4 className="admin-label mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  copyable,
  mono,
  onCopy,
  copied,
  tag,
}: {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
  mono?: boolean;
  onCopy?: (text: string, tag: string) => Promise<void> | void;
  copied?: string | null;
  tag?: string;
}) {
  const isString = typeof value === "string";
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-xs">
      <span className="shrink-0 admin-label !normal-case">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <span className={cn("min-w-0 truncate text-right text-[var(--ac-text)]", mono && "admin-mono")}>
          {value || "—"}
        </span>
        {copyable && isString && onCopy && tag && (
          <button
            type="button"
            onClick={() => void onCopy(String(value), tag)}
            title="Copiar"
            className={cn(
              "admin-btn-ghost shrink-0 !p-1",
              copied === tag && "text-[var(--ac-success)]"
            )}
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default TenantDrawer;
