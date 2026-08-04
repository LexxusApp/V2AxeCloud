import { useEffect, useState } from 'react';
import { ArrowRight, CircleHelp, Sparkles, X } from 'lucide-react';
import {
  FILHO_GUIDE_FEATURES,
  FILHO_OPEN_GUIDE_EVENT,
  FILHO_WELCOME_SEEN_KEY,
} from '../../constants/filhoGuide';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../lib/browserCapabilities';
import { cn } from '../../lib/utils';

type FilhoWelcomeGuideProps = {
  onNavigate: (tab: string) => void;
};

export function FilhoWelcomeGuide({ onNavigate }: FilhoWelcomeGuideProps) {
  const [open, setOpen] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    const seen = safeLocalStorageGet(FILHO_WELCOME_SEEN_KEY) === '1';
    if (!seen) {
      setIsFirstVisit(true);
      setOpen(true);
    }

    const onOpenRequest = () => {
      setIsFirstVisit(false);
      setOpen(true);
    };
    window.addEventListener(FILHO_OPEN_GUIDE_EVENT, onOpenRequest);
    return () => window.removeEventListener(FILHO_OPEN_GUIDE_EVENT, onOpenRequest);
  }, []);

  const markSeen = () => {
    safeLocalStorageSet(FILHO_WELCOME_SEEN_KEY, '1');
    setIsFirstVisit(false);
  };

  const close = () => {
    markSeen();
    setOpen(false);
  };

  const goTo = (tab: string) => {
    markSeen();
    setOpen(false);
    onNavigate(tab);
  };

  if (!open) return null;

  return (
    <div className="filho-welcome-overlay" role="presentation">
      <button type="button" className="filho-welcome-backdrop" aria-label="Fechar guia" onClick={close} />
      <div
        className="filho-welcome-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filho-welcome-title"
      >
        <header className="filho-welcome-sheet__header">
          <div>
            <p>
              <Sparkles aria-hidden /> AxéCloud · portal do membro
            </p>
            <h2 id="filho-welcome-title">
              {isFirstVisit ? 'Bem-vindo à sua corrente' : 'O que você pode fazer aqui'}
            </h2>
            <p className="filho-welcome-sheet__lead">
              {isFirstVisit
                ? 'Em poucos toques você acompanha a casa. Veja o que existe no app:'
                : 'Toque em uma função para abrir. Você pode reabrir este guia quando quiser.'}
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Fechar" className="filho-welcome-sheet__close">
            <X aria-hidden />
          </button>
        </header>

        <ul className="filho-welcome-sheet__grid">
          {FILHO_GUIDE_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.tab}>
                <button
                  type="button"
                  onClick={() => goTo(feature.tab)}
                  className={cn('filho-welcome-feature', `is-${feature.tone}`)}
                >
                  <span>
                    <Icon aria-hidden />
                  </span>
                  <strong>{feature.label}</strong>
                  <small>{feature.detail}</small>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="filho-welcome-sheet__login-tip">
          <CircleHelp aria-hidden />
          <span>
            Para entrar de novo: <strong>Membro</strong> → Registro (AXC-…) + 6 primeiros dígitos do CPF.
          </span>
        </div>

        <footer className="filho-welcome-sheet__footer">
          <button type="button" className="is-secondary" onClick={close}>
            Explorar depois
          </button>
          <button type="button" className="is-primary" onClick={() => goTo('profile')}>
            Começar pelo que importa agora
            <ArrowRight aria-hidden />
          </button>
        </footer>
      </div>
    </div>
  );
}
