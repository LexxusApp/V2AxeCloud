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

function SidebarBrand() {
  return (
    <div className="admin-sidebar-brand">
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] text-[var(--ac-text-muted)]">
          <Shield className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--ac-text)] leading-tight truncate">AxéCloud Console</p>
          <p className="text-[10px] text-[var(--ac-text-faint)]">Administração global</p>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("admin-nav-item", active ? "admin-nav-item-active" : "admin-nav-item-idle")}
    >
      <span className="admin-nav-icon">
        <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.75} />
      </span>
      {item.label}
    </button>
  );
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
  const go = (id: AdminNavTab) => {
    onTab(id);
    onNavigate?.();
  };

  return (
    <nav className="admin-sidebar-nav px-2 py-2 space-y-0.5">
      <p className="admin-nav-group-label">Principal</p>
      {MAIN_NAV.map((item) => (
        <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => go(item.id)} />
      ))}
      <p className="admin-nav-group-label">Operações</p>
      {EXTRA_NAV.map((item) => (
        <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => go(item.id)} />
      ))}
    </nav>
  );
}

function SidebarSession({
  displayName,
  email,
  initials,
  onLogout,
  onNotifications,
}: {
  displayName: string;
  email: string;
  initials: string;
  onLogout: () => void;
  onNotifications: () => void;
}) {
  return (
    <div className="admin-sidebar-session">
      <div className="flex items-center gap-2.5">
        <div className="admin-tenant-avatar">{initials}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--ac-text)] truncate">{displayName}</p>
          <p className="text-[10px] text-[var(--ac-text-muted)] truncate">{email}</p>
        </div>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <button type="button" onClick={onNotifications} className="admin-btn-secondary flex-1 !py-1.5 text-xs">
          <Bell className="h-3.5 w-3.5" />
          Alertas
        </button>
        <button type="button" onClick={onLogout} className="admin-btn-secondary flex-1 !py-1.5 text-xs">
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="admin-page-title">{title}</h1>
          {subtitle ? <p className="admin-page-subtitle mt-1">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
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
  const showPageHeader = tab !== "overview";

  const sessionFooter = (
    <SidebarSession
      displayName={displayName}
      email={email}
      initials={initials}
      onLogout={onLogout}
      onNotifications={() => onTab("whatsapp")}
    />
  );

  return (
    <div className="admin-app">
      <div className="admin-mobile-bar lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="admin-btn-secondary !p-2"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold text-[var(--ac-text)] truncate">{sectionLabel(tab)}</p>
      </div>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="admin-mobile-overlay lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="admin-mobile-drawer lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex items-center justify-between border-b border-[var(--ac-paper-border)] px-3 py-2.5">
              <SidebarBrand />
              <button type="button" onClick={() => setMobileOpen(false)} className="admin-btn-ghost !p-2" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav tab={tab} onTab={onTab} onNavigate={() => setMobileOpen(false)} />
            <div className="admin-sidebar-cta">
              <button type="button" className="admin-btn-primary" onClick={() => { onTab("create"); setMobileOpen(false); }}>
                <PlusCircle className="h-4 w-4" />
                Novo terreiro
              </button>
            </div>
            {sessionFooter}
          </div>
        </>
      )}

      <div className="admin-body">
        <aside className="admin-sidebar" aria-label="Menu principal">
          <SidebarBrand />
          <SidebarNav tab={tab} onTab={onTab} />
          <div className="admin-sidebar-cta">
            <button type="button" className="admin-btn-primary" onClick={() => onTab("create")}>
              <PlusCircle className="h-4 w-4" />
              Novo terreiro
            </button>
          </div>
          {sessionFooter}
        </aside>

        <div className="admin-workspace">
          <main className="admin-main">
            <div className="admin-page-container">
              {msg && (
                <div
                  className={cn(
                    "mb-6 flex items-start gap-3 rounded-[var(--ac-radius-sm)] border px-4 py-3 text-sm",
                    successMsg
                      ? "border-[var(--ac-paper-border)] bg-[var(--ac-paper-surface)] text-[var(--ac-text)]"
                      : "border-[var(--ac-paper-border-strong)] bg-[var(--ac-paper-elevated)] text-[var(--ac-text)]"
                  )}
                  role="status"
                >
                  <p className="min-w-0 flex-1">{msg}</p>
                  <button
                    type="button"
                    onClick={onDismissMsg}
                    className="shrink-0 rounded-md p-1 hover:bg-[var(--ac-paper-elevated)]"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {showPageHeader && (
                <AdminPageHeader title={sectionLabel(tab)} subtitle={subtitle} />
              )}

              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function AdminStatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
}) {
  return (
    <article className="admin-metric-compact">
      <p className="admin-label">{title}</p>
      <p className="admin-metric-compact-value admin-mono">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-[var(--ac-text-faint)]">{hint}</p> : null}
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
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--ac-paper-border)] pb-4">
        <div>
          {kicker ? <p className="admin-kicker">{kicker}</p> : null}
          <h3 className="admin-section-title mt-0.5">{title}</h3>
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
  items: { label: string; onClick: () => void; icon?: LucideIcon }[];
}) {
  return (
    <section className="admin-panel">
      <p className="admin-kicker">Fluxo</p>
      <h3 className="admin-section-title mt-0.5 mb-4">Ações rápidas</h3>
      <div className="admin-action-tile-grid">
        {items.map((item) => (
          <button key={item.label} type="button" onClick={item.onClick} className="admin-action-tile">
            <span className="admin-action-tile-label">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
