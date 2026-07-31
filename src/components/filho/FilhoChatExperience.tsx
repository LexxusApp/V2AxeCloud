import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Avatar from '../Avatar';
import { ChatThread } from '../chat/ChatThread';
import type { ChatContact, ChatConversationSummary } from '../../lib/chatTypes';
import { formatChatTime } from '../../lib/chatTypes';

type Props = {
  tenantId: string;
  userId: string;
  conversations: ChatConversationSummary[];
  contacts: ChatContact[];
  selected: ChatConversationSummary | null;
  selectedId: string | null;
  loading: boolean;
  creating: boolean;
  showNewChat: boolean;
  contactSearch: string;
  totalUnread: number;
  onSelect: (id: string | null) => void;
  onToggleNewChat: () => void;
  onContactSearch: (value: string) => void;
  onTalkToLeader: () => void;
  onTalkToContact: (filhoId: string) => void;
  onMessageSent: () => void;
  onRead: (conversationId: string) => void;
};

function conversationTitle(conversation: ChatConversationSummary) {
  return conversation.type === 'group'
    ? conversation.title || 'Corrente'
    : conversation.peer?.nome || 'Conversa';
}

export default function FilhoChatExperience({
  tenantId,
  userId,
  conversations,
  contacts,
  selected,
  selectedId,
  loading,
  creating,
  showNewChat,
  contactSearch,
  totalUnread,
  onSelect,
  onToggleNewChat,
  onContactSearch,
  onTalkToLeader,
  onTalkToContact,
  onMessageSent,
  onRead,
}: Props) {
  const leaderConversation = conversations.find((conversation) => (
    conversation.type === 'direct' && conversation.peer?.participantType === 'admin'
  ));
  const recent = conversations.filter((conversation) => conversation.id !== leaderConversation?.id);

  return (
    <motion.div
      className={`filho-chat-page ${selectedId ? 'has-open-chat' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className="filho-chat-hero">
        <div className="filho-chat-hero__copy">
          <span><Sparkles /> Comunicação da corrente</span>
          <h1>Conversa que<br /><em>aproxima a casa.</em></h1>
          <p>Fale com a liderança, tire dúvidas e mantenha contato com seus irmãos de caminhada.</p>
        </div>
        <button type="button" onClick={leaderConversation ? () => onSelect(leaderConversation.id) : onTalkToLeader} disabled={creating}>
          <span><ShieldCheck /></span>
          <span>
            <small>Canal da liderança</small>
            <strong>{leaderConversation ? 'Continuar conversa' : 'Falar com o zelador'}</strong>
            <em>{leaderConversation?.lastMessagePreview || 'Um espaço direto e reservado com a casa'}</em>
          </span>
          <ChevronRight />
        </button>
        <div className="filho-chat-hero__status">
          <Bell />
          <span><strong>{totalUnread}</strong>{totalUnread === 1 ? 'mensagem não lida' : 'mensagens não lidas'}</span>
        </div>
      </header>

      <section className={`filho-chat-workspace ${selectedId ? 'has-selection' : ''}`}>
        <aside className="filho-chat-inbox">
          <header>
            <div>
              <span>Seu espaço</span>
              <h2>Conversas</h2>
            </div>
            <button type="button" onClick={onToggleNewChat}><Plus /> Nova</button>
          </header>

          {showNewChat ? (
            <div className="filho-chat-new">
              <div className="filho-chat-new__heading">
                <button type="button" onClick={onToggleNewChat}><ArrowLeft /></button>
                <div><span>Nova conversa</span><strong>Quem você procura?</strong></div>
              </div>
              <button type="button" className="filho-chat-new__leader" onClick={onTalkToLeader} disabled={creating}>
                <span><ShieldCheck /></span>
                <div><strong>Liderança da casa</strong><small>Fale diretamente com o zelador</small></div>
                <ChevronRight />
              </button>
              <label>
                <Search />
                <input value={contactSearch} onChange={(event) => onContactSearch(event.target.value)} placeholder="Buscar irmão ou irmã" />
              </label>
              <div className="filho-chat-contacts">
                {contacts.map((contact) => (
                  <button
                    type="button"
                    key={contact.filhoId}
                    onClick={() => onTalkToContact(contact.filhoId)}
                    disabled={creating || contact.canChat === false}
                  >
                    <Avatar src={contact.fotoUrl} name={contact.nome} shape="circle" textSize="text-xs" className="h-10 w-10" />
                    <span><strong>{contact.nome}</strong><small>{contact.cargo || 'Irmão(ã) da corrente'}</small></span>
                    <MessageCircle />
                  </button>
                ))}
                {!contacts.length ? <p>Nenhuma pessoa encontrada.</p> : null}
              </div>
            </div>
          ) : (
            <div className="filho-chat-conversations">
              {loading ? (
                <div className="filho-chat-loading"><Loader2 /></div>
              ) : conversations.length ? (
                <>
                  {leaderConversation ? (
                    <button
                      type="button"
                      className={`is-leader ${selectedId === leaderConversation.id ? 'is-active' : ''}`}
                      onClick={() => onSelect(leaderConversation.id)}
                    >
                      <span className="filho-chat-conversation__avatar"><ShieldCheck /></span>
                      <span className="filho-chat-conversation__copy">
                        <span><strong>Liderança da casa</strong><small>{formatChatTime(leaderConversation.lastMessageAt)}</small></span>
                        <p>{leaderConversation.lastMessagePreview || 'Canal direto com a casa'}</p>
                      </span>
                      {leaderConversation.unreadCount ? <b>{leaderConversation.unreadCount}</b> : null}
                    </button>
                  ) : null}
                  {recent.map((conversation) => {
                    const title = conversationTitle(conversation);
                    return (
                      <button
                        type="button"
                        key={conversation.id}
                        className={selectedId === conversation.id ? 'is-active' : ''}
                        onClick={() => onSelect(conversation.id)}
                      >
                        {conversation.type === 'group' ? (
                          <span className="filho-chat-conversation__avatar is-group"><Users /></span>
                        ) : (
                          <Avatar src={conversation.peer?.fotoUrl} name={title} shape="circle" textSize="text-xs" className="h-11 w-11" />
                        )}
                        <span className="filho-chat-conversation__copy">
                          <span><strong>{title}</strong><small>{formatChatTime(conversation.lastMessageAt)}</small></span>
                          <p>{conversation.lastMessagePreview || 'Conversa iniciada'}</p>
                        </span>
                        {conversation.unreadCount ? <b>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</b> : null}
                      </button>
                    );
                  })}
                </>
              ) : (
                <div className="filho-chat-empty">
                  <div aria-hidden><span /><MessageCircle /><span /></div>
                  <span>Seu espaço está pronto</span>
                  <h3>A primeira conversa começa aqui.</h3>
                  <p>Fale com a liderança ou encontre alguém da corrente.</p>
                  <button type="button" onClick={onToggleNewChat}>Iniciar conversa</button>
                </div>
              )}
            </div>
          )}
        </aside>

        <main className="filho-chat-stage">
          {selected ? (
            <div className="filho-chat-thread">
              <ChatThread
                conversation={selected}
                tenantId={tenantId}
                userId={userId}
                onBack={() => onSelect(null)}
                onMessageSent={onMessageSent}
                onRead={() => onRead(selected.id)}
              />
            </div>
          ) : (
            <div className="filho-chat-welcome">
              <div className="filho-chat-welcome__symbol" aria-hidden>
                <span /><MessageCircle /><span />
              </div>
              <span>Central de acolhimento</span>
              <h2>Escolha uma conversa.</h2>
              <p>Suas mensagens ficam reunidas aqui para você continuar de onde parou.</p>
              <div>
                <span><ShieldCheck /></span>
                <p><strong>Conversa protegida</strong><small>Somente os participantes têm acesso às mensagens.</small></p>
              </div>
            </div>
          )}
        </main>
      </section>
    </motion.div>
  );
}
