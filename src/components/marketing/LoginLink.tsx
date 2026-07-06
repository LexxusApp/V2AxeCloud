import { appHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

type LoginLinkProps = {
  className?: string;
  children?: React.ReactNode;
  onNavigate?: () => void;
};

/** Link Entrar — navegação completa para /entrar (fluxo real do sistema). */
export function LoginLink({ className, children, onNavigate }: LoginLinkProps) {
  const href = appHref(ROUTES.login);

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
      {children ?? 'Entrar'}
    </a>
  );
}
