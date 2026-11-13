import { useEffect, useState } from 'react';
import type { SupportCategory } from '../../../lib/supportCategories';

export type SupportRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
export type SupportRequester = { name?: string | null; house?: string | null };
export type SupportDraft = { category: SupportCategory | ''; subject: string; description: string };

export type Status = 'open' | 'closed';
export type Ticket = {
  id: string; protocol: number; subject: string; house_name: string; owner_name: string;
  status: Status; waiting_on: 'owner' | 'support'; created_at: string; updated_at: string;
};
export type Message = { id: string; author_role: 'owner' | 'support'; body: string; created_at: string };
export type Thread = { ticket: Ticket & { description: string; category: SupportCategory | null }; messages: Message[] };
export type TicketList = { tickets: Ticket[]; total: number; hasMore: boolean };

export const protocol = (ticket: Ticket) => 'AX-' + String(ticket.protocol).padStart(6, '0');
export const post = (body: object): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export function useSupportQuery<T>(request: SupportRequest, path: string | null, revision: number, interval: number) {
  const [result, setResult] = useState<{ path: string; data?: T; error?: string }>();
  useEffect(() => {
    if (!path) return;
    let active = true;
    let busy = false;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const data = await request<T>(path);
        if (active) setResult({ path, data });
      } catch (error) {
        if (active) setResult(current => ({ path, data: current?.path === path ? current.data : undefined,
          error: error instanceof Error ? error.message : 'Não foi possível carregar. Tente novamente.' }));
      } finally {
        busy = false;
      }
    };
    void load();
    const timer = window.setInterval(load, interval);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [path, request, revision, interval]);
  return {
    result: result?.path === path ? result : undefined,
    replace: (data: T) => { if (path) setResult({ path, data }); },
  };
}
