import { cn } from '../lib/utils';

type Props = {
  /** Overlay extra para spinners / modais (legibilidade). */
  variant?: 'default' | 'dark';
  /** `fixed` na landing; `absolute` nas telas internas. */
  fixed?: boolean;
  className?: string;
};

/**
 * Fundo visual das telas públicas (landing hero, login, cadastro, checkout).
 * Sem imagem de fundo — as artes antigas tinham textura de grade embutida.
 */
export function AuthScreenBackground({ variant = 'default', fixed = false, className = '' }: Props) {
  return (
    <div
      className={cn(
        'pointer-events-none inset-0 z-0 overflow-hidden bg-[#050505]',
        fixed ? 'fixed' : 'absolute',
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c0c0e]/50 via-[#18191c]/92 to-[#050505]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#0a0a0c]/55" />
      <div className="absolute top-1/2 left-1/2 h-[min(100vw,720px)] w-[min(100vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[100px]" />
      <div className="absolute -top-[8%] -left-[10%] h-[min(420px,55vw)] w-[min(420px,55vw)] rounded-full bg-primary/10 blur-[80px]" />
      <div className="absolute bottom-[6%] -right-[8%] h-[min(360px,45vw)] w-[min(360px,45vw)] rounded-full bg-amber-950/25 blur-[80px]" />
      {variant === 'dark' ? <div className="absolute inset-0 bg-black/35" /> : null}
    </div>
  );
}
