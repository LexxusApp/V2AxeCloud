import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, LifeBuoy, Plus, RefreshCw, Send } from 'lucide-react';
import './supportDesk.css';

type Ticket = { id: string; subject: string; house_name: string; owner_name: string; status: 'open' | 'closed'; created_at: string; updated_at: string };
type Message = { id: string; author_role: 'owner' | 'support'; body: string; created_at: string };
type Thread = { ticket: Ticket & { description: string }; messages: Message[] };
type Props = {
  admin?: boolean;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  requestedTicket?: { id: string };
};
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const post = (body: object): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

function usePolling<T>(request: Props['request'], path: string | null, revision: number, interval: number) {
  const [result, setResult] = useState<{ path: string; data?: T; error?: string }>();
  useEffect(() => {
    if (!path) return;
    let active = true;
    let busy = false;
    const load = async () => {
      if (busy || document.visibilityState === 'hidden') return;
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
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [path, request, revision, interval]);
  return result?.path === path ? result : undefined;
}

export function SupportDesk({ admin = false, request, requestedTicket }: Props) {
  const base = admin ? '/api/admin-console/support' : '/api/v1/support';
  const [selected, setSelected] = useState<string | null>(requestedTicket?.id || null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const attempt = useRef<{ id: string; draft: string } | undefined>(undefined);
  const log = useRef<HTMLDivElement>(null);
  const list = usePolling<{ tickets: Ticket[]; hasMore: boolean }>(request, base + '?page=' + page, revision, 15_000);
  const conversation = usePolling<Thread>(request, selected ? base + '/' + selected : null, revision, 5_000);
  const thread = conversation?.data;
  const lastMessage = thread?.messages.at(-1)?.id;

  useEffect(() => {
    if (requestedTicket) open(requestedTicket.id);
  }, [requestedTicket]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [thread?.ticket.id, lastMessage]);

  function refresh() { setRevision(value => value + 1); }
  function open(id: string | null, newTicket = false) {
    setSelected(id);
    setCreating(newTicket);
    setError('');
    setReply('');
    attempt.current = undefined;
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy || (creating ? subject.trim().length < 3 || description.trim().length < 5 : !selected || !reply.trim())) return;
    const draft = JSON.stringify(creating ? [subject.trim(), description.trim()] : [selected, reply.trim()]);
    const id = attempt.current?.draft === draft ? attempt.current.id : crypto.randomUUID();
    attempt.current = { id, draft };
    setBusy(true);
    setError('');
    try {
      if (creating) {
        await request(base, post({ id, subject, description }));
        setSubject('');
        setDescription('');
        setPage(0);
        open(id);
      } else {
        await request(base + '/' + selected + '/messages', post({ id, body: reply }));
        setReply('');
      }
      attempt.current = undefined;
      refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível enviar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const detail = creating || Boolean(selected);
  return <section className={'support-desk' + (detail ? ' support-desk-detail' : '')} aria-label="Central de suporte">
    <aside className="support-desk-list" aria-label="Chamados">
      <header className="support-desk-header">
        <h2>{admin ? 'Chamados de suporte' : 'Meus chamados'}</h2>
        <button className="support-desk-action" type="button" aria-label="Atualizar chamados" onClick={refresh}><RefreshCw size={17} /></button>
      </header>
      {!admin && <button className="support-desk-action support-desk-primary" disabled={busy} onClick={() => open(null, true)}>
        <Plus size={18} /> Novo chamado
      </button>}
      {list?.error && <p role="alert">{list.error}</p>}
      {!list?.data?.tickets.length && !list?.error && <p role="status">{list ? 'Nenhum chamado nesta página.' : 'Carregando chamados…'}</p>}
      <ul className="support-desk-tickets">
        {list?.data?.tickets.map(ticket => <li key={ticket.id}>
          <button type="button" aria-current={ticket.id === selected ? 'true' : undefined} disabled={busy} onClick={() => open(ticket.id)}>
            <strong>{ticket.subject}</strong>
            <span>{admin ? ticket.house_name + ' · ' + ticket.owner_name : ticket.status === 'closed' ? 'Encerrado' : 'Aberto'}</span>
            <time dateTime={ticket.updated_at}>{date.format(new Date(ticket.updated_at))}</time>
          </button>
        </li>)}
      </ul>
      {(page > 0 || list?.data?.hasMore) && <nav className="support-desk-pages" aria-label="Páginas de chamados">
        <button className="support-desk-action" disabled={!page} onClick={() => setPage(page - 1)}>Anteriores</button>
        <button className="support-desk-action" disabled={!list?.data?.hasMore} onClick={() => setPage(page + 1)}>Próximos</button>
      </nav>}
    </aside>
    <div className="support-desk-main">
      {detail && <button className="support-desk-back support-desk-action" type="button" disabled={busy} onClick={() => open(null)}>
        <ArrowLeft size={16} /> Chamados
      </button>}
      {creating ? <form className="support-desk-new" onSubmit={send}>
        <h2>Abrir chamado</h2>
        <label>Assunto<input required minLength={3} maxLength={120} value={subject} disabled={busy} onChange={event => setSubject(event.target.value)} /></label>
        <label>O que aconteceu?<textarea required minLength={5} maxLength={4000} rows={6} value={description} disabled={busy} onChange={event => setDescription(event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <button className="support-desk-action support-desk-primary" disabled={busy}>{busy ? 'Abrindo…' : 'Abrir chamado'}</button>
      </form> : selected ? <>
        {conversation?.error && <p className="support-desk-notice" role="alert">{conversation.error} <button className="support-desk-action" onClick={refresh}>Tentar novamente</button></p>}
        {!thread && !conversation?.error && <p className="support-desk-notice" role="status">Carregando conversa…</p>}
        {thread && <>
          <header className="support-desk-thread-title">
            <h2>{thread.ticket.subject}</h2>
            {admin && <p>{thread.ticket.house_name} · {thread.ticket.owner_name}</p>}
          </header>
          <div ref={log} className="support-desk-messages" role="log" aria-label="Mensagens do chamado">
            {[{ id: thread.ticket.id, author_role: 'owner' as const, body: thread.ticket.description, created_at: thread.ticket.created_at }, ...thread.messages].map(message => {
              const support = message.author_role === 'support';
              return <article key={message.id} className={'support-desk-message' + (support === admin ? ' is-own' : '')}>
                <strong>{support ? 'Suporte AxéCloud' : admin ? thread.ticket.owner_name : 'Você'}</strong>
                <p>{message.body}</p>
                <time dateTime={message.created_at}>{date.format(new Date(message.created_at))}</time>
              </article>;
            })}
          </div>
          <form className="support-desk-compose" onSubmit={send}>
            {error && <p role="alert">{error}</p>}
            <label htmlFor="support-reply">Resposta</label>
            <div>
              <textarea id="support-reply" rows={2} value={reply} disabled={busy} maxLength={4000} onChange={event => setReply(event.target.value)} />
              <button className="support-desk-action support-desk-primary" disabled={busy || !reply.trim()}>
                <Send size={17} /> {busy ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </form>
        </>}
      </> : <div className="support-desk-empty"><LifeBuoy size={26} aria-hidden />
        <p>{admin ? 'Selecione um chamado para ler e responder.' : 'Abra um chamado ou selecione uma conversa.'}</p>
      </div>}
    </div>
  </section>;
}
