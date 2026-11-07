import { AuthenticatedPdfFrame } from "../../src/components/library/AuthenticatedPdfFrame";
import { previewSession } from "./remote/session";
import { readValue } from "./remote/runtime";
import { useCreateRequest } from "./useCreateRequest";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Flame,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import type { DemoMember } from "./MembersPage";
import { DEMO_TODAY } from "./giras";
import { houseDate, obligationStatus, type HouseObligation } from "./house";
import { WorkflowDialog, WorkflowEmpty, textMatch } from "./WorkflowUI";
import { HouseState, HouseStateTools, type HouseMode } from "./HouseStates";
import "./house-shared.css";
import "./obligations.css";
import { LocalFileField, LocalPdfLink } from "./LocalAttachments";
import { validFinancialDate } from "./billing";

type Props = {
  members: DemoMember[];
  items: HouseObligation[];
  onChange: (items: HouseObligation[]) => void;
  createRequest: number;
  onCreateHandled: () => void;
};
const statusLabels = {
  done: "Concluída",
  late: "Em atraso",
  upcoming: "Programada",
};
const blank = (): HouseObligation => ({
  id: crypto.randomUUID(),
  memberId: "",
  title: "",
  date: DEMO_TODAY,
  time: "19:00",
  description: "",
  done: false,
  reminder: !!readValue("account")?.whatsapp?.obligations,
  attachment: null,
});
export default function ObligationsPage({
  members,
  items,
  onChange,
  createRequest,
  onCreateHandled,
}: Props) {
  const [mode, setMode] = useState<HouseMode>("ready");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<HouseObligation | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState<HouseObligation | null>(null);
  const [completion, setCompletion] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [removed, setRemoved] = useState<HouseObligation | null>(null);
  const request = useRef(createRequest);
  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name || "Membro indisponível";
  const records = mode === "empty" ? [] : items;
  const late = records.filter((i) => obligationStatus(i) === "late");
  const next = [...records]
    .filter((i) => obligationStatus(i) === "upcoming")
    .sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    )[0];
  const done = records.filter((i) => i.done);
  const shown = records
    .filter(
      (i) =>
        (filter === "all" || obligationStatus(i) === filter) &&
        textMatch(`${i.title} ${memberName(i.memberId)}`, query),
    )
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    );
  const target = items.find((i) => i.id === completion);
  const openEditor = (item = blank()) => {
    setError("");
    setEditor({ ...item });
  };
  useCreateRequest(createRequest, onCreateHandled, () => {
    openEditor();
  });
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editor || fileBusy) return;
    if (
      editor.title.trim().length < 3 ||
      !members.some((m) => m.id === editor.memberId) ||
      !validFinancialDate(editor.date) ||
      !/^\d{2}:\d{2}$/.test(editor.time)
    ) {
      setError("Preencha título, membro, data e horário do compromisso.");
      return;
    }
    const value = {
      ...editor,
      title: editor.title.trim(),
      description: editor.description.trim(),
    };
    await onChange(
      items.some((i) => i.id === value.id)
        ? items.map((i) => (i.id === value.id ? value : i))
        : [...items, value],
    );
    setEditor(null);
    setFeedback("Compromisso salvo no sistema e vinculado ao membro.");
    setRemoved(null);
    setMode("ready");
  }
  return (
    <div className="obligations-page">
      {feedback && (
        <div className="wf-feedback" role="status">
          <Check size={17} />
          <span>{feedback}</span>
          {removed && (
            <button
              onClick={async () => {
                await onChange([...items, removed]);
                setRemoved(null);
                setFeedback("Compromisso restaurado no sistema.");
              }}
            >
              Desfazer
            </button>
          )}
        </div>
      )}
      {mode === "loading" || mode === "error" ? (
        <HouseState mode={mode} onReset={() => setMode("ready")} />
      ) : (
        <>
          <section className="ob-intro">
            <div className="ob-next">
              <span>
                <CalendarDays size={17} />
                Próximo compromisso
              </span>
              {next ? (
                <>
                  <h2>{next.title}</h2>
                  <p>{memberName(next.memberId)}</p>
                  <div>
                    <strong>{houseDate(next.date, next.time)}</strong>
                    <span>Brasília</span>
                  </div>
                  <button
                    className="wf-button secondary"
                    onClick={() => openEditor(next)}
                  >
                    Revisar agendamento
                    <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <>
                  <h2>O cuidado começa com uma data.</h2>
                  <p>
                    Registre um compromisso da corrente para acompanhar os
                    próximos passos.
                  </p>
                  <button
                    className="wf-button secondary"
                    onClick={() => openEditor()}
                  >
                    <Plus size={16} />
                    Agendar compromisso
                  </button>
                </>
              )}
            </div>
            <div className="ob-overdue">
              <CircleAlert size={22} />
              <strong>{late.length}</strong>
              <h2>
                {late.length === 1
                  ? "compromisso pede atenção"
                  : "compromissos pedem atenção"}
              </h2>
              <p>Revise os prazos com o membro e decida o próximo passo.</p>
              <button onClick={() => setFilter("late")}>
                Ver em atraso
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="ob-summary">
              <div>
                <Flame size={20} />
                <span>
                  {records.filter((i) => !i.done).length}
                  <small>em acompanhamento</small>
                </span>
              </div>
              <div>
                <Check size={20} />
                <span>
                  {done.length}
                  <small>concluídos</small>
                </span>
              </div>
              <p>
                Datas e fundamentos são definidos pela zeladoria da casa.
              </p>
            </div>
          </section>
          <section className="ob-list">
            <div className="ob-list-head">
              <div>
                <h2>Compromissos da corrente</h2>
                <p>O prazo, a pessoa e o próximo cuidado, juntos.</p>
              </div>
              <label className="wf-search">
                <Search size={17} />
                <input
                  aria-label="Buscar compromisso ou membro"
                  placeholder="Buscar compromisso ou membro…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="hs-filters" aria-label="Situação dos compromissos">
              {[
                ["all", "Todos"],
                ["upcoming", "Próximos"],
                ["late", "Em atraso"],
                ["done", "Concluídos"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ob-rows">
              {shown.map((item) => {
                const status = obligationStatus(item);
                const member = members.find((m) => m.id === item.memberId);
                return (
                  <article className={`ob-row ${status}`} key={item.id}>
                    <div className="ob-date">
                      <strong>{item.date.slice(8)}</strong>
                      <span>
                        {new Intl.DateTimeFormat("pt-BR", {
                          month: "short",
                          timeZone: "UTC",
                        }).format(new Date(`${item.date}T12:00:00Z`))}
                      </span>
                      <small>{item.date.slice(0, 4)}</small>
                    </div>
                    <div className="ob-copy">
                      <div>
                        <span className={`hs-tag ${status}`}>
                          {statusLabels[status]}
                        </span>
                        <span className="ob-time">
                          <Clock3 size={13} />
                          {item.time} · Brasília
                        </span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.description || "Sem orientações adicionais."}</p>
                      {item.attachment ? (
                        <LocalPdfLink file={item.attachment} />
                      ) : item.attachmentPath ? (
                        <button
                          className="wf-button secondary"
                          onClick={() => setPdf(item)}
                        >
                          Ler PDF do compromisso
                        </button>
                      ) : null}
                      <small className="member-finance-reference">
                        {item.reminder === false
                          ? "Lembrete desativado"
                          : "Aviso ao membro solicitado ao salvar"}
                      </small>
                      <span className="ob-person">
                        <span className={`avatar ${member?.color || "sage"}`}>
                          {member?.initials || "?"}
                        </span>
                        {memberName(item.memberId)}
                      </span>
                    </div>
                    <div className="ob-actions">
                      <button
                        className="wf-button secondary"
                        onClick={() => openEditor(item)}
                      >
                        <Pencil size={15} />
                        Editar
                      </button>
                      <button
                        className="wf-button"
                        onClick={() => setCompletion(item.id)}
                      >
                        {item.done ? <Undo2 size={15} /> : <Check size={15} />}
                        {item.done ? "Reabrir" : "Concluir"}
                      </button>
                      <button
                        className="ob-remove"
                        aria-label={`Remover ${item.title}`}
                        onClick={async () => {
                          await onChange(items.filter((i) => i.id !== item.id));
                          setRemoved(item);
                          setFeedback("Compromisso removido no servidor.");
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {!shown.length && (
              <WorkflowEmpty
                title={
                  query || filter !== "all"
                    ? "Nenhum compromisso neste filtro."
                    : "A agenda de cuidados começa aqui."
                }
                text="Registre um compromisso para um membro ou ajuste os filtros para consultar a agenda."
              />
            )}
            <p className="hs-footnote">
              {shown.length} de {records.length} registros · Dados do sistema
            </p>
          </section>
        </>
      )}
      <WorkflowDialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        title={
          editor && items.some((i) => i.id === editor.id)
            ? "Editar compromisso"
            : "Novo compromisso"
        }
        description="Organize um cuidado da casa e vincule ao cadastro real do membro."
      >
        {editor && (
          <form onSubmit={save}>
            <label className="wf-field">
              Título
              <input
                required
                minLength={3}
                maxLength={90}
                value={editor.title}
                onChange={(e) =>
                  setEditor({ ...editor, title: e.target.value })
                }
              />
            </label>
            <label className="wf-field">
              Membro
              <select
                required
                value={editor.memberId}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    memberId: e.target.value,
                    attachment: null,
                    attachmentPath: null,
                  })
                }
              >
                <option value="">Selecione um membro</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="wf-pair">
              <label className="wf-field">
                Data
                <input
                  required
                  type="date"
                  value={editor.date}
                  onInput={(e) =>
                    setEditor({ ...editor, date: e.currentTarget.value })
                  }
                  onChange={(e) =>
                    setEditor({ ...editor, date: e.target.value })
                  }
                />
              </label>
              <label className="wf-field">
                Horário de Brasília
                <input
                  required
                  type="time"
                  value={editor.time}
                  onInput={(e) =>
                    setEditor({ ...editor, time: e.currentTarget.value })
                  }
                  onChange={(e) =>
                    setEditor({ ...editor, time: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="wf-field">
              Orientações
              <textarea
                className="hs-textarea"
                maxLength={1200}
                rows={4}
                value={editor.description}
                onChange={(e) =>
                  setEditor({ ...editor, description: e.target.value })
                }
                placeholder="Preencha as orientações definidas pela zeladoria."
              />
            </label>
            <>
              {editor.attachmentPath && !editor.attachment && (
                <div className="local-file-field">
                  <button
                    type="button"
                    className="wf-button secondary"
                    onClick={() => setPdf(editor)}
                  >
                    Ler PDF atual
                  </button>
                  <button
                    type="button"
                    className="wf-button secondary"
                    onClick={() =>
                      setEditor({ ...editor, attachmentPath: null })
                    }
                  >
                    Remover PDF atual
                  </button>
                </div>
              )}
            </>
            <LocalFileField
              kind="pdf"
              file={editor.attachment}
              onChange={(file) =>
                setEditor((current) =>
                  current ? { ...current, attachment: file } : current,
                )
              }
              onBusy={setFileBusy}
            />
            <label className="local-check">
              <input
                type="checkbox"
                checked={editor.reminder !== false}
                onChange={(e) =>
                  setEditor({ ...editor, reminder: e.target.checked })
                }
              />
              Avisar o membro ao salvar
            </label>
            {error && (
              <p className="wf-error" role="alert">
                {error}
              </p>
            )}
            <button className="wf-button" type="submit" disabled={fileBusy}>
              <Check size={16} />
              Salvar compromisso
            </button>
            <p className="wf-demo-note">
              Ao marcar a opção, o sistema solicita uma notificação ao membro ao
              salvar.
            </p>
          </form>
        )}
      </WorkflowDialog>
      <WorkflowDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) setCompletion(null);
        }}
        title={
          target?.done ? "Reabrir acompanhamento?" : "Concluir acompanhamento?"
        }
        description="A mudança atualiza o compromisso e o histórico do membro."
      >
        <div className="ob-confirm">
          <strong>{target?.title}</strong>
          <p>{target ? memberName(target.memberId) : ""}</p>
        </div>
        <div className="wf-confirm-actions">
          <button
            className="wf-button secondary"
            onClick={() => setCompletion(null)}
          >
            Cancelar
          </button>
          <button
            className="wf-button"
            onClick={async () => {
              if (!target) return;
              await onChange(
                items.map((i) =>
                  i.id === target.id ? { ...i, done: !i.done } : i,
                ),
              );
              setFeedback(
                target.done
                  ? "Acompanhamento reaberto no sistema."
                  : "Acompanhamento concluído no sistema.",
              );
              setRemoved(null);
              setCompletion(null);
            }}
          >
            Confirmar {target?.done ? "reabertura" : "conclusão"}
          </button>
        </div>
      </WorkflowDialog>
      <HouseStateTools mode={mode} onChange={setMode} />
      <WorkflowDialog
        open={!!pdf}
        onOpenChange={(open) => {
          if (!open) setPdf(null);
        }}
        title={pdf?.title || "Documento do compromisso"}
        description="PDF privado compartilhado com o membro deste compromisso."
      >
        {pdf?.attachmentPath && (
          <AuthenticatedPdfFrame
            url=""
            title={pdf.title}
            storagePath={pdf.attachmentPath}
            tenantId={previewSession().tenantId}
          />
        )}
      </WorkflowDialog>
    </div>
  );
}
