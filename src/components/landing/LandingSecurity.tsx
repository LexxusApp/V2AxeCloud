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
    <section id="seguranca" className="border-y border-slate-200 bg-slate-50 py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="relative order-2 lg:order-1">
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
              <div className="w-full rounded-2xl border border-slate-700/60 bg-slate-800/60 p-6">
                <div className="mb-4 flex items-center gap-2 border-b border-slate-700/60 pb-3.5">
                  <Lock className="h-4 w-4 text-amber-400" aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Protocolo de Sigilo Religioso Axé-Lock
                  </span>
                </div>

                <div className="space-y-3 font-mono text-[10px] text-slate-400">
                  <p className="flex justify-between gap-4">
                    <span>{'>'} ESTADO DO BANCO:</span>
                    <span className="font-bold text-amber-400">100% ENCRIPTADO</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>{'>'} DIRETRIZ LGPD:</span>
                    <span className="text-right text-slate-100">DADOS SENSÍVEIS (ALTA SEGURANÇA)</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>{'>'} BACKUP AUTOMÁTICO:</span>
                    <span className="font-bold text-sky-400">DE HORA EM HORA</span>
                  </p>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 font-sans text-[10px] text-amber-200">
                    Diferente de redes sociais públicas, os dados de assentamentos, obrigações espirituais e
                    fichas litúrgicas nunca são monitorados por sistemas de anúncio ou buscadores como o Google.
                  </div>
                </div>
              </div>

              <div
                className="pointer-events-none absolute -bottom-4 -right-4 -z-10 h-28 w-28 rounded-full bg-amber-500/20 blur-2xl"
                aria-hidden
              />
            </div>
          </div>

          <div className="order-1 space-y-6 lg:order-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
              Inviolabilidade Histórica
            </span>

            <h2 className="font-display text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Seus dados preservados com o máximo sigilo profissional
            </h2>

            <p className="text-sm leading-relaxed text-slate-600 md:text-base">
              Reconhecemos a extrema seriedade que envolve os nomes ritualísticos e preparos internos de terreiros
              tradicionais de matriz africana. O Axé Cloud segue rigorosamente as leis civis de dados (LGPD) sob a
              tutela de dados religiosos extremamente sensíveis.
            </p>

            <div className="space-y-3">
              {SECURITY_POINTS.map((point) => (
                <div key={point.title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{point.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{point.detail}</p>
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
