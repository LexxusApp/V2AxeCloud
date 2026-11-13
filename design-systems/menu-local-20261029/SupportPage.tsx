import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, LifeBuoy, MessageCircle, Plus, Search } from 'lucide-react';
import { supportCategories } from '../../lib/supportCategories';
import {
  post, protocol, useSupportQuery, type Status, type SupportDraft, type SupportRequester,
  type SupportRequest, type Thread, type Ticket, type TicketList,
} from '../../src/components/support/supportData';
import { WorkflowDialog, WorkflowEmpty, textMatch } from './WorkflowUI';
import { localDate } from './completion';
import './completion.css';
import './support-page.css';

const articles=[
 {id:'member',topic:'Corrente',title:'Como cadastrar e acompanhar um membro?',intro:'O perfil reúne os dados e a trajetória do filho da casa.',steps:['Abra Filhos de Santo e escolha Novo membro.','Informe os dados e salve o cadastro.','Abra o perfil para revisar informações, compromissos e mensalidades.'],tab:'children',action:'Abrir corrente'},
 {id:'monthly',topic:'Financeiro',title:'Qual a diferença entre pendência e valor recebido?',intro:'Uma cobrança em aberto ainda não compõe o saldo em caixa.',steps:['Acesse Mensalidades para acompanhar as cobranças pendentes.','Abra os detalhes e confira membro e valor antes de dar baixa.','O recebimento confirmado passa a aparecer no Financeiro, na data da baixa.'],tab:'financial-mensalidades',action:'Ver mensalidades'},
 {id:'book',topic:'Financeiro',title:'Onde conferir os itens anotados na cantina?',intro:'A comanda guarda itens e quantidades antes da anotação.',steps:['Monte a comanda e selecione o membro.','Anote na caderneta e abra o extrato do membro.','Dê baixa somente quando receber o pagamento; então o valor entra no caixa.'],tab:'financial-cantina',action:'Abrir cantina'},
 {id:'private',topic:'Biblioteca',title:'Como reservar um PDF para um único filho?',intro:'O acervo privado exige um destinatário específico.',steps:['Na Biblioteca, adicione um material e selecione Acervo privado.','Escolha o filho destinatário e o PDF. Salve o material.','O PDF reservado fica disponível apenas à zeladoria e ao filho escolhido, enquanto ele estiver ativo na casa.'],tab:'library',action:'Abrir biblioteca'},
 {id:'radar',topic:'Radar',title:'O que fica público no Radar?',intro:'O perfil para visitantes é separado da gestão interna.',steps:['Confira o texto, contato, cidade e orientações do perfil.','Revise se deseja exibir o endereço e quais atendimentos estão disponíveis.','Abra a página pública. Os dados de membros e o acervo privado não entram nesta apresentação.'],tab:'radar',action:'Revisar Radar'},
 {id:'access',topic:'Conta',title:'Esqueci meu acesso. O que posso fazer?',intro:'A recuperação real pertence ao fluxo seguro de autenticação.',steps:['Confira se você está usando o e-mail da conta correta.','Na tela de entrada, use Esqueci minha senha.','Se precisar de ajuda, abra um pedido de suporte; nunca envie senha ou dados bancários.'],tab:'settings',action:'Ver acesso e conta'},
 {id:'pix',topic:'Financeiro',title:'Onde configurar a contribuição e a chave Pix?',intro:'A configuração da casa fica separada do histórico já criado.',steps:['Abra Financeiro e Configurações Pix.','Revise chave, nome do recebedor, contribuição e vencimento.','Salve e confira os dados do recebedor antes de orientar um pagamento.'],tab:'financial-configs',action:'Ver configurações Pix'},
 {id:'gira',topic:'Giras',title:'Como organizar o próximo encontro?',intro:'A agenda e a preparação usam os mesmos encontros cadastrados.',steps:['Crie uma gira com data, horário e local.','Confira confirmações da corrente e as tarefas de preparação.','Revise os avisos antes de enviar. As preferências do WhatsApp controlam os lembretes automáticos.'],tab:'calendar',action:'Abrir agenda'},
];

const base = '/api/v1/support';
const pageSize = 12;
const emptyDraft: SupportDraft = { category: 'duvida', subject: '', description: '' };

function TicketStatus({ ticket }: { ticket: Ticket }) {
  if (ticket.status === 'closed') return <span className="finish-status positive">Encerrado</span>;
  return <span className="finish-status neutral">
    {ticket.waiting_on === 'owner' ? 'Aguardando sua resposta' : 'Aguardando suporte'}
  </span>;
}

export default function SupportPage({ request, requester, requestedTicket, activityVersion, onNavigate }: {
  request: SupportRequest;
  requester?: SupportRequester;
  requestedTicket?: { id: string };
  activityVersion: number;
  onNavigate: (id: string) => void;
}) {
  const [view, setView] = useState<'help' | 'tickets'>(requestedTicket ? 'tickets' : 'help');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('Todos');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [article, setArticle] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(requestedTicket?.id ?? null);
  const [draft, setDraft] = useState(emptyDraft);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const ticketHeading = useRef<HTMLHeadingElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const returningToList = useRef(false);
  const createAttempt = useRef<{ payload: string; id: string }>(undefined);
  const replyAttempt = useRef<{ payload: string; id: string }>(undefined);

  const allPath = base + '?page=0&limit=' + pageSize;
  const listPath = filter === 'all' && page === 0 ? allPath
    : base + '?page=' + page + '&limit=' + pageSize + (filter === 'all' ? '' : '&status=' + filter);
  const refreshVersion = revision + activityVersion;
  const all = useSupportQuery<TicketList>(request, allPath, refreshVersion, 15_000).result;
  const filtered = useSupportQuery<TicketList>(request, view === 'tickets' && listPath !== allPath ? listPath : null, refreshVersion, 15_000).result;
  const list = listPath === allPath ? all : filtered;
  const conversation = useSupportQuery<Thread>(request, ticket ? base + '/' + ticket : null, refreshVersion, 7_500);
  const thread = conversation.result?.data;

  const item = articles.find(entry => entry.id === article);
  const shown = articles.filter(entry => (topic === 'Todos' || entry.topic === topic)
    && textMatch(entry.title + ' ' + entry.intro + ' ' + entry.topic, query));

  useEffect(() => {
    if (!requestedTicket) return;
    setFormOpen(false);
    setArticle(null);
    setView('tickets');
    setTicket(requestedTicket.id);
    setReply('');
    setError('');
    replyAttempt.current = undefined;
  }, [requestedTicket]);

  useEffect(() => {
    if (page && list?.data && list.data.tickets.length === 0) {
      setPage(Math.max(0, Math.ceil(list.data.total / pageSize) - 1));
    }
  }, [list?.data, page]);

  useEffect(() => {
    if (!ticket && !returningToList.current) return;
    const frame = window.requestAnimationFrame(() => {
      const heading = ticket ? ticketHeading.current : listHeading.current;
      if (heading) {
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: 'start' });
      }
      returningToList.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ticket]);

  function refresh() {
    setRevision(value => value + 1);
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      refresh();
      setBusy(false);
    }
  }

  function openTicket(id: string | null) {
    if (id === null) returningToList.current = true;
    setTicket(id);
    setReply('');
    setError('');
    replyAttempt.current = undefined;
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const payload = { category: draft.category, subject: draft.subject.trim(), description: draft.description.trim() };
    if (!payload.category || payload.subject.length < 3 || payload.description.length < 5) {
      setError('Informe a categoria, o assunto e descreva o que aconteceu.');
      return;
    }
    void run(async () => {
      const fingerprint = JSON.stringify(payload);
      if (createAttempt.current?.payload !== fingerprint) createAttempt.current = { payload: fingerprint, id: crypto.randomUUID() };
      const result = await request<{ id: string }>(base, post({ ...payload, id: createAttempt.current.id }));
      createAttempt.current = undefined;
      setDraft(emptyDraft);
      setFormOpen(false);
      setView('tickets');
      setFilter('all');
      setPage(0);
      openTicket(result.id);
    });
  }

  function sendReply(event: FormEvent) {
    event.preventDefault();
    const body = reply.trim();
    if (!thread || thread.ticket.status === 'closed' || !body) return;
    void run(async () => {
      if (replyAttempt.current?.payload !== body) replyAttempt.current = { payload: body, id: crypto.randomUUID() };
      await request(base + '/' + thread.ticket.id + '/messages', post({ id: replyAttempt.current.id, body }));
      replyAttempt.current = undefined;
      setReply('');
    });
  }

  function changeStatus() {
    if (!thread) return;
    void run(async () => {
      const { id, status, updated_at } = thread.ticket;
      const result = await request<{ ticket: Thread['ticket'] }>(base + '/' + id + '/status',
        post({ status: status === 'open' ? 'closed' : 'open', updatedAt: updated_at }));
      conversation.replace({ ...thread, ticket: result.ticket });
    });
  }

  if (ticket) return <section className="finish-page support-local support-thread" aria-labelledby="support-thread-title">
    <button type="button" className="wf-button secondary support-thread-back" disabled={busy} onClick={() => openTicket(null)}>
      <ArrowLeft size={17} aria-hidden /> Voltar para Meus pedidos
    </button>
    <div className="support-thread-panel">
      <header className="support-thread-header">
        <div>
          <h2 id="support-thread-title" ref={ticketHeading} tabIndex={-1}>{thread?.ticket.subject ?? 'Pedido de ajuda'}</h2>
          {thread && <p>{protocol(thread.ticket)} · {thread.ticket.category && <>{supportCategories[thread.ticket.category]} · </>}
            <time dateTime={thread.ticket.created_at}>{localDate(thread.ticket.created_at)}</time> · Brasília
          </p>}
        </div>
        {thread && <TicketStatus ticket={thread.ticket} />}
      </header>
      {!conversation.result && <p role="status">Carregando pedido…</p>}
      {conversation.result?.error && <p className="wf-error" role="alert">{conversation.result.error} <button type="button" className="finish-link" onClick={refresh}>Tentar novamente</button></p>}
      {thread && <div className="support-ticket-detail">
        <section className="support-thread-summary" aria-label="Descrição do pedido">
          <h3>Descrição do pedido</h3>
          <p>{thread.ticket.description}</p>
        </section>
        <section className="support-thread-history" aria-label="Histórico do atendimento">
          <h3>Histórico do atendimento</h3>
          {!thread.messages.length && <p className="support-thread-empty">Nenhuma mensagem no histórico.</p>}
          <ol className="support-message-history" aria-live="polite">
            {thread.messages.map(message => <li key={message.id}>
              <small>{message.author_role === 'support' ? 'Equipe AxéCloud' : 'Você'} · <time dateTime={message.created_at}>{localDate(message.created_at)}</time> · Brasília</small>
              <p>{message.body}</p>
            </li>)}
          </ol>
        </section>
        {thread.ticket.status === 'open' && <form className="support-thread-reply" onSubmit={sendReply}>
          <label className="wf-field">Complementar pedido
            <textarea required maxLength={4000} disabled={busy} value={reply} onChange={event => setReply(event.target.value)} />
          </label>
          <button className="wf-button secondary" disabled={busy || !reply.trim()}>{busy ? 'Processando…' : 'Enviar complemento ao suporte'}</button>
        </form>}
        {error && <p className="wf-error" role="alert">{error}</p>}
        <button type="button" className="finish-link" disabled={busy} onClick={changeStatus}>
          {thread.ticket.status === 'open' ? 'Encerrar acompanhamento' : 'Reabrir acompanhamento'}
        </button>
      </div>}
    </div>
  </section>;

  return <div className="finish-page support-local">
    <section className="support-opening">
      <LifeBuoy size={34} aria-hidden />
      <div>
        <h2>Vamos encontrar<br /><span>o próximo passo.</span></h2>
        <p>Explore orientações rápidas ou organize um pedido de ajuda para a casa.</p>
      </div>
      <label className="support-search">
        <Search size={21} aria-hidden />
        <input aria-label="Buscar ajuda" value={query} onChange={event => { setQuery(event.target.value); setView('help'); }} placeholder="Como podemos ajudar?" />
      </label>
      <small>Orientações e histórico de pedidos da sua casa.</small>
    </section>

    <div className="support-workspace">
      <aside className="support-index">
        <div className="finish-tabs" role="group" aria-label="Área de suporte">
          <button type="button" aria-pressed={view === 'help'} onClick={() => setView('help')}>Orientações</button>
          <button type="button" aria-pressed={view === 'tickets'} onClick={() => setView('tickets')}>
            Meus pedidos {all?.data && <span>{all.data.total}</span>}
          </button>
        </div>
        <div className="support-contact">
          <MessageCircle size={26} aria-hidden />
          <h3>Não encontrou a resposta?</h3>
          <p>Descreva o que aconteceu e o resultado que esperava. Evite senhas, documentos pessoais e dados bancários.</p>
          <button type="button" className="wf-button" onClick={() => { setError(''); setFormOpen(true); }}><Plus size={17} aria-hidden />Novo pedido de ajuda</button>
          <small>Atendimento dentro do AxéCloud</small>
        </div>
      </aside>
      <section className="support-content">
        {view === 'help' ? <>
          <div className="finish-section-head"><div><h3>Um pouco de orientação ajuda.</h3><p>Guias curtos ligados às áreas do sistema.</p></div></div>
          <div className="finish-filter-chips" role="group" aria-label="Assunto da ajuda">
            {['Todos', 'Corrente', 'Financeiro', 'Biblioteca', 'Radar', 'Conta', 'Giras'].map(value =>
              <button type="button" key={value} aria-pressed={topic === value} onClick={() => setTopic(value)}>{value}</button>)}
          </div>
          {shown.length ? <div className="support-articles">{shown.map(entry =>
            <button type="button" key={entry.id} onClick={() => setArticle(entry.id)}>
              <BookOpen size={20} aria-hidden /><span><small>{entry.topic}</small><strong>{entry.title}</strong><span>{entry.intro}</span></span><ChevronRight size={19} aria-hidden />
            </button>)}</div> : <WorkflowEmpty title="Nenhuma orientação encontrada." text="Tente outro termo, selecione Todos ou registre um pedido de ajuda." />}
        </> : <>
          <div className="finish-section-head">
            <div><h3 ref={listHeading} tabIndex={-1}>Seu histórico de pedidos</h3><p>Abra um pedido para acompanhar o status e as respostas da equipe.</p></div>
            <label>Situação
              <select value={filter} onChange={event => { setFilter(event.target.value as Status | 'all'); setPage(0); }}>
                <option value="all">Todos</option><option value="open">Abertos</option><option value="closed">Encerrados</option>
              </select>
            </label>
          </div>
          {!list && <p role="status">Carregando pedidos…</p>}
          {list?.error && <p className="wf-error" role="alert">{list.error} <button type="button" className="finish-link" onClick={refresh}>Tentar novamente</button></p>}
          {list?.data && (list.data.tickets.length ? <>
            <div className="support-tickets">
              {list.data.tickets.map(entry => <button type="button" key={entry.id} onClick={() => openTicket(entry.id)}>
                <TicketStatus ticket={entry} />
                <strong>{entry.subject}</strong>
                <span>{protocol(entry)}</span>
                <span><time dateTime={entry.created_at}>{localDate(entry.created_at)}</time> · Brasília</span>
                <ArrowRight size={18} aria-hidden />
              </button>)}
            </div>
            {(page > 0 || list.data.hasMore) && <nav className="support-order-pages" aria-label="Páginas de pedidos">
              <button type="button" className="wf-button secondary" disabled={!page} onClick={() => setPage(value => value - 1)}>Anterior</button>
              <span>Página {page + 1}</span>
              <button type="button" className="wf-button secondary" disabled={!list.data.hasMore} onClick={() => setPage(value => value + 1)}>Próxima</button>
            </nav>}
          </> : <WorkflowEmpty title="Nenhum pedido neste filtro." text="Ao registrar uma dúvida, assunto e descrição ficam disponíveis aqui." />)}
        </>}
      </section>
    </div>
    <p className="finish-note">Os pedidos enviados ficam salvos na conta. O sino avisa quando a equipe responder.</p>

    <WorkflowDialog overlayClassName="support-dialog-overlay" contentClassName="support-dialog" open={!!article} onOpenChange={open => { if (!open) setArticle(null); }} title={item?.title ?? 'Orientação'} description={item?.intro ?? ''}>
      {item && <div className="support-guide">
        <ol>{item.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <button type="button" className="wf-button" onClick={() => { setArticle(null); onNavigate(item.tab); }}>{item.action}<ArrowRight size={17} aria-hidden /></button>
      </div>}
    </WorkflowDialog>

    <WorkflowDialog overlayClassName="support-dialog-overlay" contentClassName="support-dialog" open={formOpen} onOpenChange={open => { if (!busy) setFormOpen(open); }} title="Organizar um pedido de ajuda" description="A equipe responde dentro deste pedido. Confira os dados antes de enviar.">
      <form onSubmit={send} className="support-request-form">
        {requester?.name && <label className="wf-field">Zelador(a) / responsável<input readOnly value={requester.name} /></label>}
        {requester?.house && <label className="wf-field">Nome do terreiro<input readOnly value={requester.house} /></label>}
        <label className="wf-field">Categoria do pedido
          <select required value={draft.category} disabled={busy} onChange={event => setDraft({ ...draft, category: event.target.value as SupportDraft['category'] })}>
            {Object.entries(supportCategories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label className="wf-field">Assunto
          <input required minLength={3} maxLength={120} value={draft.subject} disabled={busy} onChange={event => setDraft({ ...draft, subject: event.target.value })} />
        </label>
        <label className="wf-field">O que aconteceu?
          <textarea required minLength={5} maxLength={4000} value={draft.description} disabled={busy} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Qual área você usou, o que tentou fazer e o que apareceu?" />
        </label>
        {error && <p className="wf-error" role="alert">{error}</p>}
        <button className="wf-button" disabled={busy}>{busy ? 'Enviando pedido…' : 'Enviar pedido ao suporte'}<Check size={17} aria-hidden /></button>
      </form>
    </WorkflowDialog>

  </div>;
}
