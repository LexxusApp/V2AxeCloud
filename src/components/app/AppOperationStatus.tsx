import { useSyncExternalStore } from 'react';
import { LoaderCircle } from 'lucide-react';
import { pendingAppOperations, subscribeAppOperations } from '../../lib/appOperations';

export function AppOperationStatus() {
  const count = useSyncExternalStore(subscribeAppOperations, pendingAppOperations, () => 0);
  if (!count) return null;
  return <div className="modern-operation" role="status" aria-live="polite"><LoaderCircle size={17} aria-hidden="true"/><span>{count === 1 ? 'Processando sua solicitação…' : `Processando ${count} solicitações…`}</span><div className="modern-operation-track" role="progressbar" aria-label="Solicitação em andamento"><span/></div></div>;
}
