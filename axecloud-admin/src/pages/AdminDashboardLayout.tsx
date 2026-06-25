import { useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Building2,
  CreditCard,
  FlaskConical,
  HardDrive,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PlusCircle,
  ScrollText,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type AdminNavTab =
  | "overview"
  | "tenants"
  | "logs"
  | "storage"
  | "metrics"
  | "create"
  | "demo"
  | "plans"
  | "whatsapp"
  | "monitor";

type NavItem = { id: AdminNavTab; label: string; icon: LucideIcon };

const MAIN_NAV: NavItem[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "tenants", label: "Terreiros", icon: Building2 },
  { id: "plans", label: "Mensalidades", icon: CreditCard },
  { id: "logs", label: "Eventos", icon: ScrollText },
  { id: "whatsapp", label: "Notificações", icon: MessageCircle },
];

const EXTRA_NAV: NavItem[] = [
  { id: "storage", label: "Armazenamento", icon: HardDrive },
  { id: "metrics", label: "Infra Supabase", icon: Gauge },
  { id: "monitor", label: "Monitor", icon: Activity },
  { id: "create", label: "Novo terreiro", icon: PlusCircle },
  { id: "demo", label: "Conta demo", icon: FlaskConical },
];

const ALL_NAV = [...MAIN_NAV, ...EXTRA_NAV];

const SECTION_SUBTITLES: Partial<Record<AdminNavTab, string>> = {
  overview: "Resumo da plataforma e indicadores principais",
  tenants: "Gestão de terreiros e assinaturas",
  plans: "Catálogo de planos e mensalidades",
  logs: "Registo de eventos e auditoria",
  whatsapp: "Comunicados e notificações",
  storage: "Uso de armazenamento e ficheiros",
  metrics: "Métricas de infraestrutura Supabase",
  monitor: "Monitorização em tempo real",
  create: "Criar novo terreiro na plataforma",
  demo: "Contas de demonstração",
};

export function sectionLabel(tab: AdminNavTab): string {
  return ALL_NAV.find((x) => x.id === tab)?.label ?? "Console";
}

function SidebarNav({
  tab,
  onTab,
  onNavigate,
}: {
  tab: AdminNavTab;
  onTab: (tab: AdminNavTab) => void;
  onNavigate?: () => void;
}) {
  const handleTab = (id: AdminNavTab) => {
    onTab(id);
    onNavigate?.();
  };

  return (
    <nav className="admin-sidebar-nav px-2 py-3 space-y-0.5">
      <p className="admin-nav-group-label">Principal</p>
      {MAIN_NAV.map((item) => {
        const Icon = item.icon;
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleTab(item.id)}
            className={cn("admin-nav-item", active ? "admin-nav-item-active" : "admin-nav-item-idle")}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
            {item.label}
          </button>
        );
      })}
      <p className="admin-nav-group-label">Operações</p>
      {EXTRA_NAV.map((item) => {
        const Icon = item.icon;
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleTab(item.id)}
            className={cn("admin-nav-item", active ? "admin-nav-item-active" : "admin-nav-item-idle")}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="admin-sidebar-brand border-b border-[var(--ac-paper-border)] px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ac-radius-sm)] bg-[var(--ac-accent)] text-white">
          <Shield className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ac-text-faint)]">
            AxéCloud
          </p>
          <h1 className="text-base font-semibold tracking-tight text-[var(--ac-text)] leading-tight">Console</h1>
        </div>
      </div>
    </div>
  );
}

function SidebarSession({ displayName, email }: { displayName: string; email: string }) {
  return (
    <div className="admin-sidebar-session border-t border-[var(--ac-paper-border)] p-3">
      <div className="rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ac-text-faint)]">Sessão</p>
        <p className="mt-1 truncate text-sm font-medium text-[var(--ac-text)]">{displayName}</p>
        <p className="truncate text-[11px] text-[var(--ac-text-muted)]">{email}</p>
      </div>
    </div>
  );
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const email = session.user.email || "";
  const successMsg = msg && /concluída|guardados|criado|criada|demo criada/i.test(msg);
  const subtitle = SECTION_SUBTITLES[tab];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Menu principal">
        <SidebarBrand />
        <SidebarNav tab={tab} onTab={onTab} />
        <SidebarSession displayName={displayName} email={email} />
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="admin-mobile-overlay lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="admin-mobile-drawer lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex items-center justify-between border-b border-[var(--ac-paper-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ac-radius-sm)] bg-[var(--ac-accent)] text-white">
                  <Shield className="h-4 w-4" strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold text-[var(--ac-text)]">Menu</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="admin-btn-ghost !p-2"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav tab={tab} onTab={onTab} onNavigate={() => setMobileOpen(false)} />
            <SidebarSession displayName={displayName} email={email} />
          </div>
        </>
      )}

      <div className="admin-workspace">
        <header className="admin-main-header">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="admin-btn-secondary !p-2.5 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--ac-text)] sm:text-2xl">
                {sectionLabel(tab)}
              </h2>
              {subtitle ? <p className="admin-page-subtitle hidden sm:block">{subtitle}</p> : null}
            </div>
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
            <div className="hidden sm:flex items-center gap-2.5 rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-surface)] px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ac-radius-sm)] bg-[var(--ac-accent)] text-xs font-bold text-white">
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

        <main className="admin-main">
          {msg && (
            <div
              className={cn(
                "mb-6 flex items-start gap-3 rounded-[var(--ac-radius-sm)] border px-4 py-3 text-sm",
                successMsg
                  ? "border-[#abefc6] bg-[var(--ac-success-soft)] text-[var(--ac-success)]"
                  : "border-[#fecdca] bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]"
              )}
              role="status"
            >
              <p className="min-w-0 flex-1">{msg}</p>
              <button
                type="button"
                onClick={onDismissMsg}
                className="shrink-0 rounded-md p-1 hover:bg-[var(--ac-accent-soft)]"
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
    <article className="admin-stat-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="admin-label">{title}</p>
          <p className="admin-mono mt-2 text-2xl font-semibold tracking-tight text-[var(--ac-text)] sm:text-3xl">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-[var(--ac-text-faint)]">{hint}</p> : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] text-[var(--ac-accent)]">
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
              className="flex w-full items-center justify-between gap-3 rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-surface)] px-4 py-3.5 text-left text-sm font-medium text-[var(--ac-text)] transition hover:border-[var(--ac-paper-border-strong)] hover:bg-[var(--ac-paper-elevated)]"
            >
              <span>{item.label}</span>
              <span className="text-[var(--ac-text-faint)]" aria-hidden>
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}
