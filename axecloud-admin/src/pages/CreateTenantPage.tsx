import { useEffect, useState, type FormEvent } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { AdminPanel } from "./AdminDashboardLayout";
import type { FounderTenantPrefill } from "@/lib/founderPrefill";

function generateNumericPassword(length = 8): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(length);
    crypto.getRandomValues(buf);
    let out = "";
    for (let i = 0; i < length; i++) out += String(buf[i] % 10);
    return out;
  }
  let out = "";
  for (let i = 0; i < length; i++) out += String(Math.floor(Math.random() * 10));
  return out;
}

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

export function CreateTenantPage({
  prefill,
  onClearPrefill,
  onDone,
}: {
  prefill: FounderTenantPrefill | null;
  onClearPrefill: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generateNumericPassword(8));
  const [pwdCopied, setPwdCopied] = useState(false);
  const [nomeTerreiro, setNomeTerreiro] = useState("");
  const [nomeZelador, setNomeZelador] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [plan, setPlan] = useState<"premium" | "vita">("premium");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!prefill) return;
    setNomeTerreiro(prefill.nomeTerreiro);
    setNomeZelador(prefill.nomeZelador);
    setWhatsapp(prefill.whatsapp);
    if (prefill.email) setEmail(prefill.email);
    setPassword(generateNumericPassword(8));
    setPwdCopied(false);
    setStatus(null);
  }, [prefill]);

  async function copyPassword() {
    try {
      await navigator.clipboard?.writeText(password);
      setPwdCopied(true);
      window.setTimeout(() => setPwdCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setBusy(true);
    try {
      const observacao = prefill
        ? `axecloud-admin · programa-fundador:${prefill.founderId} · ${prefill.cidade}/${prefill.estado}`
        : "axecloud-admin";
      const r = await apiJson<{ welcome?: { status?: string }; user?: { id?: string } }>(
        "/api/admin/create-tenant",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            nome_terreiro: nomeTerreiro,
            nome_zelador: nomeZelador,
            whatsapp,
            plan,
            observacao,
          }),
        }
      );
      const w = String(r?.welcome?.status || "");
      let suffix = "";
      if (w === "queued") suffix = " · WhatsApp de boas-vindas em rota.";
      else if (w === "no-phone") suffix = " · sem WhatsApp — boas-vindas pulada.";
      else if (w === "disabled") suffix = " · boas-vindas desligada.";
      setStatus(`Terreiro criado.${suffix}`);
      if (prefill) {
        try {
          const leaderId = r?.user?.id ? String(r.user.id) : null;
          await apiJson(`/api/admin-console/founder-applications/${prefill.founderId}`, {
            method: "PATCH",
            body: JSON.stringify({
              status: "accepted",
              ...(leaderId ? { leader_id: leaderId } : {}),
            }),
          });
        } catch {
          /* não bloqueia */
        }
      }
      onDone();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPanel kicker="Operação" title="Novo terreiro">
      <form onSubmit={submit} className="admin-form-card mx-auto w-full max-w-lg space-y-4">
        {prefill ? (
          <div className="admin-prefill-banner">
            <div className="min-w-0">
              <p className="font-semibold text-[var(--ac-text)]">Programa Fundador</p>
              <p className="mt-0.5 text-[12px] text-[var(--ac-text-muted)]">
                Dados de «{prefill.nomeTerreiro}» ({prefill.cidade}/{prefill.estado}). Complete o e-mail e confira a
                senha.
              </p>
            </div>
            <button type="button" onClick={onClearPrefill} className="admin-btn-ghost shrink-0">
              Limpar
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--ac-text-muted)]">
            Cria o usuário no Auth, perfil do terreiro e plano numa única operação.
          </p>
        )}

        <AdminFormField label="E-mail do zelador" value={email} onChange={setEmail} type="email" required />

        <div>
          <label className="admin-label">Senha inicial</label>
          <div className="mt-1 flex items-stretch gap-1.5">
            <input
              className="admin-input admin-mono flex-1"
              value={password}
              required
              type="text"
              inputMode="numeric"
              pattern="\d{8}"
              maxLength={8}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
            <button
              type="button"
              onClick={() => {
                setPassword(generateNumericPassword(8));
                setPwdCopied(false);
              }}
              title="Gerar nova senha"
              className="admin-btn-secondary !px-2.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void copyPassword()}
              title="Copiar senha"
              className={cn("admin-btn-secondary !px-2.5", pwdCopied && "!border-[var(--ac-success)] !text-[var(--ac-success)]")}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-[var(--ac-text-faint)]">8 dígitos numéricos.</p>
        </div>

        <AdminFormField label="Nome do terreiro" value={nomeTerreiro} onChange={setNomeTerreiro} required />
        <AdminFormField label="Nome do zelador" value={nomeZelador} onChange={setNomeZelador} />
        <AdminFormField label="WhatsApp" value={whatsapp} onChange={setWhatsapp} required />

        <div>
          <label className="admin-label">Plano</label>
          <select className="admin-input mt-1" value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)}>
            <option value="premium">Premium (renovável)</option>
            <option value="vita">Plano Vita (vitalício)</option>
          </select>
        </div>

        {status ? (
          <p
            className={cn(
              "text-sm",
              /criado/i.test(status) ? "text-[var(--ac-success)]" : /erro/i.test(status) ? "text-[var(--ac-danger)]" : "text-[var(--ac-text-muted)]"
            )}
          >
            {status}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="admin-btn-primary w-full">
          {busy ? "A criar…" : "Criar terreiro"}
        </button>
      </form>
    </AdminPanel>
  );
}
