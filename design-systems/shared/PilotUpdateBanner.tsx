import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { authFetch } from '../../src/lib/authenticatedFetch';
import './pilot-update.css';

type PilotVersion = {
  buildId?: string;
};

type Props = {
  buildId: string;
  versionUrl: string;
};

const CHECK_INTERVAL_MS = 45_000;

function dismissKey(buildId: string): string {
  return `axecloud_pilot_update_dismiss_${buildId}`;
}

export default function PilotUpdateBanner({ buildId, versionUrl }: Props) {
  const [remoteBuildId, setRemoteBuildId] = useState('');
  const [applying, setApplying] = useState(false);

  const checkVersion = useCallback(async () => {
    try {
      const target = new URL(versionUrl, window.location.origin);
      target.searchParams.set('check', Date.now().toString(36));
      const response = await authFetch(target, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const payload = await response.json() as PilotVersion;
      const candidate = String(payload.buildId || '').trim();
      if (!candidate || candidate === buildId) {
        setRemoteBuildId('');
        return;
      }
      if (sessionStorage.getItem(dismissKey(candidate)) !== '1') {
        setRemoteBuildId(candidate);
      }
    } catch {
      // Sem conexão: o sistema atual continua disponível e tenta novamente depois.
    }
  }, [buildId, versionUrl]);

  useEffect(() => {
    void checkVersion();
    const interval = window.setInterval(() => void checkVersion(), CHECK_INTERVAL_MS);
    const onFocus = () => void checkVersion();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkVersion();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkVersion]);

  if (!remoteBuildId) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissKey(remoteBuildId), '1');
    } catch {
      // A atualização pode ser fechada mesmo sem armazenamento disponível.
    }
    setRemoteBuildId('');
  };

  const apply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      await authFetch('/api/pilot/refresh', { method: 'POST', cache: 'no-store' });
    } catch {
      // O parâmetro de versão abaixo ainda força a navegação para o bundle novo.
    }
    const target = new URL(window.location.href);
    target.searchParams.set('__axe_pilot_build', remoteBuildId);
    window.location.replace(`${target.pathname}${target.search}${target.hash}`);
  };

  return (
    <aside className="pilot-update" role="status" aria-live="polite" aria-label="Atualização do AxéCloud disponível">
      <RefreshCw className={applying ? 'pilot-update-spinning' : ''} aria-hidden />
      <p><strong>Nova versão disponível.</strong><span>Atualize para receber as últimas correções.</span></p>
      <button type="button" className="pilot-update-action" onClick={() => void apply()} disabled={applying} aria-busy={applying}>
        {applying ? 'Atualizando…' : 'Atualizar'}
      </button>
      <button type="button" className="pilot-update-dismiss" onClick={dismiss} disabled={applying} aria-label="Lembrar depois">
        <X aria-hidden />
      </button>
    </aside>
  );
}
