import { useEffect, useState } from 'react';
import { AppPageShell } from '../components/app/AppTopNav';
import { SupportDesk } from '../components/support/SupportDesk';
import { useSupportRealtime } from '../hooks/useSupportRealtime';
import { supabase } from '../lib/supabase';
import type { SupportRequester } from '../components/support/SupportIntake';
import { authFetch } from '../lib/authenticatedFetch';
import { SUPPORT_OPEN_TICKET, takeSupportTicket } from '../lib/supportNavigation';

async function supportRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(path, init?.body ? { ...init, headers: { 'Content-Type': 'application/json' } } : init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível acessar o suporte.');
  return data;
}

export default function Support({ userId, requester }: { userId: string; requester: SupportRequester }) {
  const [activityVersion, setActivityVersion] = useState(0);
  useSupportRealtime(supabase, userId, () => setActivityVersion(value => value + 1));
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
    <SupportDesk request={supportRequest} requestedTicket={ticket} requester={requester} activityVersion={activityVersion} />
  </AppPageShell>;
}
