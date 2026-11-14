import LibraryAccessPreviewDialog from './LibraryAccessPreviewDialog';
import PageLoading from "../shared/PageLoading";
import PrivateStudyDiscussion from "../shared/PrivateStudyDiscussion";
import { useCreateRequest } from "./useCreateRequest";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  Eye,
  FileText,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { DemoMember } from "./MembersPage";
import {
  libraryCategories,
  libraryDate,
  librarySize,
  mayReadMaterial,
  validLibraryAudience,
  type LibraryCategory,
  type LibraryMaterial,
  type LocalLibrary,
} from "./library";
import { WorkflowDialog, WorkflowEmpty, textMatch } from "./WorkflowUI";
import { HouseState, HouseStateTools, type HouseMode } from "./HouseStates";
import "./house-shared.css";
import "./library.css";
const LibraryPdf = lazy(() => import("./LibraryPdf"));
import { authFetch } from "../../src/lib/authenticatedFetch";
import { readPdfBytes } from "../../src/lib/pdfSourceReader";
type Props = {
  state: LocalLibrary;
  onChange: (state: LocalLibrary) => void;
  members: DemoMember[];
  createRequest: number;
  onCreateHandled: () => void;
  previewMemberId: string | null;
  onPreviewChange: (id: string | null) => void;
};
type MaterialEditor = {
  id: string;
  title: string;
  description: string;
  category: LibraryCategory;
  scope: "house" | "individual";
  memberId: string;
  attachment: Pick<
    LibraryMaterial,
    "source" | "fileName" | "bytes" | "illustrative"
  > | null;
};
type PendingSave = {
  material: LibraryMaterial;
  editor: MaterialEditor;
  before: LibraryMaterial;
};
function usePdfUrl(source?: string | File) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true,
      objectUrl = "";
    setUrl("");
    if (!source) return;
    const open = async () => {
      try {
        if (typeof source === "string" && !source.startsWith("/api/")) {
          if (alive) setUrl(source);
          return;
        }
        const bytes = await readPdfBytes(source);
        const file = new Blob([bytes], { type: "application/pdf" });
        if (alive) {
          objectUrl = URL.createObjectURL(file);
          setUrl(objectUrl);
        }
      } catch {
        if (alive) setUrl("");
      }
    };
    void open();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);
  return url;
}
const categoryClass = (category: string) =>
  ({
    Cantigas: "sage",
    História: "sand",
    Ervas: "mint",
    Orixás: "lilac",
    Fundamentos: "forest",
  })[category] || "sage";

export default function LibraryPage({
  state,
  onChange,
  members,
  createRequest,
  onCreateHandled,
  previewMemberId,
  onPreviewChange,
}: Props) {
  const [mode, setMode] = useState<HouseMode>("ready");
  const [scope, setScope] = useState<"house" | "individual">("house");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [editor, setEditor] = useState<MaterialEditor | null>(null);
  const [pending, setPending] = useState<PendingSave | null>(null);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [readerId, setReaderId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [discussion, setDiscussion] = useState<LibraryMaterial | null>(null);
  const [removed, setRemoved] = useState<LibraryMaterial | null>(null);
  const [feedback, setFeedback] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const request = useRef(createRequest);
  const validation = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const readerOpener = useRef<HTMLElement | null>(null);
  const collectionHeading = useRef<HTMLHeadingElement>(null);
  const isMemberPreview = previewMemberId !== null;
  const previewMember = members.find((member) => member.id === previewMemberId);
  const records = mode === "empty" ? [] : state.materials;
  const readable = isMemberPreview
    ? previewMember
      ? records.filter((material) =>
          mayReadMaterial(material, {
            kind: "member",
            memberId: previewMember.id,
          }),
        )
      : []
    : records;
  const scoped = readable.filter(
    (material) => material.audience.kind === scope,
  );
  const shown = scoped
    .filter(
      (material) =>
        (category === "all" || material.category === category) &&
        (isMemberPreview ||
          scope === "house" ||
          recipientFilter === "all" ||
          (material.audience.kind === "individual" &&
            material.audience.memberId === recipientFilter)) &&
        textMatch(`${material.title} ${material.description}`, query),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "pt-BR")
        : Date.parse(b.created) - Date.parse(a.created),
    );
  const editingMaterial = records.find(
    (material) => material.id === editor?.id,
  );
  const legacyEditor = editingMaterial?.editPolicy === "legacy";
  const pendingEditor = editingMaterial?.editPolicy === "pending";
  const reader = readable.find((material) => material.id === readerId);
  const deletion = !isMemberPreview
    ? records.find((material) => material.id === deleteId)
    : undefined;
  const downloadUrl = usePdfUrl(reader?.source);
  const audienceText = (material: LibraryMaterial) =>
    material.audience.kind === "house"
      ? "Toda a casa"
      : `Privado · ${members.find((member) => material.audience.kind === "individual" && member.id === material.audience.memberId)?.name || "Destinatário indisponível"}`;
  const countInScope = (kind: string) =>
    readable.filter((material) => material.audience.kind === kind).length;

  function openNew() {
    validation.current++;
    setValidating(false);
    setEditor({
      id: crypto.randomUUID(),
      title: "",
      description: "",
      category: "Fundamentos",
      scope: "individual",
      memberId: "",
      attachment: null,
    });
    setError("");
  }
  function closeEditor() {
    if (saveInFlight.current) return;
    validation.current++;
    setValidating(false);
    setEditor(null);
  }
  function edit(material: LibraryMaterial) {
    validation.current++;
    setValidating(false);
    setEditor({
      id: material.id,
      title: material.title,
      description: material.description,
      category: material.category,
      scope: material.audience.kind,
      memberId:
        material.audience.kind === "individual"
          ? material.audience.memberId
          : "",
      attachment: {
        source: material.source,
        fileName: material.fileName,
        bytes: material.bytes,
        illustrative: material.illustrative,
      },
    });
    setError("");
  }
  useCreateRequest(createRequest, onCreateHandled, () => {
    if (!isMemberPreview) openNew();
  });
  useEffect(() => {
    setReaderId(null);
    setCategory("all");
    setQuery("");
    setRecipientFilter("all");
    setScope("house");
    setFeedback("");
  }, [previewMemberId]);
  useEffect(
    () => () => {
      validation.current++;
    },
    [],
  );
  function changeScope(next: "house" | "individual") {
    setScope(next);
    setQuery("");
    setCategory("all");
    setRecipientFilter("all");
  }
  async function chooseFile(file?: File) {
    if (!file) return;
    const serial = ++validation.current;
    setError("");
    if (
      !/\.pdf$/i.test(file.name) ||
      (file.type &&
        !["application/pdf", "application/octet-stream"].includes(file.type)) ||
      !file.size ||
      file.size > 20 * 1024 * 1024
    ) {
      setError("Escolha um PDF válido, de até 20 MB.");
      setValidating(false);
      return;
    }
    setValidating(true);
    try {
      const signature = new TextDecoder().decode(
        await file.slice(0, 5).arrayBuffer(),
      );
      if (serial !== validation.current) return;
      if (signature !== "%PDF-") {
        setError(
          "Este arquivo não tem o formato de um PDF. Escolha outro documento.",
        );
        return;
      }
      setEditor((previous) =>
        previous
          ? {
              ...previous,
              title:
                previous.title ||
                file.name.replace(/\.pdf$/i, "").slice(0, 110),
              attachment: {
                source: file,
                fileName: file.name,
                bytes: file.size,
                illustrative: false,
              },
            }
          : previous,
      );
    } catch {
      if (serial === validation.current)
        setError(
          "Não foi possível ler o arquivo. Tente selecioná-lo novamente.",
        );
    } finally {
      if (serial === validation.current) setValidating(false);
    }
  }
  async function persist(material: LibraryMaterial) {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const exists = state.materials.some((item) => item.id === material.id);
      await onChange({
        materials: exists
          ? state.materials.map((item) =>
              item.id === material.id ? material : item,
            )
          : [...state.materials, material],
      });
      saveInFlight.current = false;
      closeEditor();
      setPending(null);
      setDiscussion(null);
      setMode("ready");
      setRemoved(null);
      setScope(material.audience.kind);
      setQuery("");
      setCategory("all");
      setRecipientFilter("all");
      setFeedback(
        material.audience.kind === "house"
          ? "Material confirmado no acervo real da casa."
          : `Material privado salvo para ${members.find((member) => material.audience.kind === "individual" && member.id === material.audience.memberId)?.name}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "A edição não foi confirmada. Confira o acervo antes de repetir.",
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || validating || saving || isMemberPreview) return;
    if (editor.title.trim().length < 3) {
      setError("Informe um título com pelo menos três caracteres.");
      return;
    }
    const audience =
      editor.scope === "house"
        ? { kind: "house" as const }
        : { kind: "individual" as const, memberId: editor.memberId };
    if (
      !validLibraryAudience(
        audience,
        members.map((member) => member.id),
      )
    ) {
      setError("Escolha o filho que terá acesso a este PDF privado.");
      return;
    }
    if (!editor.attachment) {
      setError("Selecione o arquivo PDF que será enviado.");
      return;
    }
    const before = state.materials.find(
      (material) => material.id === editor.id,
    );
    const now = new Date().toISOString();
    const material: LibraryMaterial = {
      id: editor.id,
      title: editor.title.trim(),
      description: editor.description.trim(),
      category: editor.category,
      ...editor.attachment,
      audience,
      created: before?.created || now,
      updated: now,
      editPolicy: before?.editPolicy,
    };
    if (
      before?.audience.kind === "individual" &&
      (audience.kind === "house" ||
        audience.memberId !== before.audience.memberId)
    ) {
      setPending({ material, editor: { ...editor }, before });
      closeEditor();
      return;
    }
    await persist(material);
  }
  function openReader(material: LibraryMaterial) {
    if (
      isMemberPreview &&
      (!previewMember ||
        !mayReadMaterial(material, {
          kind: "member",
          memberId: previewMember.id,
        }))
    )
      return;
    readerOpener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setReaderId(material.id);
  }
  function previewFor(id: string) {
    setReaderId(null);
    setPreviewOpen(false);
    onPreviewChange(id);
  }

  return (
    <div className="library-page">
      {feedback && !isMemberPreview && (
        <div className="wf-feedback" role="status">
          <Check size={16} />
          <span>{feedback}</span>
          {removed && (
            <button
              onClick={async () => {
                await onChange({ materials: [...state.materials, removed] });
                setRemoved(null);
                setFeedback(
                  "Material restaurado com o mesmo destinatário e arquivo.",
                );
              }}
            >
              Desfazer
            </button>
          )}
        </div>
      )}
      {isMemberPreview && (
        <section className="lb-member-preview">
          <div>
            <Eye size={21} />
            <span>
              <strong>Visualização do acesso do filho</strong>
              <small>
                Confira quais materiais estão disponíveis para este membro. Não
                é uma sessão de login dele.
              </small>
            </span>
          </div>
          <label>
            Ver como
            <select
              aria-label="Membro da visualização"
              value={previewMemberId || ""}
              onChange={(event) => previewFor(event.target.value)}
            >
              <option value="" disabled>
                Selecione um membro
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {mode === "loading" ? (
        <PageLoading route="library" />
      ) : mode === "error" ? (
        <HouseState mode={mode} onReset={() => setMode("ready")} />
      ) : (
        <>
          <div className="lb-collection-bar">
            <div className="lb-scope" aria-label="Acervos da biblioteca">
              <button
                aria-pressed={scope === "house"}
                onClick={() => changeScope("house")}
              >
                <Users size={17} />
                <span>Acervo da casa</span>
                <small>{countInScope("house")}</small>
              </button>
              <button
                aria-pressed={scope === "individual"}
                onClick={() => changeScope("individual")}
              >
                <LockKeyhole size={17} />
                <span>
                  {isMemberPreview ? "Só para mim" : "Acervo privado"}
                </span>
                <small>{countInScope("individual")}</small>
              </button>
            </div>
            {!isMemberPreview && (
              <button
                className="lb-preview-trigger"
                onClick={() => {
                  setSelectedMember("");
                  setPreviewOpen(true);
                }}
              >
                <Eye size={17} />
                Testar acesso de um filho
              </button>
            )}
          </div>
          {scope === "individual" && (
            <div className="lb-private-note">
              <LockKeyhole size={22} />
              <div>
                <strong>
                  {isMemberPreview
                    ? "Uma leitura compartilhada só com você."
                    : "Reservado para quem você escolher."}
                </strong>
                <p>
                  {isMemberPreview
                    ? "Estes materiais foram separados para este membro."
                    : "Cada PDF tem seu próprio destinatário. Só a zeladoria e o filho escolhido podem acessar o material."}
                </p>
              </div>
              {!isMemberPreview && (
                <button onClick={() => openNew()}>
                  <Plus size={16} />
                  Adicionar privado
                </button>
              )}
            </div>
          )}
          <div className="lb-layout">
            <aside className="lb-index">
              <h2>Explorar assuntos</h2>
              <div aria-label="Assuntos da biblioteca">
                {["all", ...libraryCategories].map((subject) => (
                  <button
                    key={subject}
                    aria-pressed={category === subject}
                    onClick={() => setCategory(subject)}
                  >
                    <span>
                      {subject === "all" ? "Todos os assuntos" : subject}
                    </span>
                    <small>
                      {
                        scoped.filter(
                          (material) =>
                            subject === "all" || material.category === subject,
                        ).length
                      }
                    </small>
                  </button>
                ))}
              </div>
              <div className="lb-index-note">
                <BookOpen size={23} />
                <h3>O estudo também é cuidado.</h3>
                <p>
                  {isMemberPreview
                    ? "Abra o PDF para ler e navegar pelas páginas do material."
                    : "Separe o que é da corrente e o que pertence a uma orientação individual."}
                </p>
                {!isMemberPreview && (
                  <button
                    onClick={() => {
                      changeScope("individual");
                      openNew();
                    }}
                  >
                    Criar uma leitura privada
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </aside>
            <section className="lb-collection">
              <header>
                <div>
                  <h2 ref={collectionHeading} tabIndex={-1}>
                    {isMemberPreview
                      ? scope === "individual"
                        ? `Leituras de ${previewMember?.name.split(" ")[0] || "um membro"}.`
                        : "Para estudar com a casa."
                      : scope === "individual"
                        ? "Um acervo para cada caminho."
                        : "Conhecimento que circula."}
                  </h2>
                  <p>
                    {isMemberPreview
                      ? `${shown.length} ${shown.length === 1 ? "material disponível" : "materiais disponíveis"} para ${previewMember?.name || "este membro"}.`
                      : scope === "individual"
                        ? "Materiais individuais, com destinatário sempre à vista."
                        : "Referências e leituras compartilhadas com a corrente."}
                  </p>
                </div>
              </header>
              <div className="lb-search-row">
                <label className="wf-search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar material na biblioteca"
                    placeholder="Buscar título ou descrição…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Ordenar biblioteca"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="recent">Mais recentes</option>
                  <option value="title">Título A–Z</option>
                </select>
                {!isMemberPreview && scope === "individual" && (
                  <select
                    aria-label="Filtrar destinatário"
                    value={recipientFilter}
                    onChange={(event) => setRecipientFilter(event.target.value)}
                  >
                    <option value="all">Todos os filhos</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="lb-books">
                {shown.map((material) => (
                  <article className="lb-book" key={material.id}>
                    <button
                      className={`lb-book-cover ${categoryClass(material.category)}`}
                      aria-label={`Visualizar PDF: ${material.title}`}
                      onClick={() => openReader(material)}
                    >
                      <span>
                        <FileText size={18} />
                        PDF
                      </span>
                      <h3>{material.title}</h3>
                      <span>
                        {material.category}
                        <BookOpen size={19} />
                      </span>
                    </button>
                    <div className="lb-book-copy">
                      <p>
                        {material.description ||
                          "Este material ainda não tem descrição."}
                      </p>
                      <span
                        className={`lb-access ${material.audience.kind === "individual" ? "private" : ""}`}
                      >
                        {material.audience.kind === "individual" ? (
                          <LockKeyhole size={14} />
                        ) : (
                          <Users size={14} />
                        )}
                        {isMemberPreview &&
                        material.audience.kind === "individual"
                          ? "Compartilhado só com você"
                          : audienceText(material)}
                      </span>
                      <small>
                        {libraryDate(material.created)} ·{" "}
                        {librarySize(material.bytes)}
                      </small>
                    </div>
                    <footer>
                      <button onClick={() => openReader(material)}>
                        Abrir PDF
                        <ArrowRight size={15} />
                      </button>
                      {!isMemberPreview && (
                        <>
                          <button
                            aria-label={`Editar material: ${material.title}`}
                            title="Editar material e acesso"
                            onClick={() => edit(material)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            aria-label={`Remover material: ${material.title}`}
                            title="Remover material"
                            onClick={() => setDeleteId(material.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
              {!shown.length && (
                <div className="lb-empty">
                  <WorkflowEmpty
                    title={
                      query || category !== "all" || recipientFilter !== "all"
                        ? "Nenhum material neste filtro."
                        : scope === "individual"
                          ? isMemberPreview
                            ? "Nenhuma leitura individual para este membro."
                            : "O primeiro estudo privado começa aqui."
                          : "Um espaço para guardar os estudos da casa."
                    }
                    text={
                      isMemberPreview
                        ? "A Biblioteca mostra apenas o que foi compartilhado com este membro."
                        : "Adicione um PDF e defina quem pode acessar."
                    }
                  />
                  {query || category !== "all" || recipientFilter !== "all" ? (
                    <button
                      className="wf-button secondary"
                      onClick={() => {
                        setQuery("");
                        setCategory("all");
                        setRecipientFilter("all");
                      }}
                    >
                      Limpar filtros
                    </button>
                  ) : (
                    !isMemberPreview && (
                      <button
                        className="wf-button secondary"
                        onClick={() => openNew()}
                      >
                        <Plus size={16} />
                        Adicionar primeiro material
                      </button>
                    )
                  )}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      <WorkflowDialog
        open={!!editor && !isMemberPreview}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
        title={
          state.materials.some((material) => material.id === editor?.id)
            ? "Editar material e acesso"
            : "Adicionar material"
        }
        description="Escolha o PDF e defina quem poderá acessá-lo."
      >
        {editor && (
          <form onSubmit={save} noValidate>
            {legacyEditor && (
              <p className="wf-demo-note">
                Este material usa o armazenamento legado. Você pode editar
                título, assunto e descrição. A troca de PDF ou acesso depende da
                retirada segura dos links antigos.
              </p>
            )}
            {pendingEditor && (
              <p className="wf-demo-note">
                A edição protegida deste material aguarda a ativação da migração
                do piloto.
              </p>
            )}
            <label className="wf-field">
              Título do material
              <input
                maxLength={110}
                value={editor.title}
                onChange={(event) =>
                  setEditor({ ...editor, title: event.target.value })
                }
                placeholder="Ex.: Leitura para Mariana"
              />
            </label>
            <label className="wf-field">
              Assunto
              <select
                value={editor.category}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    category: event.target.value as LibraryCategory,
                  })
                }
              >
                {libraryCategories.map((subject) => (
                  <option key={subject}>{subject}</option>
                ))}
              </select>
            </label>
            <fieldset
              className="lb-audience-fields"
              disabled={legacyEditor || pendingEditor || saving}
            >
              <legend>Quem pode acessar?</legend>
              <label
                className={editor.scope === "individual" ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="library-audience"
                  checked={editor.scope === "individual"}
                  onChange={() => {
                    setEditor({ ...editor, scope: "individual" });
                    setError("");
                  }}
                />
                <LockKeyhole size={18} />
                <span>
                  <strong>Privado para um filho</strong>
                  <small>Você e o filho escolhido.</small>
                </span>
              </label>
              <label className={editor.scope === "house" ? "selected" : ""}>
                <input
                  type="radio"
                  name="library-audience"
                  disabled={!editingMaterial && state.revisionEditing === false}
                  checked={editor.scope === "house"}
                  onChange={() => {
                    setEditor({ ...editor, scope: "house", memberId: "" });
                    setError("");
                  }}
                />
                <Users size={18} />
                <span>
                  <strong>Acervo da casa</strong>
                  <small>
                    {!editingMaterial && state.revisionEditing === false
                      ? "Disponível após a ativação da publicação protegida."
                      : "Zeladoria e todos os filhos da casa."}
                  </small>
                </span>
              </label>
            </fieldset>
            {editor.scope === "individual" && (
              <label className="wf-field">
                Filho que terá acesso
                <select
                  disabled={legacyEditor || pendingEditor || saving}
                  value={editor.memberId}
                  onChange={(event) => {
                    setEditor({ ...editor, memberId: event.target.value });
                    setError("");
                  }}
                >
                  <option value="">Escolha um filho</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.registration}
                    </option>
                  ))}
                </select>
                <small>
                  O material não será listado para os outros filhos.
                </small>
              </label>
            )}
            <label className="wf-field">
              Descrição
              <textarea
                className="hs-textarea"
                maxLength={600}
                rows={3}
                value={editor.description}
                onChange={(event) =>
                  setEditor({ ...editor, description: event.target.value })
                }
                placeholder="Uma breve apresentação desta leitura."
              />
            </label>
            <div className="lb-file-picker">
              <FileText size={24} />
              <div>
                <strong>
                  {editor.attachment?.fileName || "Adicione o documento em PDF"}
                </strong>
                <span>
                  {editor.attachment
                    ? `${librarySize(editor.attachment.bytes)} · Arquivo selecionado`
                    : "PDF de até 20 MB. O arquivo será enviado ao salvar, com o acesso escolhido."}
                </span>
              </div>
              <button
                className="wf-button secondary"
                type="button"
                disabled={validating || legacyEditor || pendingEditor || saving}
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                {editor.attachment ? "Trocar PDF" : "Selecionar PDF"}
              </button>
              <input
                ref={input}
                type="file"
                accept=".pdf,application/pdf"
                aria-label="Arquivo PDF"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  void chooseFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
            {validating && (
              <p role="status" className="wf-demo-note">
                Conferindo formato do arquivo…
              </p>
            )}
            <p className="lb-access-summary">
              <ShieldCheck size={18} />
              {editor.scope === "house"
                ? "Visível para toda a casa após a confirmação do servidor."
                : editor.memberId
                  ? `Privado para ${members.find((member) => member.id === editor.memberId)?.name || "destinatário indisponível"} e a zeladoria.`
                  : "Escolha o destinatário para concluir o material privado."}
            </p>
            {error && (
              <p className="wf-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="wf-button"
              type="submit"
              disabled={validating || pendingEditor || saving}
            >
              <Check size={16} />
              {saving ? "Salvando material…" : "Salvar material"}
            </button>
          </form>
        )}
      </WorkflowDialog>
      <WorkflowDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setEditor(pending?.editor || null);
            setPending(null);
          }
        }}
        title="Confirmar mudança de acesso"
        description="Este PDF era privado. Confira quem poderá vê-lo depois da alteração."
      >
        {pending && (
          <>
            <dl className="lb-access-change">
              <div>
                <dt>Antes</dt>
                <dd>{audienceText(pending.before)}</dd>
              </div>
              <div>
                <dt>Depois</dt>
                <dd>{audienceText(pending.material)}</dd>
              </div>
            </dl>
            <p className="wf-demo-note">
              {pending.material.audience.kind === "house"
                ? "A nova revisão ficará disponível para a casa. Os comentários anteriores não serão transferidos."
                : "O destinatário anterior perderá o acesso. A nova revisão começará sem os comentários anteriores."}
            </p>
            {error && (
              <p className="wf-error" role="alert">
                {error}
              </p>
            )}
            <div className="wf-confirm-actions">
              <button
                className="wf-button secondary"
                disabled={saving}
                onClick={() => {
                  setEditor(pending.editor);
                  setPending(null);
                }}
              >
                Voltar à edição
              </button>
              <button
                className="wf-button"
                disabled={saving}
                onClick={async () => await persist(pending.material)}
              >
                Confirmar alteração de acesso
              </button>
            </div>
          </>
        )}
      </WorkflowDialog>
      <WorkflowDialog
        open={!!deletion}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Remover material do acervo?"
        description="Esta remoção usa o serviço atual e não oferece recuperação do arquivo. Confirme apenas se deseja removê-lo definitivamente."
      >
        <p className="lb-delete-title">{deletion?.title}</p>
        <p className="wf-demo-note">{deletion && audienceText(deletion)}</p>
        <div className="wf-confirm-actions">
          <button
            className="wf-button secondary"
            onClick={() => setDeleteId(null)}
          >
            Cancelar
          </button>
          <button
            className="wf-button"
            onClick={async () => {
              if (!deletion) return;
              await onChange({
                materials: state.materials.filter(
                  (material) => material.id !== deletion.id,
                ),
              });
              setRemoved(null);
              setDeleteId(null);
              setFeedback("Material removido pelo serviço do acervo.");
            }}
          >
            Remover do acervo
          </button>
        </div>
      </WorkflowDialog>
      <LibraryAccessPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        members={members}
        selectedMember={selectedMember}
        onSelectMember={setSelectedMember}
        onPreview={previewFor}
      />
      <WorkflowDialog
        open={!!discussion}
        onOpenChange={(open) => {
          if (!open) setDiscussion(null);
        }}
        title="Conversa sobre o estudo reservado"
        description="Visível somente à zeladoria e ao destinatário deste PDF."
      >
        {discussion && <PrivateStudyDiscussion materialId={discussion.id} />}
      </WorkflowDialog>
      <Dialog.Root
        open={!!reader}
        onOpenChange={(open) => {
          if (!open) setReaderId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay lb-reader-overlay" />
          <Dialog.Content
            className="lb-reader"
            onEscapeKeyDown={(event) => {
              const target = event.target;
              if (target instanceof Element && target.closest('.ac-pdf-reader[data-expanded="true"], .ac-pdf-reader[data-search-open="true"]')) event.preventDefault();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (readerOpener.current?.isConnected)
                readerOpener.current.focus();
              else collectionHeading.current?.focus();
            }}
          >
            {reader && (
              <>
                <header>
                  <div>
                    <Dialog.Title>{reader.title}</Dialog.Title>
                    <Dialog.Description>
                      {reader.category} ·{" "}
                      {isMemberPreview && reader.audience.kind === "individual"
                        ? "Compartilhado só com você"
                        : audienceText(reader)}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button aria-label="Fechar leitura" className="icon-button">
                      <X size={22} />
                    </button>
                  </Dialog.Close>
                </header>
                <Suspense
                  fallback={
                    <PageLoading
                      variant="document"
                      label="Abrindo documento…"
                    />
                  }
                >
                  <LibraryPdf
                    key={reader.id}
                    source={reader.source}
                    title={reader.title}
                  />
                </Suspense>
                <footer>
                  {!isMemberPreview &&
                    typeof reader.source === "string" &&
                    reader.source.startsWith("/api/pilot/library/") && (
                      <button
                        className="wf-button secondary"
                        onClick={() => setDiscussion(reader)}
                      >
                        Comentários do estudo
                      </button>
                    )}
                  <span>
                    Arquivo do acervo · {librarySize(reader.bytes)}
                  </span>
                  {downloadUrl && (
                    <a
                      className="wf-button secondary"
                      href={downloadUrl}
                      download={reader.fileName}
                    >
                      <Download size={16} />
                      Baixar PDF
                    </a>
                  )}
                </footer>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!isMemberPreview && <HouseStateTools mode={mode} onChange={setMode} />}
    </div>
  );
}
