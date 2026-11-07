import { useState, useRef, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  QrCode,
  Save,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { financialMoney as money, parseFinancialAmount } from "./finance";
import "./pix-settings.css";

export type DemoPix = {
  enabled?: boolean;
  keyType: string;
  key: string;
  beneficiary: string;
  amount: string;
  day: string;
};
export const blankPix: DemoPix = {
  keyType: "email",
  key: "",
  beneficiary: "",
  amount: "",
  day: "10",
};
const keyTypes: Record<string, string> = {
  email: "E-mail",
  cpf: "CPF",
  cnpj: "CNPJ",
  phone: "Celular",
  random: "Chave aleatória",
};
function validKey(type: string, key: string) {
  const digits = key.replace(/\D/g, "");
  if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
  if (type === "cpf" || type === "cnpj")
    return (
      digits.length === (type === "cpf" ? 11 : 14) && !/^(\d)\1+$/.test(digits)
    );
  if (type === "phone")
    return /^\+55\d{10,11}$/.test(key.replace(/[\s()-]/g, ""));
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    key,
  );
}
export default function PixSettingsPage({
  saved,
  onSave,
}: {
  saved: DemoPix | null;
  onSave: (config: DemoPix) => void;
}) {
  const [draft, setDraft] = useState<DemoPix>(() =>
    saved ? { ...saved } : { ...blankPix },
  );
  const [saving, setSaving] = useState(false),
    saveLock = useRef(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const dirty = !saved || JSON.stringify(draft) !== JSON.stringify(saved);
  const amount = parseFinancialAmount(draft.amount);
  const keyDone = validKey(draft.keyType, draft.key.trim());
  const accountDone = draft.beneficiary.trim().length >= 3;
  const contributionDone =
    !!amount &&
    Number(draft.day) >= 1 &&
    Number(draft.day) <= 31 &&
    Number.isInteger(Number(draft.day));
  const steps = [keyDone, accountDone, contributionDone];
  function update(field: keyof DemoPix, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    setError("");
    setFeedback("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (saveLock.current) return;
    if (!keyDone) {
      setError(
        draft.keyType === "phone"
          ? "Informe o celular com +55, DDD e número."
          : `Revise o formato da chave ${keyTypes[draft.keyType]}.`,
      );
      return;
    }
    if (!accountDone) {
      setError(
        "Informe o nome do beneficiário com pelo menos três caracteres.",
      );
      return;
    }
    if (!contributionDone) {
      setError("Informe um valor positivo e um dia inteiro entre 1 e 31.");
      return;
    }
    const config = {
      ...draft,
      key: draft.key.trim(),
      beneficiary: draft.beneficiary.trim(),
    };
    saveLock.current = true;
    setSaving(true);
    try {
      await onSave(config);
      setDraft(config);
      setFeedback("Configuração confirmada pelo servidor.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a configuração.",
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.key.trim());
      setFeedback("Chave copiada. O sistema não confirma a titularidade da conta.");
    } catch {
      setFeedback(
        "Não foi possível copiar automaticamente. Selecione o texto da chave exibida.",
      );
    }
  }
  return (
    <div className="pix-page">
      <div className="px-intro">
        <div>
          <h2>Um destino claro para as contribuições.</h2>
          <p>
            Organize a chave e confira como os dados serão apresentados à
            corrente.
          </p>
        </div>
        <span className={`px-save-status ${saved && !dirty ? "saved" : ""}`}>
          {saved && !dirty ? <Check size={15} /> : <KeyRound size={15} />}
          {saved && !dirty
            ? "Salvo no sistema"
            : saved
              ? "Alterações não salvas"
              : "Configuração não salva"}
        </span>
      </div>
      {feedback && (
        <div className="wf-feedback" role="status">
          <Check size={18} />
          <span>{feedback}</span>
        </div>
      )}
      <div className="px-layout">
        <form className="px-form" onSubmit={save} noValidate aria-busy={saving}>
          <div className="px-form-heading">
            <h3>Dados de recebimento</h3>
            <span>{steps.filter(Boolean).length} de 3 etapas preenchidas</span>
          </div>
          <fieldset disabled={saving}>
            <legend>
              <span>1</span>Chave Pix
            </legend>
            <div className="wf-pair">
              <label className="wf-field">
                Tipo de chave
                <select
                  value={draft.keyType}
                  onChange={(e) => {
                    setDraft((d) => ({
                      ...d,
                      keyType: e.target.value,
                      key: "",
                    }));
                    setFeedback("");
                    setError("");
                  }}
                >
                  {Object.entries(keyTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="px-key-help">
                <KeyRound size={17} />
                <p>Use os dados da conta de recebimento da casa.</p>
              </div>
            </div>
            <label className="wf-field">
              Chave de recebimento
              <input
                required
                maxLength={100}
                value={draft.key}
                onChange={(e) => update("key", e.target.value)}
                placeholder={
                  draft.keyType === "email"
                    ? "Ex.: casa@example.invalid"
                    : draft.keyType === "phone"
                      ? "+55 11 99999-9999"
                      : draft.keyType === "random"
                        ? "00000000-0000-0000-0000-000000000000"
                        : draft.keyType === "cpf"
                          ? "000.000.000-00"
                          : "00.000.000/0000-00"
                }
              />
              <small>
                O formato é conferido, mas a titularidade da conta não é verificada.
              </small>
            </label>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>
              <span>2</span>Quem recebe
            </legend>
            <label className="wf-field">
              Nome do beneficiário
              <input
                required
                maxLength={100}
                value={draft.beneficiary}
                onChange={(e) => update("beneficiary", e.target.value)}
                placeholder="Nome do titular da conta"
              />
              <small>
                Use o nome que os membros devem conferir antes de pagar.
              </small>
            </label>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>
              <span>3</span>Contribuição mensal
            </legend>
            <div className="wf-pair">
              <label className="wf-field">
                Valor sugerido (R$)
                <input
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(e) => update("amount", e.target.value)}
                  placeholder="200,00"
                />
              </label>
              <label className="wf-field">
                Dia do vencimento
                <select
                  value={draft.day}
                  onChange={(e) => update("day", e.target.value)}
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      Todo dia {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="px-billing-toggle">
              <input
                type="checkbox"
                checked={draft.enabled !== false}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    enabled: e.target.checked,
                  }))
                }
              />
              Cobrança automática de mensalidade ativa
            </label>
            <p className="px-existing-note">
              O valor e o vencimento sugeridos serão usados em novos
              lançamentos. Mensalidades já criadas mantêm seus valores, juros e
              referências.
            </p>
          </fieldset>
          {error && (
            <p className="wf-error" role="alert">
              {error}
            </p>
          )}
          <div className="px-form-footer">
            <button
              className="wf-button"
              type="submit"
              disabled={!dirty || saving}
            >
              <Save size={17} />
              {saving ? "Salvando…" : "Salvar configuração"}
            </button>
            {saved && dirty && (
              <button
                className="wf-button secondary"
                type="button"
                onClick={() => {
                  setDraft({ ...saved });
                  setError("");
                  setFeedback(
                    "Alterações descartadas. Configuração salva restaurada.",
                  );
                }}
              >
                Descartar alterações
              </button>
            )}
          </div>
          <p className="wf-demo-note">
            As configurações confirmadas ficam salvas no servidor e são usadas
            pelo portal do membro.
          </p>
        </form>
        <aside className="px-preview-area">
          <div className="px-preview-heading">
            <span>Assim o membro verá</span>
            <span>Prévia</span>
          </div>
          <section className="px-receipt" aria-label="Prévia dos dados Pix">
            <div className="px-receipt-brand">
              <Wallet size={22} />
              <span>Contribuição da casa</span>
            </div>
            <h3>{draft.beneficiary.trim() || "Nome do beneficiário"}</h3>
            <div className="px-preview-value">
              <span>Contribuição mensal</span>
              <strong>{amount ? money(amount) : "R$ —"}</strong>
              <small>Vencimento todo dia {draft.day}</small>
            </div>
            <div className="px-qr-placeholder">
              <QrCode size={32} strokeWidth={1.4} />
              <span>
                O QR Code de cada cobrança fica disponível no portal do membro
              </span>
            </div>
            <div className="px-key-display">
              <span>{keyTypes[draft.keyType]}</span>
              <strong>{draft.key.trim() || "Sua chave aparecerá aqui"}</strong>
              <button
                disabled={!keyDone}
                onClick={copy}
                aria-label="Copiar chave Pix"
              >
                <Copy size={16} />
                Copiar chave
              </button>
            </div>
            <p>
              Confira o beneficiário no seu banco antes de concluir qualquer
              pagamento.
            </p>
          </section>
          <div className="px-safety">
            <ShieldCheck size={21} />
            <div>
              <h3>Conferir antes de receber.</h3>
              <p>
                Os dados salvos são utilizados no Pix do portal do membro.
                Confira chave e beneficiário antes de salvar.
              </p>
            </div>
          </div>
          <div className="px-checklist">
            <h3>Revisão da configuração</h3>
            {[
              "Formato da chave informado",
              "Beneficiário preenchido",
              "Valor e vencimento definidos",
            ].map((label, i) => (
              <div key={label}>
                <span className={steps[i] ? "done" : ""}>
                  {steps[i] ? <Check size={13} /> : i + 1}
                </span>
                {label}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
