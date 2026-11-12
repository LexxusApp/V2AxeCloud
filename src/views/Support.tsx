import { useEffect, useState } from 'react';
import { AppPageShell } from '../components/app/AppTopNav';
import { AxePageHeader } from '../components/shared/AxePageScaffold';
import { SupportDesk } from '../components/support/SupportDesk';
import { authFetch } from '../lib/authenticatedFetch';
import { SUPPORT_OPEN_TICKET, takeSupportTicket } from '../lib/supportNavigation';

async function supportRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(path, init?.body ? { ...init, headers: { 'Content-Type': 'application/json' } } : init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível acessar o suporte.');
  return data;
}

export default function Support() {
  const [ticket, setTicket] = useState<{ id: string }>();
  useEffect(() => {
    const open = () => {
      const id = takeSupportTicket();
      if (id) setTicket({ id });
    };
    open();
    window.addEventListener(SUPPORT_OPEN_TICKET, open);
    return () => window.removeEventListener(SUPPORT_OPEN_TICKET, open);
  }, []);
  return <AppPageShell>
    <div className="space-y-6">
      <AxePageHeader title="Suporte" description="Abra um chamado e acompanhe as respostas da equipe AxéCloud." />
      <SupportDesk request={supportRequest} requestedTicket={ticket} />
    </div>
  </AppPageShell>;
}
