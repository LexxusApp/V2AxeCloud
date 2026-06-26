import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { admin } from "@/lib/adminTheme";

export type TenantTableRow = {
  id: string;
  email: string | null;
  nome_terreiro: string | null;
  is_blocked?: boolean | null;
  plan?: string;
  expires_at?: string | null;
  totalChildren?: number;
  created_at?: string | null;
};

function planLabel(plan?: string | null): string {
  const p = (plan || "").toLowerCase();
  if (p === "vita" || p === "vitalicio" || p === "lifetime") return "Vitalício";
  if (p === "premium") return "Premium";
  if (!p) return "—";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function cadastroLabel(created_at?: string | null): string {
  if (!created_at) return "—";
  try {
    return formatDistanceToNow(new Date(created_at), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

function expiraLabel(expires_at?: string | null): string {
  if (!expires_at) return "—";
  try {
    return format(new Date(expires_at), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function tenantInitials(name: string | null): string {
  const n = (name || "?").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function computeMenuPosition(btnRect: DOMRect, panelHeight: number) {
  const gap = 6;
  const panelWidth = 168;
  const left = Math.min(btnRect.right, window.innerWidth - 8);
  const spaceBelow = window.innerHeight - btnRect.bottom;
  const openUp = spaceBelow < panelHeight + gap && btnRect.top > panelHeight + gap;

  return {
    openUp,
    style: {
      position: "fixed" as const,
      zIndex: 10000,
      left,
      minWidth: panelWidth,
      transform: openUp ? "translate(-100%, calc(-100% - 6px))" : "translateX(-100%)",
      top: openUp ? btnRect.top : btnRect.bottom + gap,
    },
  };
}

function RowActionsMenu({
  row,
  compact,
  busy,
  onManage,
  onBlock,
  onRenewMonth,
  onLifetime,
  onDelete,
}: {
  row: TenantTableRow;
  compact?: boolean;
  busy?: boolean;
  onManage: (id: string) => void;
  onBlock: (id: string, blocked: boolean) => void;
  onRenewMonth: (id: string) => void;
  onLifetime: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const panelHeight = panelRef.current?.offsetHeight ?? 220;
    const { style } = computeMenuPosition(btn.getBoundingClientRect(), panelHeight);
    setMenuStyle(style);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    reposition();
  }, [open, reposition, compact, onDelete]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onReflow = () => reposition();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, reposition]);

  const menuPanel = open ? (
    <div
      ref={panelRef}
      className="admin-row-menu-panel admin-row-menu-panel--portal"
      style={menuStyle ?? { position: "fixed", visibility: "hidden" }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className="admin-row-menu-item"
        onClick={() => {
          setOpen(false);
          onManage(row.id);
        }}
      >
        Gerenciar terreiro
      </button>
      <button
        type="button"
        role="menuitem"
        className="admin-row-menu-item"
        onClick={() => {
          setOpen(false);
          onBlock(row.id, !row.is_blocked);
        }}
      >
        {row.is_blocked ? "Desbloquear" : "Bloquear"}
      </button>
      {!compact && (
        <>
          <button
            type="button"
            role="menuitem"
            className="admin-row-menu-item"
            onClick={() => {
              setOpen(false);
              onRenewMonth(row.id);
            }}
          >
            Renovar +1 mês
          </button>
          <button
            type="button"
            role="menuitem"
            className="admin-row-menu-item"
            onClick={() => {
              setOpen(false);
              onLifetime(row.id);
            }}
          >
            Acesso vitalício
          </button>
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              className="admin-row-menu-item admin-row-menu-item--danger"
              onClick={() => {
                setOpen(false);
                onDelete(row.id);
              }}
            >
              Excluir terreiro
            </button>
          )}
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="admin-row-menu" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="admin-btn-secondary !p-1.5"
        aria-label="Acções"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuPanel && typeof document !== "undefined" ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}

type TenantsTableProps = {
  rows: TenantTableRow[];
  search: string;
  onSearchChange: (v: string) => void;
  onManage: (id: string) => void;
  onBlock: (id: string, blocked: boolean) => void;
  onRenewMonth: (id: string) => void;
  onLifetime: (id: string) => void;
  onDelete?: (id: string) => void;
  busy?: boolean;
  compact?: boolean;
};

export function TenantsTable({
  rows,
  search,
  onSearchChange,
  onManage,
  onBlock,
  onRenewMonth,
  onLifetime,
  onDelete,
  busy,
  compact,
}: TenantsTableProps) {
  const cell = "px-4 py-3";
  const head = cn(cell, "text-[10px] font-semibold uppercase tracking-wider text-[var(--ac-text-muted)]");

  return (
    <section className="admin-panel !p-0">
      <div className="admin-table-toolbar">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ac-text)]">
            {compact ? "Últimos terreiros" : "Todos os terreiros"}
          </h3>
          <p className="text-xs text-[var(--ac-text-muted)] mt-0.5">
            {rows.length} {rows.length === 1 ? "registo" : "registos"}
            {search ? ` · filtro activo` : ""}
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar terreiro ou e-mail…"
          className="admin-input !py-2 !text-sm w-full sm:max-w-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className={cn(admin.thead, "text-left")}>
              <th className={head}>Terreiro</th>
              <th className={head}>Plano</th>
              {!compact && <th className={head}>Membros</th>}
              <th className={head}>Cadastro</th>
              {!compact && <th className={head}>Expira</th>}
              <th className={head}>Estado</th>
              <th className={cn(head, "text-right")}>Acções</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={compact ? 5 : 7} className="px-4 py-12 text-center">
                  <p className="text-sm font-medium text-[var(--ac-text)]">
                    {busy ? "A carregar terreiros…" : "Nenhum terreiro encontrado"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ac-text-muted)]">
                    {search ? "Tente outro termo de busca." : "Os novos cadastros aparecerão aqui."}
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(admin.trHover, "border-b border-[var(--ac-paper-border)] transition-colors")}
                >
                  <td className={cell}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "admin-tenant-avatar",
                          row.is_blocked && "admin-tenant-avatar--blocked"
                        )}
                      >
                        {tenantInitials(row.nome_terreiro)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--ac-text)] truncate max-w-[200px]">
                          {row.nome_terreiro || "Sem nome"}
                        </p>
                        <p className="text-[11px] text-[var(--ac-text-muted)] truncate max-w-[200px]">
                          {row.email || "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={cell}>
                    <span className={cn(admin.badgeStrong, "px-2 py-0.5 text-[11px] font-medium")}>
                      {planLabel(row.plan)}
                    </span>
                  </td>
                  {!compact && (
                    <td className={cn(cell, "text-[var(--ac-text-muted)] admin-mono text-xs")}>
                      {row.totalChildren ?? "—"}
                    </td>
                  )}
                  <td className={cn(cell, "text-[var(--ac-text-muted)] text-xs whitespace-nowrap")}>
                    {cadastroLabel(row.created_at)}
                  </td>
                  {!compact && (
                    <td className={cn(cell, "text-[var(--ac-text-muted)] text-xs whitespace-nowrap")}>
                      {expiraLabel(row.expires_at)}
                    </td>
                  )}
                  <td className={cell}>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        row.is_blocked
                          ? "bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]"
                          : "bg-[var(--ac-success-soft)] text-[var(--ac-success)]"
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {row.is_blocked ? "Bloqueado" : "Activo"}
                    </span>
                  </td>
                  <td className={cn(cell, "text-right")}>
                    <RowActionsMenu
                      row={row}
                      compact={compact}
                      busy={busy}
                      onManage={onManage}
                      onBlock={onBlock}
                      onRenewMonth={onRenewMonth}
                      onLifetime={onLifetime}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
