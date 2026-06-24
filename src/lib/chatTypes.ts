/** Tipos compartilhados — chat interno da corrente. */

export type ChatConversationType = 'direct' | 'group';

export type ChatMessageType = 'text' | 'image' | 'video' | 'audio' | 'system';

export type ChatParticipantType = 'filho' | 'admin';

export type ChatParticipantSummary = {
  userId: string;
  participantType: ChatParticipantType;
  filhoId?: string | null;
  nome: string;
  fotoUrl?: string | null;
  cargo?: string | null;
};

export type ChatConversationSummary = {
  id: string;
  type: ChatConversationType;
  title: string | null;
  tenantId: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageType: ChatMessageType | null;
  unreadCount: number;
  participants: ChatParticipantSummary[];
  /** Outro participante em DM (para exibir na lista). */
  peer?: ChatParticipantSummary | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  tenantId: string;
  senderUserId: string;
  senderFilhoId: string | null;
  senderNome: string;
  senderFotoUrl: string | null;
  body: string | null;
  messageType: ChatMessageType;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaDurationSec: number | null;
  createdAt: string;
  isOwn: boolean;
};

export type ChatContact = {
  filhoId: string;
  userId: string | null;
  nome: string;
  fotoUrl: string | null;
  cargo: string | null;
  status: string | null;
};

export function chatMessagePreview(type: ChatMessageType, body: string | null): string {
  if (type === 'image') return '📷 Foto';
  if (type === 'video') return '🎬 Vídeo';
  if (type === 'audio') return '🎤 Áudio';
  if (type === 'system') return body || 'Mensagem do sistema';
  return (body || '').trim() || 'Mensagem';
}

export function formatChatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
