import { useEffect, useState, type ReactNode } from "react";
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
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PlusCircle,
  Radio,
  ScrollText,
  Shield,
  Sparkles,
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
  | "wa-inbox"
  | "monitor";

type IconTone = "blue" | "violet" | "emerald" | "amber" | "rose" | "teal" | "sky" | "orange";

type NavItem = { id: AdminNavTab; label: string; icon: LucideIcon; tone: IconTone };

const MAIN_NAV: NavItem[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard, tone: "blue" },
  { id: "tenants", label: "Terreiros", icon: Building2, tone: "violet" },
  { id: "plans", label: "Mensalidades", icon: CreditCard, tone: "emerald" },
  { id: "logs", label: "Eventos", icon: ScrollText, tone: "amber" },
  { id: "whatsapp", label: "Notificações", icon: MessageCircle, tone: "teal" },
  { id: "wa-inbox", label: "Caixa WA", icon: Inbox, tone: "sky" },
];

const EXTRA_NAV: NavItem[] = [
  { id: "storage", label: "Armazenamento", icon: HardDrive, tone: "sky" },
  { id: "metrics", label: "Infra Supabase", icon: Gauge, tone: "orange" },
  { id: "monitor", label: "Monitor", icon: Activity, tone: "rose" },
  { id: "demo", label: "Conta demo", icon: FlaskConical, tone: "amber" },
];

const QUICK_ACTION_TONES: IconTone[] = ["violet", "blue", "emerald", "amber", "rose"];

const ALL_NAV = [...MAIN_NAV, ...EXTRA_NAV];

const SECTION_SUBTITLES: Partial<Record<AdminNavTab, string>> = {
  overview: "Resumo da plataforma e indicadores principais",
  tenants: "Gestão de terreiros e assinaturas",
  plans: "Catálogo de planos e mensalidades",
  logs: "Registo de eventos e auditoria",
  whatsapp: "Comunicados e notificações",
  "wa-inbox": "Mensagens recebidas no WhatsApp oficial",
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
      <div className="admin-brand-inner">
        <div className="admin-brand-symbol">
          <Shield className="h-5 w-5" strokeWidth={2.2} />
          <span className="admin-brand-pulse" />
        </div>
        <div className="min-w-0">
          <p className="admin-brand-name">AxéCloud</p>
          <p className="admin-brand-subtitle">Control Center</p>
        </div>
        <span className="admin-root-badge">ROOT</span>
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
      <span className={cn("admin-nav-icon", `admin-icon-chip--${item.tone}`)}>
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
        <span className={cn("admin-nav-icon", "admin-icon-chip--blue", "text-[10px] font-bold")}>{initials}</span>
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

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.classList.add("admin-scroll-lock");
    return () => document.body.classList.remove("admin-scroll-lock");
  }, [mobileOpen]);

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
          className="admin-btn-secondary !p-2 shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="admin-mobile-bar-title">{sectionLabel(tab)}</p>
        <div className="admin-mobile-bar-actions">
          <button
            type="button"
            onClick={() => onTab("create")}
            className="admin-btn-secondary !p-2"
            aria-label="Novo terreiro"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
          <button type="button" onClick={onLogout} className="admin-btn-secondary !p-2" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
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
          <header className="admin-console-topbar">
            <div className="admin-console-context">
              <span>OPERAÇÕES</span>
              <i>/</i>
              <strong>{sectionLabel(tab)}</strong>
            </div>
            <div className="admin-console-actions">
              <div className="admin-live-status">
                <span />
                <Radio className="h-3.5 w-3.5" />
                Sistema online
              </div>
              <button type="button" className="admin-top-action" onClick={() => onTab("monitor")}>
                <Activity className="h-4 w-4" />
                Monitor
              </button>
              <button type="button" className="admin-top-action admin-top-action--accent" onClick={() => onTab("create")}>
                <Sparkles className="h-4 w-4" />
                Novo terreiro
              </button>
            </div>
          </header>
          <main className="admin-main">
            <div className="admin-page-container">
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
  icon: Icon,
  hint,
  tone = "blue",
}: {
  title: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  tone?: IconTone;
}) {
  return (
    <article className="admin-metric-compact">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="admin-label">{title}</p>
          <p className="admin-metric-compact-value admin-mono">{value}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-[var(--ac-text-faint)]">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={cn("admin-action-tile-icon", `admin-icon-chip--${tone}`)}>
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
        ) : null}
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
        {items.map((item, index) => {
          const Icon = item.icon ?? PlusCircle;
          const tone = QUICK_ACTION_TONES[index % QUICK_ACTION_TONES.length];
          return (
            <button key={item.label} type="button" onClick={item.onClick} className="admin-action-tile">
              <span className={cn("admin-action-tile-icon", `admin-icon-chip--${tone}`)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="admin-action-tile-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
