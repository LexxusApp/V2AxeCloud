import * as Dialog from '@radix-ui/react-dialog';
import { Check, CheckCheck, ChevronRight, MessageCircle, X } from 'lucide-react';
import './notification-center.css';

export type HouseNotification = { id: string; title: string; description: string; time: string; tab: string; read: boolean; ticketId?: string };
type ChatAlert = { id: string; title: string; body: string; count: number; date?: string | null };
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: HouseNotification[];
  chatAlerts: ChatAlert[];
  chatError?: string;
  onRefreshChat: () => void;
  onRead: (ids: string[]) => void;
  readSyncFailed?: boolean;
  onRetryRead?: () => void;
  onNavigate: (tab: string) => void;
  onOpenConversation: (id: string) => void;
  onOpenTicket: (id: string) => void;
  focus?: { onOpenAutoFocus: () => void; onCloseAutoFocus: (event: Event) => void };
};
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default function NotificationCenter(p: Props) {
  const unreadNotices = p.notifications.filter(row => !row.read);
  const unread = unreadNotices.length + p.chatAlerts.length;

  function openNotice(row: HouseNotification) {
    if (!row.read) p.onRead([row.id]);
    p.onOpenChange(false);
    if (row.ticketId) p.onOpenTicket(row.ticketId);
    else p.onNavigate(row.tab);
  }

  return <Dialog.Root open={p.open} onOpenChange={p.onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content {...p.focus} className="dialog notice-dialog">
        <div className="dialog-heading">
          <Dialog.Title>Notificações</Dialog.Title>
          <Dialog.Close asChild><button className="icon-button" aria-label="Fechar notificações"><X size={20} /></button></Dialog.Close>
        </div>
        <Dialog.Description>
          {unread ? `${unread} ${unread === 1 ? 'notificação não lida' : 'notificações não lidas'} da sua casa.` : 'Nenhuma notificação não lida da sua casa.'}
        </Dialog.Description>
        {p.readSyncFailed && <p className="notice-read-error" role="status">
          Leituras pendentes de sincronização. <button type="button" className="text-button" onClick={p.onRetryRead}>Tentar novamente</button>
        </p>}
        <div className="chat-alerts">
          {p.chatError && <p role="status">{p.chatError}<button className="text-button" onClick={p.onRefreshChat}>Tentar novamente</button></p>}
          {p.chatAlerts.map(alert => <button key={alert.id} className="notice-row" onClick={() => {
            p.onOpenChange(false);
            p.onOpenConversation(alert.id);
          }}>
            <MessageCircle size={20} />
            <span>
              <strong>{alert.title} · {alert.count} {alert.count === 1 ? 'mensagem não lida' : 'mensagens não lidas'}</strong>
              <p>{alert.body}</p>
              <time dateTime={alert.date || undefined}>{alert.date ? dateFormat.format(new Date(alert.date)) : ''}</time>
            </span>
            <ChevronRight size={17} />
          </button>)}
        </div>
        {unreadNotices.length > 0 && <button type="button" className="text-button read-all" onClick={() => {
          p.onRead(unreadNotices.map(row => row.id));
          p.onOpenChange(false);
        }}>
          <CheckCheck size={16} /><span>Marcar avisos como lidos</span>
        </button>}
        {p.notifications.map(row => <div key={row.id} className={`notice-item ${row.read ? 'read' : ''}`}>
          <button type="button" className={`notice-row ${row.read ? 'read' : ''}`} onClick={() => openNotice(row)}>
            <span className="notice-point" />
            <span><strong>{row.title}</strong><p>{row.description}</p><time>{row.time}</time></span>
            <ChevronRight size={17} />
          </button>
          {!row.read && <button type="button" className="notice-mark-one" onClick={() => p.onRead([row.id])}>
            <Check size={14} /><span>Marcar como lida</span>
          </button>}
        </div>)}
        {!p.notifications.length && !p.chatAlerts.length && !p.chatError && <p className="notice-empty" role="status">Nenhum aviso para acompanhar agora.</p>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
