import { useState, type FormEvent, type Ref } from 'react';
import {
  AlertTriangle, Bell, Building2, ChevronDown, ClipboardList, Headphones,
  HelpCircle, MessageSquareText, Send, Sparkles, UserRound,
} from 'lucide-react';
import { supportCategories, type SupportCategory } from '../../../lib/supportCategories';
import './supportIntake.css';

export type SupportDraft = { category: SupportCategory | ''; subject: string; description: string };
export type SupportRequester = { name?: string | null; house?: string | null };

const faqs = [
  ['Como cadastrar novos médiuns na corrente?', 'Abra Filhos de Santo e clique em Novo filho. Preencha os dados ou envie o link de convite para que o médium complete o cadastro.'],
  ['Os médiuns conseguem ver o saldo geral do caixa?', 'Cada médium acompanha as próprias mensalidades e comprovantes pelo portal. O saldo geral do caixa fica na área da gestão.'],
  ['Como configurar o Pix da casa para receber mensalidades?', 'Acesse Financeiro > Configurações Pix. Informe a chave Pix da casa e ajuste os dados das cobranças.'],
  ['O que fazer se o sistema estiver lento no dia da gira?', 'Abra um chamado com o tipo Giras e presença. Informe o horário, a tela afetada e o impacto na portaria, chamada ou cantina.'],
];

const supportOverview = [
  { label: 'Atendimento Humano', detail: 'Abra um chamado com a equipe AxéCloud.', icon: Headphones, tone: 'green' },
  { label: 'Plantão de Giras', detail: 'Selecione Giras e presença para pedir ajuda.', icon: Sparkles, tone: 'gold' },
  { label: 'Sino de notificações', detail: 'Receba um aviso quando a equipe responder.', icon: Bell, tone: 'blue' },
  { label: 'Meus chamados', detail: 'Consulte protocolo, status e histórico.', icon: ClipboardList, tone: 'purple' },
];

export function SupportIntake({ headingRef, draft, onDraft, requester, busy, error, onSubmit }: {
  headingRef: Ref<HTMLHeadingElement>;
  draft: SupportDraft;
  onDraft: (draft: SupportDraft) => void;
  requester?: SupportRequester;
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return <>
    <ul className="si-overview" aria-label="Informações do atendimento">
      {supportOverview.map(({ label, detail, icon: Icon, tone }) => <li key={label} className={`si-metric si-${tone}`}>
        <span className="si-metric-icon"><Icon size={20} aria-hidden /></span>
        <strong>{label}</strong>
        <p>{detail}</p>
      </li>)}
    </ul>

    <div className="si-layout">
      <section className="si-card si-form" aria-labelledby="support-form-title">
        <header className="si-form-header">
          <span className="si-form-icon"><MessageSquareText size={20} aria-hidden /></span>
          <div>
            <h2 id="support-form-title" ref={headingRef} tabIndex={-1}>Abrir Chamado de Atendimento</h2>
            <p>Conte o que aconteceu. A resposta da equipe fica no próprio chamado.</p>
          </div>
        </header>

        <form onSubmit={onSubmit} className="si-fields">
          {error && <p className="sd-error" role="alert">{error}</p>}

          {(requester?.name || requester?.house) && <dl className="si-pair si-requester">
            {requester.name && <div>
              <dt><UserRound size={15} aria-hidden /> Nome do Zelador(a)</dt>
              <dd>{requester.name}</dd>
            </div>}
            {requester.house && <div>
              <dt><Building2 size={15} aria-hidden /> Nome do Terreiro</dt>
              <dd>{requester.house}</dd>
            </div>}
          </dl>}

          <div className="si-pair">
            <div>
              <label htmlFor="support-category">
                <span><HelpCircle size={15} aria-hidden /> Tipo de Solicitação</span>
              </label>
              <select id="support-category" required value={draft.category} disabled={busy} onChange={event => onDraft({ ...draft, category: event.target.value as SupportDraft['category'] })}>
                <option value="">Selecione um tipo</option>
                {Object.entries(supportCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="support-subject">Assunto</label>
              <input id="support-subject" required minLength={3} maxLength={120} value={draft.subject} disabled={busy} placeholder="Ex. Lista de presença não abre" onChange={event => onDraft({ ...draft, subject: event.target.value })} />
            </div>
          </div>

          <div>
            <label htmlFor="support-description">
              <span><MessageSquareText size={15} aria-hidden /> O que está acontecendo?</span>
            </label>
            <textarea id="support-description" required minLength={5} maxLength={4000} rows={5} value={draft.description} disabled={busy} placeholder="Informe a tela, o que você tentou fazer e o que apareceu." onChange={event => onDraft({ ...draft, description: event.target.value })} />
          </div>

          <button type="submit" className="sd-button is-primary si-submit" disabled={busy}>
            <Send size={16} aria-hidden />
            {busy ? 'Enviando chamado…' : 'Enviar Mensagem para o Suporte'}
          </button>
        </form>
      </section>

      <aside className="si-help" aria-label="Orientações de suporte">
        <section className="si-gira">
          <span><AlertTriangle size={20} aria-hidden /></span>
          <div>
            <h2>Sua Gira Começa Hoje?</h2>
            <p>Selecione Giras e presença e informe o horário e o que a casa precisa resolver para o encontro.</p>
          </div>
        </section>

        <section className="si-card si-faq">
          <h2>Dúvidas Frequentes da Casa</h2>
          <div className="si-questions">
            {faqs.map(([question, answer], index) => {
              const isOpen = openFaq === index;
              return <div key={question} className="si-question">
                <button type="button" aria-expanded={isOpen} aria-controls={`support-faq-${index}`} onClick={() => setOpenFaq(isOpen ? null : index)}>
                  {question}
                  <ChevronDown size={16} aria-hidden />
                </button>
                <p id={`support-faq-${index}`} hidden={!isOpen}>{answer}</p>
              </div>;
            })}
          </div>
        </section>
      </aside>
    </div>
  </>;
}
