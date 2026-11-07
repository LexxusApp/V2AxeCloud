// Standalone demonstration data. This module never contacts the real chat service.
export type LocalMessage = { id: string; sender: 'self' | string; body: string; date: string; state: 'local' | 'sent' | 'failed'; attachment?: File; media?: {url:string;type:string;mime?:string} };
export type LocalConversation = { id: string; kind: 'direct' | 'group'; title: string; memberIds: string[]; unread: boolean; archived: boolean; messages: LocalMessage[]; historyCursor?:{date:string;id:string}; hasMore?:boolean; created: string };
export type MessageDraft = { body: string; attachment?: File };
export type LocalInbox = { conversations: LocalConversation[]; drafts: Record<string, MessageDraft> };
const message = (id: string, sender: string, body: string, date: string): LocalMessage => ({ id, sender, body, date, state: 'local' });
export const demoInbox: LocalInbox = { drafts: {}, conversations: [
  { id: 'chat-mariana', kind: 'direct', title: '', memberIds: ['demo-1'], unread: false, archived: false, created: '2026-10-28T17:10:00-03:00', messages: [
    message('mariana-1', 'demo-1', 'Boa tarde! Onde consigo conferir a agenda dos próximos encontros?', '2026-10-28T17:10:00-03:00'),
    message('mariana-2', 'self', 'Boa tarde, Mariana! A agenda está na área de Giras. Lá você encontra a data e o horário de cada encontro.', '2026-10-28T17:15:00-03:00'),
    message('mariana-3', 'demo-1', 'Bom dia! Encontrei a agenda e já confirmei a minha participação. Obrigada pelo cuidado.', '2026-10-29T09:38:00-03:00'),
    message('mariana-4', 'self', 'Bom dia! Que bom. Qualquer dúvida sobre a organização, pode falar por aqui. Axé!', '2026-10-29T09:40:00-03:00'),
  ] },
  { id: 'chat-joana', kind: 'direct', title: '', memberIds: ['demo-3'], unread: true, archived: false, created: '2026-10-29T09:10:00-03:00', messages: [message('joana-1', 'demo-3', 'Bom dia! Posso ajudar na organização do nosso próximo encontro?', '2026-10-29T09:10:00-03:00')] },
  { id: 'chat-rafael', kind: 'direct', title: '', memberIds: ['demo-6'], unread: true, archived: false, created: '2026-10-28T18:20:00-03:00', messages: [message('rafael-1', 'demo-6', 'Atualizei meus dados no perfil. Quando puder, confira se está tudo certo.', '2026-10-28T18:20:00-03:00')] },
  { id: 'chat-corrente', kind: 'group', title: 'Organização da corrente', memberIds: ['demo-1', 'demo-3', 'demo-5', 'demo-6', 'demo-7', 'demo-8'], unread: false, archived: false, created: '2026-10-27T16:00:00-03:00', messages: [
    message('grupo-1', 'self', 'Este grupo de demonstração reúne a organização dos encontros da casa. Vamos manter as orientações num só lugar.', '2026-10-27T16:00:00-03:00'),
    message('grupo-2', 'demo-5', 'Combinado! Vou acompanhar os avisos por aqui.', '2026-10-28T16:40:00-03:00'),
  ] },
] };
export const unreadConversations = (state: LocalInbox) => state.conversations.filter(c => c.unread && !c.archived).length;
export const latestMessageDate = (c: LocalConversation) => c.messages.at(-1)?.date || c.created;
export const chatTime = (stamp: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(stamp));
export const chatDay = (stamp: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(stamp));
export const chatShortDate = (stamp: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(stamp));
