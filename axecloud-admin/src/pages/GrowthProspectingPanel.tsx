import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Mail, RefreshCw, Search, UserRoundCheck } from "lucide-react";
import { apiJson } from "@/lib/api";
import { AdminPanel, AdminStatCard } from "./AdminDashboardLayout";

type GrowthStatus = {
  safeOutreach?: {
    enabled: boolean;
    testMode: boolean;
    dailyLimit: number;
    city: string;
    aiSalesEnabled: boolean;
  };
};

type Prospect = {
  id: string;
  terreiro_nome: string;
  phone_e164: string;
  cidade: string;
  bairro?: string | null;
  public_email?: string | null;
  website_url?: string | null;
  contact_form_url?: string | null;
  research_status: string;
  outreach_channel?: string | null;
  outreach_status: string;
  outreach_sent_at?: string | null;
  selected_date?: string | null;
  selected_slot?: string | null;
  consent_at?: string | null;
  status: string;
  ai_sales_stage: string;
};

const labels: Record<string, string> = {
  pending: "Aguardando",
  found: "Canal encontrado",
  not_found: "Sem canal localizado",
  failed: "Não enviado",
  sent: "Convite enviado",
  manual_required: "Formulário localizado",
  replied: "Respondeu",
  opted_out: "Não quer contato",
  novo: "Novo",
  contatado: "Contatado",
  respondeu: "Em conversa",
  qualificado: "Interessado",
  cliente: "Cliente",
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function GrowthProspectingPanel() {
  const [status, setStatus] = useState<GrowthStatus | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, p] = await Promise.all([
        apiJson<GrowthStatus>("/api/admin-console/growth/status"),
        apiJson<{ prospects: Prospect[] }>("/api/admin-console/growth/prospects"),
      ]);
      setStatus(s);
      setProspects(p.prospects || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a prospecção.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const metrics = useMemo(() => ({
    researched: prospects.filter((p) => p.research_status !== "pending").length,
    sent: prospects.filter((p) => p.outreach_status === "sent").length,
    replied: prospects.filter((p) => p.outreach_status === "replied" || p.consent_at).length,
    qualified: prospects.filter((p) => p.status === "qualificado" || p.status === "cliente").length,
  }), [prospects]);

  const safe = status?.safeOutreach;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard title="Pesquisados" value={String(metrics.researched)} icon={Search} tone="blue" />
        <AdminStatCard title="Convites enviados" value={String(metrics.sent)} icon={Mail} tone="teal" />
        <AdminStatCard title="Conversas abertas" value={String(metrics.replied)} icon={Bot} tone="violet" />
        <AdminStatCard title="Interessados" value={String(metrics.qualified)} icon={UserRoundCheck} tone="emerald" />
      </div>

      <AdminPanel
        kicker="Automação"
        title="Caça-clientes de Suzano"
        action={<button type="button" className="admin-btn-secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</button>}
      >
        <div className="mb-4 rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] p-3 text-sm text-[var(--ac-text-muted)]">
          <p className="font-semibold text-[var(--ac-text)]">
            {safe?.enabled && !safe?.testMode ? "Automação ativa" : "Automação em modo seguro"}
          </p>
          <p className="mt-1">Dois candidatos por dia: um pela manhã e outro à tarde. A IA do WhatsApp só assume quando o próprio contato inicia ou autoriza a conversa.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="admin-badge">Cidade: {safe?.city || "Suzano"}</span>
            <span className="admin-badge">Limite: {safe?.dailyLimit || 2}/dia</span>
            <span className="admin-badge">Vendedor IA: {safe?.aiSalesEnabled ? "ativo" : "desligado"}</span>
          </div>
        </div>

        {error ? <p className="mb-3 rounded-lg bg-[var(--ac-danger-soft)] p-3 text-sm text-[var(--ac-danger)]">{error}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-[var(--ac-paper-border)] text-xs uppercase tracking-wide text-[var(--ac-text-faint)]">
              <tr><th className="px-2 py-3">Terreiro</th><th className="px-2 py-3">Canal público</th><th className="px-2 py-3">Situação</th><th className="px-2 py-3">IA</th><th className="px-2 py-3">Último envio</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--ac-paper-border)]">
              {prospects.map((p) => (
                <tr key={p.id}>
                  <td className="px-2 py-3"><p className="font-semibold text-[var(--ac-text)]">{p.terreiro_nome}</p><p className="text-xs text-[var(--ac-text-faint)]">{[p.bairro, p.cidade].filter(Boolean).join(" · ")}</p></td>
                  <td className="px-2 py-3">{p.public_email ? <a className="text-[var(--ac-accent)] hover:underline" href={`mailto:${p.public_email}`}>{p.public_email}</a> : p.contact_form_url ? <a className="text-[var(--ac-accent)] hover:underline" href={p.contact_form_url} target="_blank" rel="noreferrer">Formulário público</a> : "—"}</td>
                  <td className="px-2 py-3"><span className="admin-badge"><CheckCircle2 className="h-3 w-3" />{labels[p.outreach_status] || labels[p.status] || p.outreach_status}</span></td>
                  <td className="px-2 py-3">{labels[p.ai_sales_stage] || p.ai_sales_stage}</td>
                  <td className="px-2 py-3">{fmtDate(p.outreach_sent_at)}</td>
                </tr>
              ))}
              {!loading && prospects.length === 0 ? <tr><td className="px-2 py-8 text-center text-[var(--ac-text-muted)]" colSpan={5}>Nenhum candidato pesquisado ainda.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
