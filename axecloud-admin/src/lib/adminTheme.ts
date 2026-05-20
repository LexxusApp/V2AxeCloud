/** Classes reutilizáveis — painel admin monocromático (preto/branco). */
export const admin = {
  shell: "admin-shell",
  sidebar: "admin-sidebar",
  mainHeader: "admin-main-header",
  main: "admin-main",
  card: "admin-card",
  cardPadded: "admin-card-padded",
  label: "admin-label",
  sectionTitle: "admin-section-title",
  kicker: "admin-kicker",
  input: "admin-input",
  btnPrimary: "admin-btn-primary",
  btnSecondary: "admin-btn-secondary",
  btnGhost: "admin-btn-ghost",
  tableWrap: "admin-table-wrap",
  table: "admin-table",
  thead: "admin-thead",
  th: "admin-th",
  tbody: "admin-tbody",
  trHover: "admin-tr-hover",
  badge: "admin-badge",
  badgeStrong: "admin-badge-strong",
  badgeMuted: "admin-badge-muted",
  alertInfo: "admin-alert-info",
  alertSuccess: "admin-alert-success",
  alertError: "admin-alert-error",
  statCard: "admin-stat-card",
  drawer: "admin-drawer",
  mono: "admin-mono",
} as const;

export function eventTypeBadgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("unauthorized") || t.includes("failed") || t.includes("fail") || t.includes("error")) {
    return "admin-badge-muted";
  }
  if (t.includes("login") || t.includes("auth")) return "admin-badge";
  return "admin-badge-strong";
}

export function auditStatusBadgeClass(status: string): string {
  return status === "success" ? "admin-badge-strong" : "admin-badge-muted";
}
