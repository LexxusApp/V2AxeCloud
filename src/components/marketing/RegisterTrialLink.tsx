import { TRIAL_DAYS } from '../../../lib/planPricing';
import { appHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

type RegisterTrialLinkProps = {
  className?: string;
  children?: React.ReactNode;
  onNavigate?: () => void;
};

/** CTA trial — navegação completa para /register (fluxo real do sistema). */
export function RegisterTrialLink({ className, children, onNavigate }: RegisterTrialLinkProps) {
  const href = appHref(ROUTES.register);

  return (
    <a
      href={href}
      className={cn(className)}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onNavigate?.();
        window.location.assign(href);
      }}
    >
      {children ?? `Teste ${TRIAL_DAYS} dias grátis`}
    </a>
  );
}
