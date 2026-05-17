const base = import.meta.env.BASE_URL || '/';
const BG_DESKTOP = `${base}login-bg-desktop.png`;
const BG_PREMIUM = `${base}login-bg-premium.png`;

type Props = {
  /** Overlay mais escuro (sessão expirada, loading). */
  variant?: 'default' | 'dark';
  className?: string;
};

/** Fundo fotográfico das telas de auth/checkout — `<img>` evita falha de CSS url() com CSP/PWA. */
export function AuthScreenBackground({ variant = 'default', className = '' }: Props) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`} aria-hidden>
      <picture className="absolute inset-0 block h-full w-full">
        <source media="(min-width: 1024px)" srcSet={BG_DESKTOP} />
        <img
          src={BG_PREMIUM}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-center brightness-[0.92]"
        />
      </picture>
      <div
        className={
          variant === 'dark'
            ? 'absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/85'
            : 'absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/55'
        }
      />
    </div>
  );
}
