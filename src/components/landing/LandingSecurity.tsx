import { Check, Lock } from 'lucide-react';

const SECURITY_POINTS = [
  {
    title: 'Sem publicidade ou cookies rastreadores',
    detail: 'Seus dados nunca serão expostos ou mercantilizados por anunciantes terceiros.',
  },
  {
    title: 'Backup Em Nuvem Redundante',
    detail:
      'Segurança física com servidores duplicados localizados confidencialmente na América Latina.',
  },
  {
    title: 'Exportação Completa de Dados',
    detail:
      'Você é dono da sua própria história. Exporte relatórios ou todas as listas em PDF e Excel com apenas um clique.',
  },
] as const;

export function LandingSecurity() {
  return (
    <section id="seguranca" className="border-t border-[#1E242B] bg-[#0B0F13] py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="relative order-2 lg:order-1">
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border border-[#1E242B] bg-[#13171D] p-8">
              <div className="w-full rounded-2xl border border-[#1E242B] bg-[#12161A] p-6 shadow-xl">
                <div className="mb-4 flex items-center gap-2 border-b border-[#1E242B] pb-3.5">
                  <Lock className="h-4 w-4 text-emerald-400" aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
                    Protocolo de Sigilo Religioso Axé-Lock
                  </span>
                </div>

                <div className="space-y-3 font-mono text-[10px] text-[#94A3B8]">
                  <p className="flex justify-between gap-4">
                    <span>{'>'} ESTADO DO BANCO:</span>
                    <span className="font-bold text-emerald-400">100% ENCRIPTADO</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>{'>'} DIRETRIZ LGPD:</span>
                    <span className="text-right text-[#F1F5F9]">DADOS SENSÍVEIS (ALTA SEGURANÇA)</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>{'>'} BACKUP AUTOMÁTICO:</span>
                    <span className="font-bold text-sky-400">DE HORA EM HORA</span>
                  </p>
                  <div className="rounded-lg border border-emerald-950 bg-emerald-950/40 p-2.5 font-sans text-[10px] text-emerald-300">
                    Diferente de redes sociais públicas, os dados de assentamentos, obrigações espirituais e
                    fichas litúrgicas nunca são monitorados por sistemas de anúncio ou buscadores como o Google.
                  </div>
                </div>
              </div>

              <div
                className="pointer-events-none absolute -bottom-4 -right-4 -z-10 h-28 w-28 rounded-full bg-[#FACC15]/10 blur-2xl"
                aria-hidden
              />
            </div>
          </div>

          <div className="order-1 space-y-6 lg:order-2">
            <span className="block text-xs font-bold uppercase tracking-widest text-[#FACC15]">
              Inviolabilidade Histórica
            </span>

            <h2 className="font-display text-3xl font-black tracking-tight text-[#F1F5F9] md:text-4xl">
              Seus dados preservados com o máximo sigilo profissional
            </h2>

            <p className="text-sm font-light leading-relaxed text-[#94A3B8] md:text-base">
              Reconhecemos a extrema seriedade que envolve os nomes ritualísticos e preparos internos de terreiros
              tradicionais de matriz africana. O Axé Cloud segue rigorosamente as leis civis de dados (LGPD) sob a
              tutela de dados religiosos extremamente sensíveis.
            </p>

            <div className="space-y-4">
              {SECURITY_POINTS.map((point) => (
                <div key={point.title} className="flex gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-800/50 bg-emerald-950/60 text-emerald-300">
                    <Check className="h-3 w-3" aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#F1F5F9]">{point.title}</h3>
                    <p className="text-xs text-[#94A3B8]">{point.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
