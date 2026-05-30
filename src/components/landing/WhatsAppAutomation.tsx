import { motion } from 'framer-motion';
import { Bell, CheckCircle, MessageSquare, ShieldCheck } from 'lucide-react';
import { LandingSection } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

const benefits = [
  {
    title: 'Avisos automáticos de Giras e Eventos',
    desc: 'Seus filhos de santo recebem o cronograma e chamadas direto no celular.',
  },
  {
    title: 'Lembrete amigável de Mensalidades',
    desc: 'O sistema notifica automaticamente quando uma contribuição via PIX estiver próxima do vencimento.',
  },
  {
    title: 'Confirmações de Recibo em Tempo Real',
    desc: 'Assim que o pagamento cai na sua conta Efí, o filho de santo recebe o comprovante no WhatsApp na mesma hora.',
  },
] as const;

export function WhatsAppAutomation() {
  return (
    <LandingSection id="whatsapp" variant="alt" aria-labelledby="whatsapp-head">
      <motion.div className="landing-section-inner" {...fade}>
        <div className="relative z-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Integração automatizada
            </div>

            <h2
              id="whatsapp-head"
              className="mb-4 text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl"
            >
              Conecte o WhatsApp do terreiro e{' '}
              <span className="text-primary">automatize a rotina</span>
            </h2>

            <p className="landing-lead !mt-0 !text-left">
              Chega de perder tempo digitando mensagens de cobrança ou lembretes uma por uma. Conecte o número da casa
              via QR Code e deixe o AxéCloud informar a comunidade com respeito.
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
                  <div className="mt-1 rounded-lg border border-primary/20 bg-primary/10 p-1.5 text-primary">
                    <CheckCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="text-xs leading-relaxed text-zinc-500">{item.desc}</p>
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
            className="landing-device-frame mx-auto w-full max-w-md"
          >
            <div className="landing-device-chrome">
              <span className="landing-device-dot bg-red-500/90" aria-hidden />
              <span className="landing-device-dot bg-amber-400/90" aria-hidden />
              <span className="landing-device-dot bg-emerald-500/70" aria-hidden />
              <span className="landing-device-url">WhatsApp · módulo de mensagens</span>
            </div>
            <div className="relative p-6">
              <div className="pointer-events-none absolute top-2 right-2 text-emerald-500/15" aria-hidden>
                <MessageSquare className="h-28 w-28" />
              </div>
              <div className="mb-5 flex items-center gap-2 border-b border-white/10 pb-4">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Pronto para conectar
                </span>
              </div>
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/40 p-6 text-center">
                <div className="mb-4 rounded-full border border-white/10 bg-white/[0.04] p-4 text-zinc-400">
                  <Bell className="h-8 w-8" aria-hidden />
                </div>
                <h3 className="text-sm font-bold text-white">QR Code no painel</h3>
                <p className="mx-auto mt-2 max-w-[240px] text-xs leading-relaxed text-zinc-500">
                  Abra o WhatsApp no celular, vá em Aparelhos conectados e aponte a câmera para o zelador.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 cursor-not-allowed rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-500"
                >
                  Gerar QR Code de conexão
                </button>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary/70" aria-hidden />
                Conexão criptografada via API dedicada.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </LandingSection>
  );
}
