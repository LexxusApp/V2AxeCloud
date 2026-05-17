import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

const STEPS = [
  { id: 1, label: 'Dados da Casa', short: 'Casa' },
  { id: 2, label: 'Ativação do Sistema', short: 'Pagamento' },
] as const;

type Props = {
  currentStep: 1 | 2;
  /** `light` no formulário de registro; `dark` no checkout EFI. */
  variant?: 'light' | 'dark';
  className?: string;
};

export function RegistrationProgress({ currentStep, variant = 'light', className }: Props) {
  const isDark = variant === 'dark';
  const progressPct = currentStep === 1 ? 50 : 100;

  return (
    <nav aria-label="Progresso do cadastro" className={cn('mb-6', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.14em]',
            isDark ? 'text-[#b8bbc4]' : 'text-zinc-500'
          )}
        >
          Passo {currentStep} de 2
        </p>
        <p className={cn('text-[11px] font-medium', isDark ? 'text-white/50' : 'text-zinc-400')}>
          {currentStep === 1 ? 'Quase lá — falta só ativar' : 'Última etapa'}
        </p>
      </div>

      <div
        className={cn('h-1.5 w-full overflow-hidden rounded-full', isDark ? 'bg-white/10' : 'bg-zinc-200')}
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progressPct}% do cadastro`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            isDark ? 'bg-[#f2b90f]' : 'bg-amber-500'
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="mt-4 flex items-start justify-between gap-2">
        {STEPS.map((step) => {
          const done = currentStep > step.id;
          const active = currentStep === step.id;

          return (
            <li
              key={step.id}
              className={cn('flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center', step.id === 1 && 'items-start sm:items-center')}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-colors',
                  done && (isDark ? 'bg-[#f2b90f] text-black' : 'bg-amber-500 text-black'),
                  active &&
                    !done &&
                    (isDark
                      ? 'bg-[#f2b90f] text-black ring-2 ring-[#f2b90f]/40'
                      : 'bg-amber-500 text-black ring-2 ring-amber-500/25'),
                  !done &&
                    !active &&
                    (isDark ? 'border border-white/20 bg-white/5 text-white/40' : 'border border-zinc-200 bg-zinc-50 text-zinc-400')
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : step.id}
              </span>
              <span
                className={cn(
                  'hidden text-[11px] font-bold leading-tight sm:block',
                  active && (isDark ? 'text-white' : 'text-zinc-900'),
                  done && !active && (isDark ? 'text-[#f2b90f]/90' : 'text-amber-800'),
                  !done && !active && (isDark ? 'text-white/45' : 'text-zinc-400')
                )}
              >
                {step.label}
              </span>
              <span
                className={cn(
                  'text-[10px] font-bold leading-tight sm:hidden',
                  active && (isDark ? 'text-white' : 'text-zinc-900'),
                  done && !active && (isDark ? 'text-[#f2b90f]/90' : 'text-amber-800'),
                  !done && !active && (isDark ? 'text-white/45' : 'text-zinc-400')
                )}
              >
                {step.short}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
