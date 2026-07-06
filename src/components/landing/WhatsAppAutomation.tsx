import { motion } from 'framer-motion';
import { BadgeCheck, CheckCircle, MessageCircle, ShieldCheck } from 'lucide-react';
import { LandingIconBox, landingIconClass } from './landingIconAccents';
import { LandingSection } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

const benefits = [
  {
    title: 'Avisos de giras e convites',
    desc: 'Filhos com WhatsApp cadastrado recebem lembrete quando uma gira é criada ou quando são convidados.',
  },
  {
    title: 'Lembrete de mensalidade',
    desc: 'Templates aprovados pela Meta — aviso antes do vencimento e confirmação quando o pagamento é registrado.',
  },
  {
    title: 'Nome do terreiro em cada mensagem',
    desc: 'A mensagem chega pelo canal oficial AxéCloud personalizada com o membro e a casa — sem spam genérico.',
  },
] as const;

const trustBadges = [
  'API oficial Meta',
  'WhatsApp Business',
  'Templates aprovados',
  'Sem QR Code',
] as const;

function MetaBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1877F2]/35 bg-[#1877F2]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#6BA3FF]">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden>
        <path
          fill="currentColor"
          d="M12 2C6.48 2 2 6.15 2 11.25c0 2.91 1.45 5.5 3.72 7.2V22l3.4-1.87c.91.25 1.87.39 2.88.39 5.52 0 10-4.15 10-9.25S17.52 2 12 2z"
        />
      </svg>
      Meta Cloud API
    </span>
  );
}

function WhatsAppPhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-amber-500/10 blur-2xl"
        aria-hidden
      />
      <div className="landing-device-frame relative overflow-hidden">
        <div className="landing-device-chrome">
          <span className="landing-device-dot bg-red-500/90" aria-hidden />
          <span className="landing-device-dot bg-amber-400/90" aria-hidden />
          <span className="landing-device-dot bg-amber-500/70" aria-hidden />
          <span className="landing-device-url flex items-center gap-1.5">
            <MessageCircle className="h-3 w-3 text-amber-400" aria-hidden />
            WhatsApp Business · AxéCloud
          </span>
        </div>

        <div className="relative bg-[#0b141a] p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3 border-b border-white/5 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600 text-xs font-black text-white">
              AC
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-bold text-white">
                AxéCloud
                <BadgeCheck className="h-4 w-4 shrink-0 text-[#25D366]" aria-hidden />
              </p>
              <p className="text-[10px] text-amber-400/90">Conta comercial verificada</p>
            </div>
            <MetaBadge />
          </div>

          <div className="space-y-3 rounded-xl bg-[#1f2c34]/80 p-3">
            <div className="max-w-[92%] rounded-lg rounded-tl-none bg-[#005c4b] px-3 py-2.5 text-left shadow-lg">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/80">Aviso de gira</p>
              <p className="mt-1 text-xs leading-relaxed text-[#e9edef]">
                Olá, <span className="font-semibold text-white">Maria</span>! A casa{' '}
                <span className="font-semibold text-white">Terreiro Oxum</span> informa: gira de caboclo no domingo,
                14h. Axé!
              </p>
              <p className="mt-2 text-[9px] text-amber-200/60">Template aprovado · Meta WhatsApp Business</p>
            </div>

            <div className="max-w-[88%] rounded-lg rounded-tl-none bg-[#005c4b] px-3 py-2.5 text-left opacity-90">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/80">Mensalidade</p>
              <p className="mt-1 text-xs leading-relaxed text-[#e9edef]">
                Lembrete: mensalidade de R$ 49,90 vence em 05/06. Sua contribuição sustenta a casa. Axé!
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {trustBadges.map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-zinc-400"
              >
                {label}
              </span>
            ))}
          </div>

          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            Envio via <strong className="font-semibold text-zinc-300">WhatsApp Cloud API (Meta)</strong> — o mesmo
            padrão usado por empresas verificadas. Sem parear celular do zelador.
          </p>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppAutomation() {
  return (
    <LandingSection id="whatsapp" variant="alt" aria-labelledby="whatsapp-head">
      <motion.div className="landing-section-inner" {...fade}>
        <div className="relative z-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400">
                <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                WhatsApp Business oficial
              </div>
              <MetaBadge />
            </div>

            <h2
              id="whatsapp-head"
              className="mb-4 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl lg:text-4xl"
            >
              Mensagens automáticas pela{' '}
              <span className="bg-gradient-to-r from-[#25D366] via-amber-500 to-amber-600 bg-clip-text text-transparent">
                API oficial da Meta
              </span>
            </h2>

            <p className="landing-lead !mt-0 !text-left">
              Filhos de santo recebem avisos de gira, lembretes de mensalidade e confirmações pelo canal{' '}
              <strong className="font-semibold text-slate-900">WhatsApp Business verificado do AxéCloud</strong> —
              templates aprovados, entrega confiável e a cara profissional que a casa merece.
            </p>

            <ul className="mt-8 space-y-4" role="list">
              {benefits.map((item, i) => (
                <motion.li
                  key={item.title}
                  initial={fade.initial}
                  whileInView={fade.whileInView}
                  viewport={fade.viewport}
                  transition={{ ...fade.transition, delay: 0.06 * i }}
                  className="flex items-start gap-3"
                >
                  <LandingIconBox accent="emerald" className="mt-1 shrink-0 !h-8 !w-8">
                    <CheckCircle className={landingIconClass('emerald', 'h-4 w-4')} strokeWidth={2} aria-hidden />
                  </LandingIconBox>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    <p className="text-xs leading-relaxed text-slate-600">{item.desc}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>

          <motion.div
            initial={fade.initial}
            whileInView={fade.whileInView}
            viewport={fade.viewport}
            transition={{ ...fade.transition, delay: 0.1 }}
          >
            <WhatsAppPhoneMock />
          </motion.div>
        </div>
      </motion.div>
    </LandingSection>
  );
}
