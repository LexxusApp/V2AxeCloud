import { useState, type FormEvent } from "react";
import { FlaskConical } from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { AdminPanel } from "./AdminDashboardLayout";

function AdminFormField({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="admin-label">{label}</label>
      <input
        className="admin-input mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required={required}
      />
    </div>
  );
}

export function DemoAccountPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [days, setDays] = useState(14);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setBusy(true);
    try {
      const r = await apiJson<{ demoExpiresAt?: string }>("/api/admin-console/create-demo", {
        method: "POST",
        body: JSON.stringify({ email, password, demoDays: days }),
      });
      setStatus(`Demo criada. Expira: ${r.demoExpiresAt || "—"}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPanel kicker="Operação" title="Conta demonstração">
      <form onSubmit={submit} className="admin-form-card mx-auto w-full max-w-lg space-y-4">
        <div className="admin-alert-info">
          <FlaskConical className="h-5 w-5 shrink-0 text-[var(--ac-accent)]" />
          <p className="text-sm text-[var(--ac-text-muted)]">
            Plano premium com expiração curta — ideal para testes com terreiros em avaliação.
          </p>
        </div>

        <AdminFormField label="E-mail" value={email} onChange={setEmail} type="email" required />
        <AdminFormField label="Senha" value={password} onChange={setPassword} type="password" required />

        <div>
          <label className="admin-label">Duração (dias)</label>
          <input
            type="number"
            min={3}
            max={90}
            className="admin-input mt-1"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>

        {status ? (
          <p
            className={cn(
              "text-sm",
              /criada|criado/i.test(status) ? "text-[var(--ac-success)]" : /erro/i.test(status) ? "text-[var(--ac-danger)]" : "text-[var(--ac-text-muted)]"
            )}
          >
            {status}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="admin-btn-primary w-full">
          {busy ? "A gerar…" : "Gerar conta demo"}
        </button>
      </form>
    </AdminPanel>
  );
}
