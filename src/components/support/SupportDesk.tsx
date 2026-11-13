import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, Inbox, LifeBuoy, RefreshCw, RotateCcw, UserRound } from 'lucide-react';
import { post, protocol, useSupportQuery, type Status, type Ticket, type Thread, type TicketList, type SupportRequest } from './supportData';
import { supportCategories } from '../../../lib/supportCategories';
import './supportDesk.css';

type Props = {
  admin?: boolean;
  request: SupportRequest;
  requestedTicket?: { id: string };
  activityVersion?: number;
};

const pageSize = 12;
const day = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
function StatusBadge({ ticket, admin }: { ticket: Ticket; admin: boolean }) {
  if (ticket.status === 'closed') return <span className="sd-badge is-closed"><Check size={14} /> Finalizado</span>;
  const owner = ticket.waiting_on === 'owner';
  return <span className={'sd-badge ' + (owner ? 'is-owner' : 'is-support')}>
    {owner ? <ArrowDownRight size={14} /> : <Clock3 size={14} />}
    {owner ? admin ? 'Aguardando zelador' : 'Aguardando sua resposta' : admin ? 'Aguardando equipe' : 'Aguardando suporte'}
  </span>;
}

function TicketTable({ tickets, admin, open }: { tickets: Ticket[]; admin: boolean; open: (id: string) => void }) {
  return <table className="sd-table" role="table" aria-label="Chamados">
    <thead role="rowgroup"><tr role="row"><th scope="col">Assunto</th><th scope="col">Protocolo</th><th scope="col">Abertura</th><th scope="col">Última atualização</th><th scope="col">Status</th><th scope="col"><span className="sd-sr">Ações</span></th></tr></thead>
    <tbody role="rowgroup">{tickets.map(ticket => <tr role="row" key={ticket.id}>
      <th scope="row"><button className="sd-subject" onClick={() => open(ticket.id)}>{ticket.subject}</button>
        {admin && <span className="sd-house">{ticket.house_name} · {ticket.owner_name}</span>}
      </th>
      <td className="sd-code">{protocol(ticket)}</td>
      <td className="sd-table-date"><time dateTime={ticket.created_at}>{day.format(new Date(ticket.created_at))}</time></td>
      <td className="sd-table-updated"><time dateTime={ticket.updated_at}>{day.format(new Date(ticket.updated_at))}</time></td>
      <td className="sd-table-status"><StatusBadge ticket={ticket} admin={admin} /></td>
      <td className="sd-table-action"><button className="sd-icon" type="button" aria-label={'Abrir chamado ' + protocol(ticket)} onClick={() => open(ticket.id)}><ArrowRight size={17} /></button></td>
    </tr>)}</tbody>
  </table>;
}

export function SupportDesk({ admin = false, request, requestedTicket, activityVersion = 0 }: Props) {
  const base = admin ? '/api/admin-console/support' : '/api/v1/support';
  const [selected, setSelected] = useState<string | null>(requestedTicket?.id || null);
  const [filter, setFilter] = useState<Status>('open');
  const [page, setPage] = useState(0);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [revision, setRevision] = useState(0);
  const attempt = useRef<{ id: string; draft: string } | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const moveFocus = useRef(false);
  const showingList = !selected;
  const list = useSupportQuery<TicketList>(request, showingList ? base + '?status=' + filter + '&page=' + page + '&limit=' + pageSize : null, revision + activityVersion, 15_000).result;
  const conversation = useSupportQuery<Thread>(request, selected ? base + '/' + selected : null, revision + activityVersion, 7_500);
  const thread = conversation.result?.data;

  useEffect(() => { if (requestedTicket) open(requestedTicket.id); }, [requestedTicket]);
  useEffect(() => {
    if (!moveFocus.current || !heading.current) return;
    moveFocus.current = false;
    heading.current.focus();
  }, [selected, thread?.ticket.id]);
  useEffect(() => {
    if (page && list?.data && list.data.tickets.length === 0) setPage(Math.max(0, Math.ceil(list.data.total / pageSize) - 1));
  }, [list?.data, page]);

  function refresh() { setRevision(value => value + 1); }
  function open(id: string | null) {
    moveFocus.current = true;
    setSelected(id);
    setConfirmClose(false);
    setError('');
    setReply('');
    attempt.current = undefined;
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy || !thread || thread.ticket.status === 'closed' || !reply.trim()) return;
    const fingerprint = JSON.stringify([selected, reply.trim()]);
    const id = attempt.current?.draft === fingerprint ? attempt.current.id : crypto.randomUUID();
    attempt.current = { id, draft: fingerprint };
    setBusy(true);
    setError('');
    try {
      await request(base + '/' + selected + '/messages', post({ id, body: reply }));
      setReply('');
      attempt.current = undefined;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível enviar. Tente novamente.');
    } finally {
      refresh();
      setBusy(false);
    }
  }

  async function updateStatus(status: Status) {
    if (!thread || busy) return;
    setError('');
    setBusy(true);
    try {
      const result = await request<{ ticket: Thread['ticket'] }>(base + '/' + thread.ticket.id + '/status', post({ status, updatedAt: thread.ticket.updated_at }));
      conversation.replace({ ...thread, ticket: result.ticket });
      setConfirmClose(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o chamado.');
    } finally {
      refresh();
      setBusy(false);
    }
  }

  return <section className="support-desk" aria-label="Central de suporte">
    {showingList ? <>
      <header className="sd-heading">
        <h2 ref={heading} tabIndex={-1}>{admin ? 'Chamados de suporte' : 'Meus chamados'}</h2>
      </header>
      <div className="sd-panel">
        <div className="sd-toolbar">
          <div className="sd-filters" role="group" aria-label="Filtrar chamados">
            <button type="button" aria-pressed={filter === 'open'} onClick={() => { setPage(0); setFilter('open'); }}><Inbox size={16} /> Em aberto</button>
            <button type="button" aria-pressed={filter === 'closed'} onClick={() => { setPage(0); setFilter('closed'); }}><Check size={16} /> Finalizados</button>
          </div>
          <button className="sd-icon" type="button" aria-label="Atualizar chamados" onClick={refresh}><RefreshCw size={16} /></button>
        </div>
        {list?.error && <p className="sd-feedback" role="alert">{list.error}</p>}
        {!list && <p className="sd-feedback" role="status">Carregando chamados…</p>}
        {list?.data && (list.data.tickets.length ? <>
          <TicketTable tickets={list.data.tickets} admin={admin} open={open} />
          <nav className="sd-pagination" aria-label="Páginas de chamados">
            <span>{page * pageSize + 1}–{page * pageSize + list.data.tickets.length} de {list.data.total}</span>
            <div>
              <button className="sd-icon" aria-label="Página anterior" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button>
              <button className="sd-icon" aria-label="Próxima página" disabled={!list.data.hasMore} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button>
            </div>
          </nav>
        </> : <div className="sd-empty"><Inbox size={25} aria-hidden /><strong>{filter === 'open' ? 'Nenhum chamado em aberto' : 'Nenhum chamado finalizado'}</strong>
        </div>)}
      </div>
    </> : <>
        <button className="sd-back" type="button" disabled={busy} onClick={() => open(null)}><ArrowLeft size={16} /> {admin ? 'Todos os chamados' : 'Meus chamados'}</button>
        {conversation.result?.error && <p className="sd-feedback" role="alert">{conversation.result.error} <button className="sd-button" onClick={refresh}>Tentar novamente</button></p>}
        {!thread && !conversation.result?.error && <p className="sd-feedback" role="status">Carregando chamado…</p>}
        {thread && <>
          <header className="sd-heading sd-detail-heading">
            <div><h2 ref={heading} tabIndex={-1}>Chamado <span className="sd-protocol">{protocol(thread.ticket)}</span></h2>
              <StatusBadge ticket={thread.ticket} admin={admin} /></div>
            {thread.ticket.status === 'closed'
              ? <button type="button" className="sd-button" disabled={busy} onClick={() => void updateStatus('open')}><RotateCcw size={16} /> Reabrir chamado</button>
              : <button type="button" className="sd-button" aria-expanded={confirmClose} disabled={busy} onClick={() => setConfirmClose(!confirmClose)}><Check size={17} /> Finalizar chamado</button>}
          </header>
          {confirmClose && thread.ticket.status === 'open' && <div className="sd-confirm sd-panel">
            <p>Finalizar este chamado? Você poderá reabri-lo se precisar continuar o atendimento.</p>
            <div className="sd-actions"><button type="button" className="sd-button" disabled={busy} onClick={() => setConfirmClose(false)}>Cancelar</button>
              <button type="button" className="sd-button is-primary" disabled={busy} onClick={() => void updateStatus('closed')}>Confirmar finalização</button></div>
          </div>}
          {error && <p className="sd-error" role="alert">{error}</p>}
          <section className="sd-panel sd-summary" aria-label="Dados do chamado">
            <h3>{thread.ticket.subject}</h3>
            <dl>
              <div><dt>Aberto em</dt><dd>{dateTime.format(new Date(thread.ticket.created_at))}</dd></div>
              <div><dt>Última atualização</dt><dd>{dateTime.format(new Date(thread.ticket.updated_at))}</dd></div>
              <div><dt>Terreiro</dt><dd>{thread.ticket.house_name}</dd></div>
              {thread.ticket.category && <div><dt>Tipo de solicitação</dt><dd>{supportCategories[thread.ticket.category]}</dd></div>}
              {admin && <div><dt>Solicitante</dt><dd>{thread.ticket.owner_name}</dd></div>}
            </dl>
          </section>
          <section className="sd-panel" aria-label="Histórico do atendimento">
            <header className="sd-history-header"><h3>Histórico do atendimento</h3></header>
            <ol className="sd-history" aria-live="polite">
              {[{ id: 'initial', author_role: 'owner' as const, body: thread.ticket.description, created_at: thread.ticket.created_at }, ...thread.messages].map(message => {
                const support = message.author_role === 'support';
                return <li className={'sd-entry' + (support ? ' is-team' : '')} key={message.id}>
                  <span className="sd-avatar" aria-hidden>{support ? <LifeBuoy size={18} /> : <UserRound size={18} />}</span>
                  <article><header><strong>{support ? 'Equipe AxéCloud' : admin ? thread.ticket.owner_name : 'Você'}</strong>
                    <time dateTime={message.created_at}>{dateTime.format(new Date(message.created_at))}</time></header>
                    <p>{message.body}</p>
                  </article>
                </li>;
              })}
            </ol>
            {thread.ticket.status === 'open' && <form className="sd-compose" onSubmit={send}>
              <label htmlFor="support-reply">{admin ? 'Responder ao chamado' : 'Adicionar mensagem'}</label>
              <textarea id="support-reply" rows={3} value={reply} disabled={busy} maxLength={4000} placeholder="Escreva sua mensagem…" onChange={event => setReply(event.target.value)} />
              <div className="sd-actions"><button className="sd-button is-primary" disabled={busy || !reply.trim()}>{busy ? 'Enviando…' : 'Enviar mensagem'} <ArrowRight size={17} /></button></div>
            </form>}
          </section>
        </>}
    </>}
  </section>;
}
