import { useEffect, useMemo, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { ROUTES } from "../../lib/routes";
import { trackInsightDismissed } from "../../lib/trackInsightDismissed";

/** YLÊ EXU TIRIRI LONAN — insights pontuais de onboarding */
const YLE_TENANT_ID = "babd181f-40d0-44bb-8eae-40f2cee0b54e";
/** Conta de teste do Lucas — mesma prévia do card do Alex */
const PREVIEW_EMAILS = new Set(["testeanual@axecloud.com"]);
/** v4: mesmo conteúdo + rastreio do clique em Entendi no admin */
const INSIGHT_KEY = "yle-membro-login-v4";
const STORAGE_KEY = `axecloud:insight:${INSIGHT_KEY}`;
const INSIGHT_TITLE = "Login dos membros (Registro + CPF)";

type DashboardSystemInsightCardProps = {
  tenantId?: string | null;
  userEmail?: string | null;
  userRole?: string;
  zeladorFirstName?: string;
};

export function DashboardSystemInsightCard({
  tenantId,
  userEmail,
  userRole = "admin",
  zeladorFirstName = "Alex",
}: DashboardSystemInsightCardProps) {
  const email = String(userEmail || "").trim().toLowerCase();
  const tid = String(tenantId || "").trim();
  const isPreview = PREVIEW_EMAILS.has(email) && tid !== YLE_TENANT_ID;

  const eligible = useMemo(() => {
    if (userRole === "filho") return false;
    if (tid === YLE_TENANT_ID) return true;
    if (email && PREVIEW_EMAILS.has(email)) return true;
    return false;
  }, [tid, email, userRole]);

  const storageKey = useMemo(() => {
    const scope = tid || email || "default";
    return `${STORAGE_KEY}:${scope}`;
  }, [tid, email]);

  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (!eligible || dismissed) return null;

  const dismiss = () => {
    void trackInsightDismissed({
      insightKey: INSIGHT_KEY,
      insightTitle: INSIGHT_TITLE,
      tenantId: tid || null,
    });
    localStorage.setItem(storageKey, "1");
    setDismissed(true);
  };

  const greetingName = isPreview ? "Alex" : zeladorFirstName;

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl border border-[#E8C767]/25 bg-gradient-to-br from-[#1A1810] via-[#151A21] to-[#11151A] shadow-[0_18px_44px_-34px_rgba(0,0,0,0.9)]"
      aria-labelledby="system-insight-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#E8C767]/25 bg-[#E8C767]/10">
            <Lightbulb className="h-5 w-5 text-[#E8C767]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#E8C767]">
              Insight do sistema
              {isPreview ? " · prévia" : ""}
            </p>
            <h2 id="system-insight-title" className="mt-1 text-lg font-black text-[#FFFDF7]">
              Axé, {greetingName}!
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#B8C5BB]">
              Seus membros ainda não conseguiram entrar — o login do filho é diferente do seu.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-[#94A3B8] transition hover:border-white/20 hover:text-white"
          aria-label="Fechar aviso"
          title="Entendi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4 text-sm leading-relaxed text-[#D8E0D7]">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#E8C767]/90">
            Como o membro entra
          </p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 font-semibold">
            <li>
              Abrir{" "}
              <span className="font-mono text-[#F8FAFC]">axecloud.com.br/entrar</span> e escolher{" "}
              <strong className="text-white">Membro</strong> (não Zelador).
            </li>
            <li>
              Digitar o <strong className="text-white">Registro</strong> que chegou no WhatsApp
              (ex.: AXC-2026-XXXX).
            </li>
            <li>
              Senha = <strong className="text-white">6 primeiros dígitos do CPF</strong> — não é
              senha de e-mail nem do WhatsApp.
            </li>
          </ol>
        </div>

        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#E8C767]/90">
            O que você pode fazer agora
          </p>
          <ul className="mt-2 space-y-2 font-semibold">
            <li className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
              Reenvie o acesso na ficha do filho (botão de WhatsApp) se ele não tiver guardado o
              registro.
            </li>
            <li className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
              Confira se o WhatsApp do membro está com DDD certo antes de reenviar.
            </li>
            <li className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
              Guia completo:{" "}
              <a
                href={ROUTES.instrucoesMembro}
                className="font-bold text-[#E8C767] underline-offset-2 hover:underline"
              >
                axecloud.com.br/instrucoes/membro
              </a>
            </li>
          </ul>
        </div>

        <p className="text-xs font-semibold text-[#8B9A8E]">
          Estamos acompanhando sua casa. Qualquer dúvida, é só chamar.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
        <span className="text-xs font-bold text-[#64748B]">— AxéCloud</span>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl bg-[#E8C767] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#17130D] transition hover:brightness-105"
        >
          Entendi
        </button>
      </div>
    </section>
  );
}
