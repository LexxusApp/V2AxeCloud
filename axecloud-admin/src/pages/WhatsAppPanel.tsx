import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  LogOut,
  MessageCircle,
  PhoneCall,
  RefreshCw,
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
    }, 8000);
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
      <header className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/60 via-[#0a1d18]/80 to-[#080c14]/90 p-6 shadow-xl ring-1 ring-emerald-400/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-300/80">
              Console · Mensageria
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
              <MessageCircle className="h-6 w-6 text-emerald-300" />
              WhatsApp do administrador
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300/85">
              Conecte um número exclusivo do console para envios globais. A vinculação é feita por{" "}
              <span className="font-semibold text-emerald-200">código de pareamento</span> — não há QR code.
            </p>
          </div>
          <StatusBadge status={status?.status} number={status?.number || null} />
        </div>
      </header>

      {feedback && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm shadow",
            feedback.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-100"
              : "border-rose-500/35 bg-rose-950/35 text-rose-100"
          )}
        >
          {feedback.msg}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#0c121f]/85 p-6 shadow-xl ring-1 ring-white/[0.04]">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <PhoneCall className="h-4 w-4 text-emerald-300" />
            Número do aparelho
          </h3>
          <p className="text-xs leading-relaxed text-slate-400">
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
              className="flex-1 rounded-xl border border-white/[0.1] bg-[#080c14] px-4 py-2.5 font-mono-data text-sm text-white outline-none ring-emerald-400/30 placeholder:text-slate-600 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void connect()}
              disabled={connected || busy === "connect"}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "connect" ? "A gerar…" : "Gerar código"}
            </button>
          </div>
          {phone && (
            <p className="text-[11px] text-slate-500">
              Será enviado: <span className="font-mono-data text-emerald-200">{maskPhone(phone) || phone}</span>
            </p>
          )}

          <hr className="border-white/[0.06]" />

          <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Como usar o código</h4>
          <ol className="space-y-2 text-xs leading-relaxed text-slate-300">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono-data text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/30">
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
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/[0.07] disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", busy === "status" && "animate-spin")} />
              Atualizar estado
            </button>
            {connected && (
              <button
                type="button"
                onClick={() => void logout()}
                disabled={busy === "logout"}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
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
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c121f]/85 p-6 shadow-xl ring-1 ring-white/[0.04]">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Send className="h-4 w-4 text-cyan-300" />
            Enviar mensagem de teste
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Envia uma frase curta para confirmar que o número está operacional.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="tel"
              inputMode="numeric"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="flex-1 rounded-xl border border-white/[0.1] bg-[#080c14] px-4 py-2.5 font-mono-data text-sm text-white outline-none ring-cyan-400/30 focus:ring-2"
            />
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={busy === "test"}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy === "test" ? "A enviar…" : "Enviar"}
            </button>
          </div>
        </section>
      )}
    </div>
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
        "flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest ring-1",
        isOk
          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35"
          : "bg-slate-700/30 text-slate-300 ring-white/10"
      )}
    >
      {isOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      <span>{isOk ? "Conectado" : status === "QRCODE" ? "Pendente" : "Desligado"}</span>
      {isOk && number && (
        <span className="ml-1 font-mono-data text-[10px] font-bold tracking-normal text-emerald-100/80">
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
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-emerald-400/15 bg-[#06120f]/95 p-6 shadow-xl ring-1 ring-emerald-400/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500/40 opacity-90" />
      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
        <Smartphone className="h-4 w-4 text-emerald-300" />
        Código de pareamento
      </h3>

      {connected ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-emerald-500/10 px-6 py-10 text-center ring-1 ring-emerald-400/25">
          <CheckCircle2 className="h-10 w-10 text-emerald-300" />
          <p className="text-sm font-semibold text-emerald-100">WhatsApp do console conectado.</p>
          {phone && <p className="font-mono-data text-xs text-emerald-200/80">{maskPhone(phone) || `+${phone}`}</p>}
        </div>
      ) : code ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-emerald-500/[0.04] px-4 py-8 ring-1 ring-emerald-400/15">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(grouped.length ? grouped : [code]).map((seg, idx, arr) => (
              <span key={`${seg}-${idx}`} className="flex items-center gap-2">
                <span className="rounded-xl border border-emerald-400/30 bg-[#03100c] px-4 py-3 font-mono-data text-2xl font-black tracking-[0.4em] text-emerald-100 shadow-inner shadow-black/40">
                  {seg}
                </span>
                {idx < arr.length - 1 && <span className="text-emerald-300/60">—</span>}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-emerald-200/70">Válido por aproximadamente 60 segundos.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(code.replace(/-/g, ""));
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold text-emerald-100 hover:bg-emerald-500/25"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/[0.07]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Verificar conexão
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
          <Smartphone className="h-9 w-9 text-slate-600" />
          <p className="text-sm font-medium text-slate-300">Nenhum código gerado.</p>
          <p className="max-w-xs text-xs text-slate-500">
            Informe o número à esquerda e clique em <span className="font-semibold text-slate-300">Gerar código</span>{" "}
            para iniciar o pareamento.
          </p>
        </div>
      )}
    </div>
  );
}
