import { TRIAL_DAYS } from '../../../lib/planPricing';
import { appHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { trackConversionEvent } from '../../lib/trackConversion';

type RegisterTrialLinkProps = {
  className?: string;
  children?: React.ReactNode;
  onNavigate?: () => void;
  ctaId?: string;
};

/** CTA trial — navegação completa para /register (fluxo real do sistema). */
export function RegisterTrialLink({ className, children, onNavigate, ctaId = 'trial-register' }: RegisterTrialLinkProps) {
  const href = appHref(ROUTES.register);

  return (
    <a
      href={href}
      className={cn(className)}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        void trackConversionEvent('cta_click', {
          ctaId,
          ctaLabel: typeof children === 'string' ? children : 'Teste grátis',
        });
        onNavigate?.();
        window.location.assign(href);
      }}
    >
      {children ?? `Teste ${TRIAL_DAYS} dias grátis`}
    </a>
  );
}
