import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  LogOut,
  MailPlus,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type StatusPayload = {
  instanceName: string;
  status: "CONNECTED" | "DISCONNECTED" | "QRCODE" | "LOADING";
  number?: string | null;
};

type ConnectPayload = {
  pairingCode?: string;
  instanceName?: string;
  alreadyConnected?: boolean;
  number?: string | null;
  message?: string;
};

function formatPairingCode(raw: string): string {
  const compact = String(raw || "").replace(/\s|-/g, "").toUpperCase();
  if (compact.length === 8) return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  return compact;
}

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 13);
  if (!d) return "";
  const country = d.startsWith("55") ? d.slice(0, 2) : "";
  const rest = country ? d.slice(2) : d;
  const dd = rest.slice(0, 2);
  const a = rest.slice(2, rest.length - 4);
  const b = rest.slice(-4);
  const tail = a && b ? `${a}-${b}` : a || b;
  const ddPart = dd ? `(${dd})${tail ? " " : ""}` : "";
  const prefix = country ? `+${country} ` : "";
  return `${prefix}${ddPart}${tail}`.trim();
}

export function WhatsAppPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [phone, setPhone] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [pairing, setPairing] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "status" | "connect" | "logout" | "test">("idle");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const refreshStatus = useCallback(async () => {
    setBusy("status");
    try {
      const r = await apiJson<StatusPayload>("/api/admin-console/whatsapp/status");
      setStatus(r);
      if (r.status === "CONNECTED") {
        setPairing(null);
      }
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Falha a consultar estado" });
    } finally {
      setBusy("idle");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const id = window.setInterval(() => {
      void refreshStatus();
    }, 15000);
    return () => window.clearInterval(id);
  }, [refreshStatus]);

  const connected = status?.status === "CONNECTED";

  async function connect() {
    setFeedback(null);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setFeedback({ kind: "err", msg: "Digite o número com DDD (e DDI se for estrangeiro)." });
      return;
    }
    setBusy("connect");
    try {
      const r = await apiJson<ConnectPayload>("/api/admin-console/whatsapp/connect", {
        method: "POST",
        body: JSON.stringify({ phone: digits }),
      });
      if (r.alreadyConnected) {
        setFeedback({ kind: "ok", msg: r.message || "Já está conectado." });
        await refreshStatus();
        return;
      }
      if (r.pairingCode) {
        setPairing(formatPairingCode(r.pairingCode));
        setFeedback({ kind: "ok", msg: "Pairing code gerado. Insira no WhatsApp em até 60 segundos." });
      } else {
        setFeedback({ kind: "err", msg: "A Evolution não devolveu pairing code." });
      }
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Erro ao gerar código." });
    } finally {
      setBusy("idle");
    }
  }

  async function logout() {
    if (!confirm("Encerrar sessão WhatsApp do console?")) return;
    setFeedback(null);
    setBusy("logout");
    try {
      await apiJson("/api/admin-console/whatsapp/logout", { method: "POST" });
      setPairing(null);
      setFeedback({ kind: "ok", msg: "Sessão encerrada." });
      await refreshStatus();
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Erro ao desconectar" });
    } finally {
      setBusy("idle");
    }
  }

  async function sendTest() {
    setFeedback(null);
    const digits = testPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setFeedback({ kind: "err", msg: "Informe o número de teste com DDD." });
      return;
    }
    setBusy("test");
    try {
      await apiJson("/api/admin-console/whatsapp/test-message", {
        method: "POST",
        body: JSON.stringify({ phone: digits }),
      });
      setFeedback({ kind: "ok", msg: "Mensagem enviada." });
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Falha ao enviar." });
    } finally {
      setBusy("idle");
    }
  }

  const steps = useMemo(
    () => [
      "Abra o WhatsApp no seu celular.",
      "Toque em Configurações → Aparelhos conectados.",
      "Toque em Conectar um aparelho → Conectar com número de telefone.",
      "Digite o código mostrado ao lado, sem espaços.",
    ],
    []
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="admin-card-padded">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase  text-white/80">
              Console · Mensageria
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
              <MessageCircle className="h-6 w-6 text-white" />
              WhatsApp do administrador
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-300/85">
              Conecte um número exclusivo do console para envios globais. A vinculação é feita por{" "}
              <span className="font-semibold text-white">código de pareamento</span> — não há QR code.
            </p>
          </div>
          <StatusBadge status={status?.status} number={status?.number || null} />
        </div>
      </header>

      {feedback && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm shadow",
            feedback.kind === "ok"
              ? "border-neutral-500 bg-neutral-900 text-white"
              : "border-neutral-400 bg-black text-white"
          )}
        >
          {feedback.msg}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4 rounded-md border border-neutral-800 bg-neutral-950 p-6 shadow-xl ring-1 ring-neutral-800">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <PhoneCall className="h-4 w-4 text-white" />
            Número do aparelho
          </h3>
          <p className="text-xs leading-relaxed text-neutral-400">
            Digite o telefone que vai escanear o código. Use somente números (DDI + DDD + linha).
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 91234-5678"
              disabled={connected || busy === "connect"}
              className="flex-1 rounded-md border border-neutral-800 bg-black px-4 py-2.5 admin-mono text-sm text-white outline-none ring-neutral-600 placeholder:text-neutral-600 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void connect()}
              disabled={connected || busy === "connect"}
              className="admin-btn-primary disabled:cursor-not-allowed"
            >
              {busy === "connect" ? "A gerar…" : "Gerar código"}
            </button>
          </div>
          {phone && (
            <p className="text-[11px] text-neutral-500">
              Será enviado: <span className="admin-mono text-white">{maskPhone(phone) || phone}</span>
            </p>
          )}

          <hr className="border-neutral-800" />

          <h4 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Como usar o código</h4>
          <ol className="space-y-2 text-xs leading-relaxed text-neutral-300">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 admin-mono text-[10px] font-bold text-white ring-1 ring-neutral-600">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => void refreshStatus()}
              disabled={busy === "status"}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-neutral-200 hover:bg-neutral-900 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", busy === "status" && "animate-spin")} />
              Atualizar estado
            </button>
            {connected && (
              <button
                type="button"
                onClick={() => void logout()}
                disabled={busy === "logout"}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-400 bg-black px-3 py-1.5 text-[11px] font-bold text-white hover:bg-black disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5" />
                Desconectar
              </button>
            )}
          </div>
        </div>

        <PairingCard
          code={pairing}
          connected={connected}
          phone={status?.number || null}
          onRefresh={() => void refreshStatus()}
        />
      </section>

      {connected && (
        <section className="rounded-md border border-neutral-800 bg-neutral-950 p-6 shadow-xl ring-1 ring-neutral-800">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Send className="h-4 w-4 text-neutral-300" />
            Enviar mensagem de teste
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            Envia uma frase curta para confirmar que o número está operacional.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="tel"
              inputMode="numeric"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="flex-1 rounded-md border border-neutral-800 bg-black px-3 py-2 admin-mono text-sm text-white outline-none ring-neutral-400/25 focus:ring-2"
            />
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={busy === "test"}
              className="rounded-md bg-neutral-100 px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white disabled:opacity-60"
            >
              {busy === "test" ? "A enviar…" : "Enviar"}
            </button>
          </div>
        </section>
      )}

      <WelcomeMessageEditor connected={connected} />
    </div>
  );
}

type WelcomeConfig = {
  enabled: boolean;
  template: string;
  loginUrl: string;
  signature: string;
  defaults?: { enabled: boolean; template: string; loginUrl: string; signature: string };
};

const WELCOME_VARS: ReadonlyArray<{ token: string; label: string }> = [
  { token: "{{nome_terreiro}}", label: "Nome do terreiro" },
  { token: "{{nome_zelador}}", label: "Nome do zelador" },
  { token: "{{email}}", label: "E-mail de acesso" },
  { token: "{{senha}}", label: "Senha gerada" },
  { token: "{{site}}", label: "URL de acesso" },
  { token: "{{assinatura}}", label: "Assinatura" },
];

function WelcomeMessageEditor({ connected }: { connected: boolean }) {
  const [cfg, setCfg] = useState<WelcomeConfig | null>(null);
  const [busy, setBusy] = useState<"idle" | "load" | "save" | "test">("idle");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [testPhone, setTestPhone] = useState("");

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const r = await apiJson<WelcomeConfig>("/api/admin-console/welcome-message");
      setCfg(r);
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Erro ao carregar." });
    } finally {
      setBusy("idle");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!cfg) return;
    setBusy("save");
    setFeedback(null);
    try {
      const r = await apiJson<WelcomeConfig>("/api/admin-console/welcome-message", {
        method: "POST",
        body: JSON.stringify({
          enabled: cfg.enabled,
          template: cfg.template,
          loginUrl: cfg.loginUrl,
          signature: cfg.signature,
        }),
      });
      setCfg(r);
      setFeedback({ kind: "ok", msg: "Mensagem guardada." });
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Erro ao guardar." });
    } finally {
      setBusy("idle");
    }
  }

  function resetToDefault() {
    if (!cfg?.defaults) return;
    setCfg({ ...cfg, ...cfg.defaults });
  }

  function insertVar(token: string) {
    if (!cfg) return;
    const ta = document.getElementById("welcome-template-ta") as HTMLTextAreaElement | null;
    if (!ta) {
      setCfg({ ...cfg, template: `${cfg.template}${token}` });
      return;
    }
    const start = ta.selectionStart ?? cfg.template.length;
    const end = ta.selectionEnd ?? cfg.template.length;
    const next = cfg.template.slice(0, start) + token + cfg.template.slice(end);
    setCfg({ ...cfg, template: next });
    queueMicrotask(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    });
  }

  async function sendTest() {
    setFeedback(null);
    const digits = testPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setFeedback({ kind: "err", msg: "Informe o número de destino com DDD." });
      return;
    }
    setBusy("test");
    try {
      await apiJson("/api/admin-console/welcome-message/test", {
        method: "POST",
        body: JSON.stringify({ phone: digits }),
      });
      setFeedback({ kind: "ok", msg: "Mensagem de teste enviada." });
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Falha ao enviar teste." });
    } finally {
      setBusy("idle");
    }
  }

  if (!cfg) {
    return (
      <section className="rounded-md border border-neutral-800 bg-neutral-950 p-6 text-sm text-neutral-400 shadow-xl ring-1 ring-neutral-800">
        A carregar configuração da mensagem de boas-vindas…
      </section>
    );
  }

  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-950 p-6 shadow-xl ring-1 ring-neutral-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <MailPlus className="h-4 w-4 text-white" />
            Boas-vindas automáticas
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-400">
            Quando um novo terreiro é criado no console, esta mensagem é enviada pelo WhatsApp do administrador para o número do zelador, com login, senha e URL de acesso.
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-3 rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-xs font-bold text-neutral-200">
          <span className="uppercase tracking-widest text-[10px] text-neutral-400">Disparo</span>
          <button
            type="button"
            onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              cfg.enabled ? "bg-neutral-900" : "bg-neutral-700"
            )}
            aria-pressed={cfg.enabled}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                cfg.enabled ? "left-[18px]" : "left-0.5"
              )}
            />
          </button>
        </label>
      </div>

      {feedback && (
        <div
          className={cn(
            "mt-4 rounded-md border px-3 py-2 text-xs",
            feedback.kind === "ok"
              ? "border-neutral-500 bg-neutral-900 text-white"
              : "border-neutral-400 bg-black text-white"
          )}
        >
          {feedback.msg}
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">URL de acesso</label>
          <input
            value={cfg.loginUrl}
            onChange={(e) => setCfg({ ...cfg, loginUrl: e.target.value })}
            placeholder="https://axecloud.com.br"
            className="mt-1 w-full rounded-md border border-neutral-800 bg-black px-3 py-2 admin-mono text-sm text-white outline-none ring-neutral-400/20 focus:ring-2"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Assinatura</label>
          <input
            value={cfg.signature}
            onChange={(e) => setCfg({ ...cfg, signature: e.target.value })}
            placeholder="Equipe AxéCloud"
            className="mt-1 w-full rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none ring-neutral-400/20 focus:ring-2"
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Mensagem (suporta WhatsApp markdown)</label>
          <div className="flex flex-wrap gap-1.5">
            {WELCOME_VARS.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertVar(v.token)}
                title={v.label}
                className="rounded-lg border border-white/10 bg-neutral-900 px-2 py-1 admin-mono text-[10px] font-bold text-neutral-200 hover:bg-neutral-900 hover:text-white"
              >
                {v.token}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id="welcome-template-ta"
          rows={9}
          value={cfg.template}
          onChange={(e) => setCfg({ ...cfg, template: e.target.value })}
          className="mt-2 w-full resize-y rounded-md border border-neutral-800 bg-black px-3 py-3 admin-mono text-xs leading-relaxed text-white outline-none ring-neutral-600 focus:ring-2"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
          Variáveis disponíveis: <code className="admin-mono text-white">{`{{nome_terreiro}}`}</code>,{" "}
          <code className="admin-mono text-white">{`{{nome_zelador}}`}</code>,{" "}
          <code className="admin-mono text-white">{`{{email}}`}</code>,{" "}
          <code className="admin-mono text-white">{`{{senha}}`}</code>,{" "}
          <code className="admin-mono text-white">{`{{site}}`}</code>,{" "}
          <code className="admin-mono text-white">{`{{assinatura}}`}</code>.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy === "save"}
          className="admin-btn-primary disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {busy === "save" ? "A guardar…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={resetToDefault}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-neutral-900 px-3 py-2.5 text-xs font-bold text-neutral-200 hover:bg-neutral-900"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
        </button>
      </div>

      <div className="mt-6 rounded-md border border-neutral-800 bg-black/70 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          Enviar pré-visualização (teste)
        </h4>
        {!connected ? (
          <p className="mt-2 text-xs text-neutral-300/85">
            Conecte o WhatsApp do administrador acima antes de enviar testes.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="tel"
              inputMode="numeric"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="(11) 91234-5678"
              className="flex-1 rounded-md border border-neutral-800 bg-black px-3 py-2.5 admin-mono text-sm text-white outline-none ring-neutral-600 focus:ring-2"
            />
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={busy === "test"}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {busy === "test" ? "A enviar…" : "Enviar teste"}
            </button>
          </div>
        )}
        <p className="mt-2 text-[10px] text-neutral-500">
          O teste preenche as variáveis com valores de exemplo (terreiro/zelador/senha demonstrativos).
        </p>
      </div>
    </section>
  );
}

function StatusBadge({
  status,
  number,
}: {
  status?: StatusPayload["status"];
  number: string | null;
}) {
  const isOk = status === "CONNECTED";
  return (
    <div
      className={cn(
        "flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest ring-1",
        isOk
          ? "bg-neutral-900 text-white ring-neutral-600"
          : "bg-neutral-700/30 text-neutral-300 ring-white/10"
      )}
    >
      {isOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      <span>{isOk ? "Conectado" : status === "QRCODE" ? "Pendente" : "Desligado"}</span>
      {isOk && number && (
        <span className="ml-1 admin-mono text-[10px] font-bold tracking-normal text-white/80">
          · {maskPhone(number) || `+${number}`}
        </span>
      )}
    </div>
  );
}

function PairingCard({
  code,
  connected,
  phone,
  onRefresh,
}: {
  code: string | null;
  connected: boolean;
  phone: string | null;
  onRefresh: () => void;
}) {
  const grouped = code?.split("-") || [];
  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-md border border-neutral-500 bg-neutral-950/95 p-6 shadow-xl ring-1 ring-neutral-600">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-neutral-800" />
      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
        <Smartphone className="h-4 w-4 text-white" />
        Código de pareamento
      </h3>

      {connected ? (
        <div className="flex flex-col items-center gap-3 rounded-md bg-neutral-900 px-6 py-10 text-center ring-1 ring-neutral-600">
          <CheckCircle2 className="h-10 w-10 text-white" />
          <p className="text-sm font-semibold text-white">WhatsApp do console conectado.</p>
          {phone && <p className="admin-mono text-xs text-white/80">{maskPhone(phone) || `+${phone}`}</p>}
        </div>
      ) : code ? (
        <div className="flex flex-col items-center gap-4 rounded-md bg-neutral-900 px-4 py-8 ring-1 ring-neutral-600">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(grouped.length ? grouped : [code]).map((seg, idx, arr) => (
              <span key={`${seg}-${idx}`} className="flex items-center gap-2">
                <span className="rounded-md border border-neutral-500 bg-[#03100c] px-4 py-3 admin-mono text-2xl font-semibold  text-white shadow-inner shadow-black/40">
                  {seg}
                </span>
                {idx < arr.length - 1 && <span className="text-white/60">—</span>}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-white/70">Válido por aproximadamente 60 segundos.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(code.replace(/-/g, ""));
              }}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-500 bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-neutral-900"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-neutral-200 hover:bg-neutral-900"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Verificar conexão
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-white/10 px-6 py-10 text-center">
          <Smartphone className="h-9 w-9 text-neutral-600" />
          <p className="text-sm font-medium text-neutral-300">Nenhum código gerado.</p>
          <p className="max-w-xs text-xs text-neutral-500">
            Informe o número à esquerda e clique em <span className="font-semibold text-neutral-300">Gerar código</span>{" "}
            para iniciar o pareamento.
          </p>
        </div>
      )}
    </div>
  );
}
