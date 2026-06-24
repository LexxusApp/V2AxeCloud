import { Lock } from 'lucide-react';
import type { ChatContact } from '../../lib/chatTypes';
import { cn } from '../../lib/utils';

type ChatContactRowProps = {
  contact: ChatContact;
  unread?: number;
  disabled?: boolean;
  onClick: () => void;
  avatarSize?: 'sm' | 'md';
};

export function ChatContactRow({
  contact,
  unread = 0,
  disabled = false,
  onClick,
  avatarSize = 'md',
}: ChatContactRowProps) {
  const canChat = contact.canChat !== false && !!contact.userId;
  const avatarClass = avatarSize === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';

  const handleClick = () => {
    if (!canChat) {
      const registro = contact.matricula ? ` Registro: ${contact.matricula}.` : '';
      alert(
        `${contact.nome} ainda não entrou no app.${registro} Peça para acessar em axecloud.com.br/entrar → Entrar como filho de santo (registro + 3 primeiros dígitos do CPF).`,
      );
      return;
    }
    onClick();
  };

  return (
    <button
      type="button"
      disabled={disabled && canChat}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        canChat ? 'hover:bg-white/5' : 'cursor-pointer opacity-80 hover:bg-white/[0.03]',
        disabled && canChat && 'disabled:opacity-50',
      )}
    >
      {contact.fotoUrl ? (
        <img
          src={contact.fotoUrl}
          alt=""
          className={cn('shrink-0 rounded-full object-cover', avatarClass)}
        />
      ) : (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-white',
            avatarClass,
          )}
        >
          {contact.nome.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{contact.nome}</p>
        {canChat ? (
          contact.cargo ? (
            <p className="truncate text-[10px] text-[#64748B]">{contact.cargo}</p>
          ) : null
        ) : (
          <p className="truncate text-[10px] font-semibold text-amber-400/90">
            Sem login no app
            {contact.matricula ? ` · ${contact.matricula}` : ''}
          </p>
        )}
      </div>
      {!canChat ? (
        <Lock className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
      ) : unread > 0 ? (
        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-black">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </button>
  );
}
