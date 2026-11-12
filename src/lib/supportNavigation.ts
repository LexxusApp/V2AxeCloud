let pendingTicket: string | null = null;
export const SUPPORT_OPEN_TICKET = 'axecloud:open-support-ticket';

export function openSupportTicket(id: string, navigate?: (tab: string) => void) {
  pendingTicket = id;
  navigate?.('suporte');
  window.dispatchEvent(new Event(SUPPORT_OPEN_TICKET));
}

export function takeSupportTicket() {
  const ticket = pendingTicket;
  pendingTicket = null;
  return ticket;
}
