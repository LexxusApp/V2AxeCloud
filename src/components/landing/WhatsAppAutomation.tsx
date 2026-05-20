import { motion } from 'framer-motion';
import { Bell, CheckCircle, MessageSquare, ShieldCheck } from 'lucide-react';

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
    <section
      id="whatsapp"
      className="relative overflow-hidden border-t border-neutral-900 bg-neutral-950 py-16 sm:py-20"
      aria-labelledby="whatsapp-head"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.08),transparent_55%)]" aria-hidden />

      <motion.div className="container relative mx-auto max-w-5xl px-4 sm:px-6" {...fade}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Integração Direta e Automatizada
            </div>

            <h2
              id="whatsapp-head"
              className="mb-6 text-3xl leading-tight font-extrabold tracking-tight text-white md:text-4xl"
            >
              Conecte o WhatsApp do seu Terreiro e{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
                automatize tudo.
              </span>
            </h2>

            <p className="mb-8 leading-relaxed text-neutral-400">
              Chega de perder tempo digitando mensagens de cobrança ou lembretes uma por uma. Conecte o número do
              seu terreiro via QR Code em segundos e deixe o AxéCloud trabalhar por você, mantendo a comunidade
              informada com total respeito.
            </p>

            <ul className="space-y-4" role="list">
              {benefits.map((item, i) => (
                <motion.li
                  key={item.title}
                  initial={fade.initial}
                  whileInView={fade.whileInView}
                  viewport={fade.viewport}
                  transition={{ ...fade.transition, delay: 0.06 * i }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-1 rounded-md bg-emerald-500/10 p-1 text-emerald-400">
                    <CheckCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="text-xs leading-relaxed text-neutral-400">{item.desc}</p>
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
            className="relative mx-auto w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-2xl backdrop-blur-sm"
          >
            <div className="pointer-events-none absolute top-0 right-0 p-3 text-emerald-500/20" aria-hidden>
              <MessageSquare className="-mr-10 -mt-10 h-32 w-32" />
            </div>

            <div className="mb-6 flex items-center gap-3 border-b border-neutral-800 pb-4">
              <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" aria-hidden />
              <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase">
                Status do Módulo de Mensagens
              </span>
            </div>

            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center">
              <div className="mb-4 rounded-full border border-neutral-800 bg-neutral-900 p-4 text-neutral-400">
                <Bell className="h-8 w-8 animate-bounce" aria-hidden />
              </div>
              <h3 className="mb-1 text-sm font-bold text-white">Pronto para Conectar</h3>
              <p className="mx-auto mb-4 max-w-[240px] text-xs leading-relaxed text-neutral-400">
                Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e aponte a câmera para o painel.
              </p>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-medium text-neutral-400"
              >
                Gerar QR Code de Conexão
              </button>
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-neutral-400">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500/60" aria-hidden />
              Conexão criptografada e segura através de API dedicada.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
