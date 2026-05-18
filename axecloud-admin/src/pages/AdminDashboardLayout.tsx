import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut, X, AlertTriangle } from "lucide-react";
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

const MAIN_NAV: { id: AdminNavTab; label: string }[] = [
  { id: "overview", label: "Dashboard" },
  { id: "tenants", label: "Terreiros" },
  { id: "plans", label: "Mensalidades" },
  { id: "logs", label: "Eventos" },
  { id: "audit", label: "Relatórios" },
  { id: "whatsapp", label: "Notificações" },
];

const EXTRA_NAV: { id: AdminNavTab; label: string }[] = [
  { id: "storage", label: "Armazenamento" },
  { id: "monitor", label: "Monitor" },
  { id: "create", label: "Novo terreiro" },
  { id: "demo", label: "Conta demo" },
];

export function sectionLabel(tab: AdminNavTab): string {
  return [...MAIN_NAV, ...EXTRA_NAV].find((x) => x.id === tab)?.label ?? "Painel";
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
  quickActions?: ReactNode;
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
  quickActions,
}: AdminDashboardLayoutProps) {
  const email = session.user.email || "";

  return (
    <div className="min-h-screen bg-black text-white flex overflow-hidden">
      <aside className="w-80 bg-zinc-950 border-r border-yellow-500/10 p-6 hidden lg:flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <div className="w-6 h-6 rounded-full bg-yellow-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wide">
                AXÉ<span className="text-yellow-500">CLOUD</span>
              </h1>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Painel Admin</p>
            </div>
          </div>
          <nav className="space-y-3">
            {MAIN_NAV.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all",
                    active
                      ? "bg-yellow-500 text-black font-bold shadow-xl shadow-yellow-500/20"
                      : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  )}
                >
                  <span className="text-xl">✦</span>
                  {item.label}
                </button>
              );
            })}
            <div className="pt-4 mt-2 border-t border-zinc-800 space-y-2">
              {EXTRA_NAV.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTab(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all text-left",
                      active ? "text-yellow-400 font-semibold" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-400 rounded-3xl p-6 text-black">
          <p className="uppercase text-xs tracking-[0.3em] font-bold">AXÉCLOUD</p>
          <h3 className="text-2xl font-black mt-3 leading-tight">Gestão sagrada com tecnologia premium.</h3>
          <button
            type="button"
            onClick={() => onTab("audit")}
            className="mt-6 bg-black text-white px-5 py-3 rounded-xl font-semibold w-full hover:opacity-90 transition"
          >
            Ver relatórios
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        <header className="border-b border-yellow-500/10 bg-black/80 backdrop-blur-md sticky top-0 z-20">
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-yellow-500 uppercase tracking-[0.3em] text-xs">Bem-vindo</p>
              <h2 className="text-2xl sm:text-3xl font-black mt-2">{sectionLabel(tab)}</h2>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <button
                type="button"
                onClick={() => onTab("whatsapp")}
                className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:border-yellow-500 transition text-lg"
                title="Notificações WhatsApp"
              >
                🔔
              </button>
              <div className="flex items-center gap-3 sm:gap-4 bg-zinc-900 border border-zinc-800 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-yellow-500 text-black font-black flex items-center justify-center shrink-0 text-sm">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{displayName}</p>
                  <p className="text-xs sm:text-sm text-zinc-400 truncate">{email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 hover:border-red-500/50 hover:text-white transition"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
          <div className="lg:hidden px-4 pb-3 flex gap-2 overflow-x-auto">
            {[...MAIN_NAV, ...EXTRA_NAV].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition",
                  tab === item.id
                    ? "bg-yellow-500 text-black"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1">
          {msg && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
                /concluída|guardados|criado|criada|demo criada/i.test(msg)
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-red-500/30 bg-red-500/10 text-red-100"
              )}
            >
              {!/concluída|guardados|criado|criada|demo criada/i.test(msg) && (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p className="min-w-0 flex-1">{msg}</p>
              <button type="button" onClick={onDismissMsg} className="shrink-0 p-1 rounded-lg hover:bg-white/10" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

export function AdminStatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 hover:border-yellow-500/30 transition-all relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-500/10 blur-3xl rounded-full" />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-zinc-400 text-sm">{title}</p>
          <h3 className="text-3xl sm:text-4xl font-black mt-3 tabular-nums">{value}</h3>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-2xl">
          {icon}
        </div>
      </div>
    </div>
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
    <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          {kicker && <p className="text-yellow-500 uppercase tracking-[0.3em] text-xs">{kicker}</p>}
          <h3 className="text-2xl sm:text-3xl font-black mt-2">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function AdminQuickActions({
  items,
}: {
  items: { label: string; onClick: () => void }[];
}) {
  return (
    <AdminPanel kicker="Administração" title="Ações rápidas">
      <div className="space-y-4">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className="w-full bg-zinc-900 border border-zinc-800 hover:border-yellow-500/40 rounded-2xl p-5 flex items-center justify-between transition-all text-left"
          >
            <span>{item.label}</span>
            <span className="text-yellow-500">→</span>
          </button>
        ))}
      </div>
    </AdminPanel>
  );
}
