import { cn } from '../lib/utils';
import { LANDING_HERO_IMAGE } from '../constants/landingBackground';

type Props = {
  /** Overlay extra para spinners / modais (legibilidade). */
  variant?: 'default' | 'dark';
  /** `fixed` na landing; `absolute` nas telas internas. */
  fixed?: boolean;
  className?: string;
};

/**
 * Fundo visual idêntico à landing — usado em login, checkout, cadastro e loading do app.
 */
export function AuthScreenBackground({ variant = 'default', fixed = false, className = '' }: Props) {
  return (
    <div
      className={cn(
        'pointer-events-none inset-0 z-0 overflow-hidden',
        fixed ? 'fixed' : 'absolute',
        className
      )}
      aria-hidden
    >
      <img
        src={LANDING_HERO_IMAGE}
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
      <div className="absolute top-1/2 left-1/2 h-[min(100vw,720px)] w-[min(100vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[100px]" />
      <div className="landing-grid-faint absolute inset-0 opacity-60" />
      {variant === 'dark' ? <div className="absolute inset-0 bg-black/35" /> : null}
    </div>
  );
}
