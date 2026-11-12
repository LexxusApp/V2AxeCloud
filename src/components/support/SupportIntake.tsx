import type { FormEvent } from 'react';
import { ArrowRight, BookOpen, ChevronDown, ClipboardList, LifeBuoy, Radio } from 'lucide-react';
import { supportCategories, type SupportCategory } from '../../../lib/supportCategories';
import './supportIntake.css';

export type SupportDraft = { category: SupportCategory | ''; subject: string; description: string };
export type SupportRequester = { name?: string | null; house?: string | null };

const faqs = [
  ['Como cadastrar um membro da corrente?', 'Abra Filhos de Santo e selecione Novo filho. Preencha os dados ou use o convite disponível na área de cadastro.'],
  ['O que os membros veem no Financeiro?', 'Cada membro acompanha as próprias mensalidades e comprovantes pelo seu portal.'],
  ['Onde configuro o Pix das mensalidades?', 'Em Financeiro, abra Configurações Pix para cadastrar a chave da casa e ajustar os dados das cobranças.'],
  ['O que informar se houver um problema durante uma gira?', 'Escolha Giras e presença e informe qual gira está acontecendo, em que tela o problema aparece e o que ficou impedido de fazer.'],
];

export function SupportIntake({ draft, onDraft, requester, busy, error, onSubmit }: {
  draft: SupportDraft;
  onDraft: (draft: SupportDraft) => void;
  requester?: SupportRequester;
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="si-layout">
    <section className="sd-panel si-form" aria-labelledby="support-form-title">
      <header className="si-header">
        <LifeBuoy size={21} aria-hidden />
        <div><h3 id="support-form-title">Conte como podemos ajudar</h3>
          <p>Escolha o tipo de solicitação e descreva o que aconteceu.</p></div>
      </header>
      {(requester?.name || requester?.house) && <dl className="si-requester">
        {requester.name && <div><dt>Solicitante</dt><dd>{requester.name}</dd></div>}
        {requester.house && <div><dt>Terreiro</dt><dd>{requester.house}</dd></div>}
      </dl>}
      <form onSubmit={onSubmit}>
        <label>Tipo de solicitação
          <select required value={draft.category} disabled={busy} onChange={event => onDraft({ ...draft, category: event.target.value as SupportDraft['category'] })}>
            <option value="">Selecione um tipo</option>
            {Object.entries(supportCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Assunto
          <input required minLength={3} maxLength={120} value={draft.subject} disabled={busy} placeholder="Ex. Não consigo abrir a lista de presença" onChange={event => onDraft({ ...draft, subject: event.target.value })} />
        </label>
        <label>O que aconteceu?
          <textarea required minLength={5} maxLength={4000} rows={5} value={draft.description} disabled={busy} placeholder="Informe em qual tela ocorreu, o que você tentou fazer e o que apareceu." onChange={event => onDraft({ ...draft, description: event.target.value })} />
        </label>
        {error && <p className="sd-error" role="alert">{error}</p>}
        <div className="sd-actions"><button className="sd-button is-primary" disabled={busy}>{busy ? 'Abrindo…' : 'Abrir chamado'} <ArrowRight size={16} /></button></div>
      </form>
    </section>
    <aside className="si-help" aria-label="Orientações de suporte">
      <section className="si-guide">
        <h3><ClipboardList size={19} /> Como acompanhar</h3>
        <ol>
          <li>Ao enviar, você recebe um protocolo.</li>
          <li>Em <strong>Meus chamados</strong>, consulte o histórico e o status.</li>
          <li>O sino avisa quando a equipe responder.</li>
        </ol>
      </section>
      <section className="sd-panel si-faq">
        <h3><BookOpen size={18} /> Perguntas frequentes</h3>
        {faqs.map(([question, answer]) => <details key={question}>
          <summary>{question}<ChevronDown size={16} aria-hidden /></summary>
          <p>{answer}</p>
        </details>)}
      </section>
      <section className="si-gira">
        <h3><Radio size={17} /> Ajuda durante uma gira</h3>
        <p>Informe o horário e o impacto na operação para contextualizar o atendimento.</p>
      </section>
    </aside>
  </div>;
}
