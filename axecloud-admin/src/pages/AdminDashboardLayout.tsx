import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Building2,
  CreditCard,
  FlaskConical,
  HardDrive,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PlusCircle,
  ScrollText,
  Shield,
  X,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type AdminNavTab =
  | "overview"
  | "tenants"
  | "logs"
  | "storage"
  | "create"
  | "demo"
  | "plans"
  | "whatsapp"
  | "audit"
  | "monitor";

type NavItem = { id: AdminNavTab; label: string; icon: LucideIcon };

const MAIN_NAV: NavItem[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "tenants", label: "Terreiros", icon: Building2 },
  { id: "plans", label: "Mensalidades", icon: CreditCard },
  { id: "logs", label: "Eventos", icon: ScrollText },
  { id: "audit", label: "Relatórios", icon: FileBarChart },
  { id: "whatsapp", label: "Notificações", icon: MessageCircle },
];

const EXTRA_NAV: NavItem[] = [
  { id: "storage", label: "Armazenamento", icon: HardDrive },
  { id: "monitor", label: "Monitor", icon: Activity },
  { id: "create", label: "Novo terreiro", icon: PlusCircle },
  { id: "demo", label: "Conta demo", icon: FlaskConical },
];

const ALL_NAV = [...MAIN_NAV, ...EXTRA_NAV];

export function sectionLabel(tab: AdminNavTab): string {
  return ALL_NAV.find((x) => x.id === tab)?.label ?? "Console";
}

type AdminDashboardLayoutProps = {
  session: Session;
  tab: AdminNavTab;
  onTab: (tab: AdminNavTab) => void;
  onLogout: () => void;
  displayName: string;
  initials: string;
  msg: string | null;
  onDismissMsg: () => void;
  children: ReactNode;
};

export function AdminDashboardLayout({
  session,
  tab,
  onTab,
  onLogout,
  displayName,
  initials,
  msg,
  onDismissMsg,
  children,
}: AdminDashboardLayoutProps) {
  const email = session.user.email || "";
  const successMsg = msg && /concluída|guardados|criado|criada|demo criada/i.test(msg);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Menu principal">
        <div className="admin-sidebar-brand border-b border-white/5 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ac-accent)] text-white shadow-lg shadow-[var(--ac-accent-glow)]">
              <Shield className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa3ad]">AxéCloud</p>
              <h1 className="text-base font-semibold tracking-tight text-white leading-tight">Console</h1>
            </div>
          </div>
        </div>
        <nav className="admin-sidebar-nav px-2.5 py-2 space-y-0.5">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                className={cn("admin-nav-item", active ? "admin-nav-item-active" : "admin-nav-item-idle")}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {item.label}
              </button>
            );
          })}
          <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#9aa3ad]">Operações</p>
          {EXTRA_NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                className={cn(
                  "admin-nav-item",
                  active ? "admin-nav-item-active" : "admin-nav-secondary flex items-center gap-2 px-3 py-2"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="admin-sidebar-session border-t border-white/5 p-3">
          <div className="rounded-xl bg-white/[0.04] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9aa3ad]">Sessão</p>
            <p className="mt-1 truncate text-sm font-medium text-white">{displayName}</p>
            <p className="truncate text-[11px] text-[#b8c0c8]">{email}</p>
          </div>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-main-header">
          <div className="min-w-0">
            <p className="admin-kicker">Console administrativo</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ac-text)] sm:text-2xl">
              {sectionLabel(tab)}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onTab("whatsapp")}
              className="admin-btn-secondary !p-2.5"
              title="Notificações"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2.5 rounded-xl border border-[var(--ac-paper-border)] bg-white px-3 py-2 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ac-accent)] text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 max-w-[180px]">
                <p className="truncate text-sm font-semibold text-[var(--ac-text)]">{displayName}</p>
                <p className="truncate text-[11px] text-[var(--ac-text-muted)]">{email}</p>
              </div>
            </div>
            <button type="button" onClick={onLogout} className="admin-btn-secondary">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        <div className="lg:hidden sticky top-[73px] z-20 border-b border-[var(--ac-paper-border)] bg-[var(--ac-paper)]/95 px-3 py-2 backdrop-blur-md overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {ALL_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tab === item.id
                    ? "bg-[var(--ac-accent)] text-white"
                    : "bg-white border border-[var(--ac-paper-border)] text-[var(--ac-text-muted)]"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <main className="admin-main">
          {msg && (
            <div
              className={cn(
                "mb-6 flex items-start gap-3 rounded-[var(--ac-radius-sm)] border px-4 py-3 text-sm",
                successMsg
                  ? "border-[rgba(13,122,78,0.25)] bg-[var(--ac-success-soft)] text-[var(--ac-success)]"
                  : "border-[rgba(180,35,24,0.25)] bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]"
              )}
              role="status"
            >
              <p className="min-w-0 flex-1">{msg}</p>
              <button
                type="button"
                onClick={onDismissMsg}
                className="shrink-0 rounded-md p-1 hover:bg-black/5"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminStatCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <article className="admin-stat-card group relative overflow-hidden">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--ac-accent-soft)] blur-2xl transition group-hover:bg-[var(--ac-accent-glow)]" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="admin-label">{title}</p>
          <p className="admin-mono mt-2 text-2xl font-semibold tracking-tight text-[var(--ac-text)] sm:text-3xl">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-[var(--ac-text-faint)]">{hint}</p> : null}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-accent-soft)] text-[var(--ac-accent)]">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
    </article>
  );
}

export function AdminPanel({
  kicker,
  title,
  children,
  action,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="admin-panel">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {kicker ? <p className="admin-kicker">{kicker}</p> : null}
          <h3 className="admin-section-title mt-1">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminQuickActions({
  items,
}: {
  items: { label: string; onClick: () => void }[];
}) {
  return (
    <AdminPanel kicker="Fluxo" title="Ações rápidas">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={item.onClick}
              className="flex w-full items-center justify-between gap-3 rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-white px-4 py-3.5 text-left text-sm font-medium text-[var(--ac-text)] transition hover:border-[var(--ac-accent)] hover:bg-[var(--ac-accent-soft)]"
            >
              <span>{item.label}</span>
              <span className="text-[var(--ac-accent)]" aria-hidden>
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}
