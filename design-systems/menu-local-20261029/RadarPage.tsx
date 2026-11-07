import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Eye,
  ImagePlus,
  Landmark,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { WorkflowDialog, WorkflowEmpty, textMatch } from "./WorkflowUI";
import { HouseState, HouseStateTools, type HouseMode } from "./HouseStates";
import {
  localDate,
  radarProfileDraft,
  type RadarProfileDraft,
  type HouseProfile,
  type LocalRadar,
  type PublicPost,
  type PublicService,
  type RadarMedia,
} from "./completion";
import {
  nextRadarMeeting,
  radarCleanDraft,
  radarDraftEqual,
  radarSections,
  radarTimeRange,
  radarValidation,
  type RadarSection,
} from "./radarLogic";
import { RadarPicture, useRadarUploads } from "./RadarMedia";
import RadarProfileEditor from "./RadarProfileEditor";
import RadarVisitor, { RadarImageViewer } from "./RadarVisitor";
import "./completion.css";
import "./radar-studio.css";
type Props = {
  draft: RadarProfileDraft;
  onDraftChange: (d: RadarProfileDraft) => void;
  metrics?: Record<string, number>;
  state: LocalRadar;
  onChange: (s: LocalRadar) => void | Promise<void>;
  profile: HouseProfile;
  onNavigate: (id: string) => void;
};
export default function RadarPage({
  state,
  onChange,
  profile,
  draft,
  onDraftChange,
  metrics,
}: Props) {
  const [tab, setTab] = useState<RadarSection>("identity"),
    [mode, setMode] = useState<HouseMode>("ready"),
    [period, setPeriod] = useState("7"),
    [query, setQuery] = useState(""),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState("");
  const [preview, setPreview] = useState(false),
    [visibility, setVisibility] = useState(false),
    [service, setService] = useState<PublicService | null>(null),
    [post, setPost] = useState<PublicPost | null>(null),
    [publishPost, setPublishPost] = useState<string | null>(null),
    [discard, setDiscard] = useState(false),
    [viewMedia, setViewMedia] = useState<RadarMedia | null>(null),
    [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<
    | { kind: "service"; item: PublicService }
    | { kind: "post"; item: PublicPost }
    | null
  >(null);
  const editorRef = useRef<HTMLElement>(null);
  const [focusEditor, setFocusEditor] = useState(false);
  useEffect(() => {
    if (focusEditor) {
      editorRef.current?.focus({ preventScroll: true });
      editorRef.current?.scrollIntoView({ block: "start" });
      setFocusEditor(false);
    }
  }, [tab, focusEditor]);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error && !service && !post) errorRef.current?.focus();
  }, [error, service, post]);
  const saving = useRef(false);
  const persist = async (value: LocalRadar) => {
    if (saving.current || busy) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await onChange(value);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar. Seu rascunho foi mantido.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const empty = mode === "empty",
    visits = empty
      ? 0
      : Number(period === "7" ? metrics?.views7 || 0 : metrics?.views30 || 0),
    days = [visits];
  const dirty = !radarDraftEqual(draft, radarProfileDraft(state)),
    next = nextRadarMeeting(state.schedules),
    editingProfile = ["identity", "location", "schedule", "gallery"].includes(
      tab,
    );
  const onFiles = useRadarUploads(draft, onDraftChange, setError, setBusy);
  const changeTab = (next: RadarSection) => {
    setTab(next);
    setError("");
  };
  const saveProfile = async () => {
    if (busy) return;
    const problem = radarValidation(draft);
    if (problem) {
      setTab(problem.section);
      setError(problem.message);
      return;
    }
    const clean = radarCleanDraft(draft);
    if (!(await persist({ ...state, ...clean }))) return;
    setError("");
    setMode("ready");
    setFeedback(
      "Perfil público salvo no sistema. Confira a versão que o visitante verá.",
    );
  };
  const saveService = async (e: FormEvent) => {
    e.preventDefault();
    if (!service) return;
    if (
      service.name.trim().length < 3 ||
      service.description.trim().length < 10 ||
      !Number.isInteger(service.minutes) ||
      service.minutes < 5 ||
      service.minutes > 480
    ) {
      setError(
        "Informe nome, descrição com 10 caracteres e duração entre 5 e 480 minutos.",
      );
      return;
    }
    const value = {
      ...service,
      name: service.name.trim(),
      description: service.description.trim(),
    };
    if (
      !(await persist({
        ...state,
        services: state.services.some((s) => s.id === value.id)
          ? state.services.map((s) => (s.id === value.id ? value : s))
          : [...state.services, value],
      }))
    )
      return;
    setService(null);
    setMode("ready");
    setFeedback("Atendimento salvo no perfil público.");
  };
  const savePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!post) return;
    if (post.title.trim().length < 5 || post.text.trim().length < 15) {
      setError("Informe título com 5 caracteres e conteúdo com 15.");
      return;
    }
    const value = {
      ...post,
      title: post.title.trim(),
      text: post.text.trim(),
      updated: new Date().toISOString(),
    };
    if (
      !(await persist({
        ...state,
        posts: state.posts.some((p) => p.id === post.id)
          ? state.posts.map((p) => (p.id === post.id ? value : p))
          : [value, ...state.posts],
      }))
    )
      return;
    setPost(null);
    setMode("ready");
    setFeedback("Texto salvo. O estado de publicação foi preservado.");
  };
  return (
    <div className="finish-page radar-studio">
      <section
        className="rs-saved-stage"
        aria-label="Apresentação salva do perfil público"
      >
        <div className="rs-stage-cover">
          <RadarPicture
            media={empty ? null : state.cover}
            alt={`Capa salva de ${state.publicName}`}
            position={state.coverPosition}
          />
          <div className="rs-stage-cover-actions">
            <span>
              Versão salva
              {state.cover?.illustrative && !empty
                ? " · capa ilustrativa de IA"
                : ""}
            </span>
            <button
              className="rs-on-photo"
              onClick={() => {
                changeTab("identity");
                setFocusEditor(true);
              }}
            >
              <ImagePlus size={16} />
              Editar capa e foto
            </button>
          </div>
        </div>
        <div className="rs-stage-identity">
          <div className="rs-stage-portrait">
            {!empty && state.portrait ? (
              <RadarPicture
                media={state.portrait}
                alt={`Foto de perfil salva de ${state.publicName}`}
              />
            ) : (
              <Landmark size={34} />
            )}
          </div>
          <div className="rs-stage-name">
            <h2>{empty ? "Sua casa no Radar" : state.publicName}</h2>
            <p>
              <span>{state.tradition}</span>
              <MapPin size={14} />
              {state.city} · {state.uf}
            </p>
          </div>
          <div className="rs-stage-actions">
            <button
              className="wf-button gold"
              disabled={empty}
              onClick={() => setPreview(true)}
            >
              <Eye size={17} />
              Ver como visitante
            </button>
            <button
              className="rs-visibility-button"
              onClick={() => setVisibility(true)}
            >
              <span
                className={state.published ? "rs-live-dot" : "rs-off-dot"}
              />
              {state.published
                ? "Visível no perfil público"
                : "Perfil público oculto"}
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <div className="rs-stage-bottom">
          <p>Uma presença pública com a identidade e o ritmo da sua casa.</p>
          {next && !empty && (
            <span>
              <CalendarDays size={15} />
              Rotina salva: {next.row.title} · {radarTimeRange(next.row)}
            </span>
          )}
        </div>
      </section>
      {feedback && (
        <div className="wf-feedback rs-feedback" role="status">
          <Check size={17} />
          <span>{feedback}</span>
          {removed && (
            <button
              onClick={async () => {
                if (removed.kind === "service") {
                  if (
                    !(await persist({
                      ...state,
                      services: [...state.services, removed.item],
                    }))
                  )
                    return;
                } else {
                  if (
                    !(await persist({
                      ...state,
                      posts: [removed.item, ...state.posts],
                    }))
                  )
                    return;
                }
                setRemoved(null);
                setFeedback("Registro restaurado no perfil público.");
              }}
            >
              Desfazer
            </button>
          )}
        </div>
      )}
      <div className="rs-workbench">
        <nav className="rs-section-index" aria-label="Seções do Radar">
          <h3>Seu perfil, por inteiro</h3>
          {radarSections.map((s) => (
            <button
              key={s.id}
              aria-current={tab === s.id ? "page" : undefined}
              onClick={() => changeTab(s.id)}
            >
              {s.label}
              <ArrowUpRight size={15} />
            </button>
          ))}
          <p>
            As edições do perfil ficam em rascunho até você salvar. Sair da
            página preserva o rascunho nesta sessão.
          </p>
        </nav>
        <section
          ref={editorRef}
          tabIndex={-1}
          className="rs-editor-surface"
          aria-label={radarSections.find((s) => s.id === tab)?.label}
        >
          {error && !service && !post && (
            <p
              role="alert"
              tabIndex={-1}
              ref={errorRef}
              className="rs-editor-error"
            >
              {error}
            </p>
          )}
          {mode === "loading" || mode === "error" ? (
            <HouseState mode={mode} onReset={() => setMode("ready")} />
          ) : empty ? (
            <WorkflowEmpty
              title="Vamos apresentar sua casa?"
              text="Atualize a página para consultar novamente os dados do perfil público."
            />
          ) : editingProfile ? (
            <form
              id="rs-profile-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await saveProfile();
              }}
            >
              <RadarProfileEditor
                section={tab}
                draft={draft}
                onChange={onDraftChange}
                busy={busy}
                onFiles={(kind, files) => {
                  void onFiles(kind, files);
                }}
                onView={setViewMedia}
                account={profile}
              />
            </form>
          ) : tab === "overview" ? (
            <section className="radar-analytics">
              <div className="radar-chart">
                <div className="finish-section-head">
                  <div>
                    <h3>Encontros começam por aqui</h3>
                    <p>Visitas ao perfil · registros do servidor</p>
                  </div>
                  <label>
                    Período
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      <option value="7">Últimos 7 dias</option>
                      <option value="30">Últimos 30 dias</option>
                    </select>
                  </label>
                </div>
                <div className="radar-chart-total">
                  <strong>{visits}</strong>
                  <span>visitas ao perfil</span>
                </div>
                <div
                  className="radar-bars"
                  role="list"
                  aria-label="Visitas registradas no período"
                >
                  {days.map((n, i) => (
                    <div role="listitem" key={i}>
                      <strong>{empty ? 0 : n}</strong>
                      <div
                        style={{
                          height: `${((empty ? 0 : n) / Math.max(1, ...days)) * 140}px`,
                        }}
                      />
                      <span>{`Total · ${period} dias`}</span>
                    </div>
                  ))}
                </div>
                <p className="finish-note">
                  Total registrado pelo serviço no período selecionado. Os
                  canais ao lado usam os últimos 30 dias.
                </p>
              </div>
              <aside className="radar-channels">
                <h3>Além da visita</h3>
                <p>
                  Ações de interesse nos últimos 30 dias. Uma pessoa pode
                  realizar mais de uma ação.
                </p>
                {[
                  [
                    Eye,
                    "Aberturas pelo diretório",
                    Number(metrics?.directoryClicks30 || 0),
                  ],
                  [
                    Search,
                    "Acessos pelo Google",
                    Number(metrics?.googleViews30 || 0),
                  ],
                  [
                    MessageCircle,
                    "Cliques no WhatsApp",
                    Number(metrics?.whatsappClicks30 || 0),
                  ],
                ].map(([Icon, label, n]) => {
                  const C = Icon as typeof Eye;
                  return (
                    <div key={String(label)}>
                      <C size={19} />
                      <span>{String(label)}</span>
                      <strong>{empty ? 0 : Number(n)}</strong>
                    </div>
                  );
                })}
                <button
                  className="finish-link"
                  onClick={() => changeTab("identity")}
                >
                  Revisar informações do perfil
                  <ArrowUpRight size={16} />
                </button>
              </aside>
            </section>
          ) : tab === "services" ? (
            <section>
              <div className="finish-section-head">
                <div>
                  <h3>Atendimentos da casa</h3>
                  <p>
                    Descreva somente o que a própria casa oferece. Nenhuma
                    prescrição é gerada.
                  </p>
                </div>
                <button
                  className="wf-button"
                  onClick={() => {
                    setError("");
                    setService({
                      id: crypto.randomUUID(),
                      name: "",
                      description: "",
                      minutes: 30,
                      available: true,
                    });
                  }}
                >
                  <Plus size={17} />
                  Novo atendimento
                </button>
              </div>
              {!(empty ? [] : state.services).length ? (
                <WorkflowEmpty
                  title="Nenhum atendimento cadastrado."
                  text="Apresente as orientações que deseja compartilhar com visitantes."
                />
              ) : (
                <div className="radar-services">
                  {state.services.map((s) => (
                    <article key={s.id}>
                      <span className="finish-status neutral">
                        {s.available ? "Disponível" : "Pausado"}
                      </span>
                      <h3>{s.name}</h3>
                      <p>{s.description}</p>
                      <small>{s.minutes} minutos · duração informada</small>
                      <div className="finish-actions">
                        <button
                          className="finish-link"
                          onClick={() => {
                            setError("");
                            setService({ ...s });
                          }}
                        >
                          <Pencil size={16} />
                          Editar atendimento
                        </button>
                        <button
                          className="finish-link"
                          onClick={async () => {
                            await persist({
                              ...state,
                              services: state.services.map((item) =>
                                item.id === s.id
                                  ? { ...item, available: !item.available }
                                  : item,
                              ),
                            });
                          }}
                        >
                          {s.available ? "Pausar" : "Disponibilizar"}
                        </button>
                        <button
                          className="finish-link danger"
                          onClick={async () => {
                            setRemoved({ kind: "service", item: s });
                            if (
                              !(await persist({
                                ...state,
                                services: state.services.filter(
                                  (item) => item.id !== s.id,
                                ),
                              }))
                            )
                              return;
                            setFeedback(
                              "Atendimento removido do perfil público.",
                            );
                          }}
                        >
                          <Trash2 size={16} />
                          Remover
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section>
              <div className="finish-section-head">
                <div>
                  <h3>Notícias para quem visita</h3>
                  <p>
                    Publicações do perfil público são separadas dos comunicados
                    internos da corrente.
                  </p>
                </div>
                <button
                  className="wf-button"
                  onClick={() => {
                    setError("");
                    setPost({
                      id: crypto.randomUUID(),
                      title: "",
                      text: "",
                      published: false,
                      updated: new Date().toISOString(),
                    });
                  }}
                >
                  <Plus size={17} />
                  Nova publicação
                </button>
              </div>
              <label className="wf-search">
                <Search size={18} />
                <input
                  aria-label="Buscar publicação pública"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar no título ou no texto"
                />
              </label>
              {!(empty ? [] : state.posts).filter((p) =>
                textMatch(p.title + " " + p.text, query),
              ).length && (
                <WorkflowEmpty
                  title="Nenhuma publicação encontrada."
                  text="Crie um texto ou ajuste sua busca."
                />
              )}
              {(empty ? [] : state.posts)
                .filter((p) => textMatch(p.title + " " + p.text, query))
                .map((p) => (
                  <article className="radar-post" key={p.id}>
                    <div>
                      <span className="finish-status neutral">
                        {p.published ? "Visível no perfil público" : "Rascunho"}
                      </span>
                      <small>{localDate(p.updated)} · Brasília</small>
                    </div>
                    <h3>{p.title}</h3>
                    <p>{p.text}</p>
                    <div className="finish-actions">
                      <button
                        className="finish-link"
                        onClick={() => {
                          setError("");
                          setPost({ ...p });
                        }}
                      >
                        <Pencil size={16} />
                        Editar publicação
                      </button>
                      <button
                        className="finish-link"
                        onClick={() => setPublishPost(p.id)}
                      >
                        {p.published
                          ? "Retirar do perfil"
                          : "Exibir no perfil público"}
                      </button>
                      <button
                        className="finish-link danger"
                        onClick={async () => {
                          setRemoved({ kind: "post", item: p });
                          if (
                            !(await persist({
                              ...state,
                              posts: state.posts.filter(
                                (item) => item.id !== p.id,
                              ),
                            }))
                          )
                            return;
                          setFeedback("Publicação removida do perfil público.");
                        }}
                      >
                        <Trash2 size={16} />
                        Remover
                      </button>
                    </div>
                  </article>
                ))}
            </section>
          )}
        </section>
      </div>
      <div className="rs-save-bar">
        <div>
          <span className={dirty ? "rs-draft-dot" : "rs-live-dot"} />
          <strong>
            {busy
              ? "Preparando ou salvando…"
              : dirty
                ? "Há alterações no rascunho"
                : "Perfil salvo no sistema"}
          </strong>
          <small>Salvar atualiza o perfil público no sistema.</small>
        </div>
        <div>
          <button
            type="button"
            className="rs-discard-button"
            disabled={!dirty || busy}
            onClick={() => setDiscard(true)}
          >
            Descartar rascunho
          </button>
          <button
            type="button"
            className="wf-button"
            disabled={!dirty || busy}
            onClick={saveProfile}
          >
            <Check size={17} />
            Salvar perfil do Radar
          </button>
        </div>
      </div>
      <HouseStateTools mode={mode} onChange={setMode} />
      <p className="finish-note">
        Fotos do Radar são independentes da Galeria interna. As alterações
        confirmadas são publicadas no perfil real da casa.
      </p>
      <RadarVisitor
        open={preview}
        onOpenChange={setPreview}
        state={state}
        onView={setViewMedia}
      />
      <RadarImageViewer media={viewMedia} onClose={() => setViewMedia(null)} />
      <WorkflowDialog
        open={visibility}
        onOpenChange={setVisibility}
        title={
          state.published ? "Ocultar perfil público?" : "Exibir perfil público?"
        }
        description="A visibilidade usa os dados salvos; seu rascunho permanece preservado."
      >
        <p>
          {state.published
            ? "O conteúdo ficará preservado e deixará de aparecer no perfil público."
            : "Nome, contatos, imagens e textos salvos aparecerão no perfil público da casa na internet."}
        </p>
        <div className="wf-confirm-actions">
          <button
            className="wf-button secondary"
            onClick={() => setVisibility(false)}
          >
            Voltar
          </button>
          <button
            className="wf-button"
            onClick={async () => {
              if (!(await persist({ ...state, published: !state.published })))
                return;
              setVisibility(false);
              setFeedback("Visibilidade do perfil público atualizada.");
            }}
          >
            Confirmar visibilidade
          </button>
        </div>
      </WorkflowDialog>
      <WorkflowDialog
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar alterações do perfil?"
        description="A versão salva será mantida. As edições e imagens ainda não salvas sairão do rascunho."
      >
        <div className="wf-confirm-actions">
          <button
            className="wf-button secondary"
            onClick={() => setDiscard(false)}
          >
            Continuar editando
          </button>
          <button
            className="wf-button"
            onClick={() => {
              onDraftChange(radarProfileDraft(state));
              setDiscard(false);
              setError("");
              setFeedback("Rascunho restaurado a partir do perfil salvo.");
            }}
          >
            Descartar edição
          </button>
        </div>
      </WorkflowDialog>
      <WorkflowDialog
        open={!!service}
        onOpenChange={(open) => !open && setService(null)}
        title="Atendimento público"
        description="Estas informações aparecerão no perfil público da casa. Não cria agendamento ou pagamento."
      >
        {service && (
          <form onSubmit={saveService}>
            <label className="wf-field">
              Nome do atendimento
              <input
                required
                maxLength={80}
                value={service.name}
                onChange={(e) =>
                  setService({ ...service, name: e.target.value })
                }
              />
            </label>
            <label className="wf-field">
              Descrição
              <textarea
                required
                maxLength={500}
                value={service.description}
                onChange={(e) =>
                  setService({ ...service, description: e.target.value })
                }
              />
            </label>
            <label className="wf-field">
              Duração em minutos
              <input
                required
                type="number"
                min={5}
                max={480}
                value={service.minutes}
                onChange={(e) =>
                  setService({ ...service, minutes: Number(e.target.value) })
                }
              />
            </label>
            <label className="finish-check">
              <input
                type="checkbox"
                checked={service.available}
                onChange={(e) =>
                  setService({ ...service, available: e.target.checked })
                }
              />
              Disponível para visitantes
            </label>
            {error && (
              <p className="wf-error" role="alert">
                {error}
              </p>
            )}
            <button className="wf-button">Salvar atendimento</button>
          </form>
        )}
      </WorkflowDialog>
      <WorkflowDialog
        open={!!post}
        onOpenChange={(open) => !open && setPost(null)}
        title="Texto do perfil público"
        description="Novos textos começam como rascunho. Você pode publicá-los no perfil público após salvar."
      >
        {post && (
          <form onSubmit={savePost}>
            <label className="wf-field">
              Título da publicação
              <input
                required
                maxLength={100}
                value={post.title}
                onChange={(e) => setPost({ ...post, title: e.target.value })}
              />
            </label>
            <label className="wf-field">
              Conteúdo
              <textarea
                required
                maxLength={2000}
                value={post.text}
                onChange={(e) => setPost({ ...post, text: e.target.value })}
              />
            </label>
            {error && (
              <p className="wf-error" role="alert">
                {error}
              </p>
            )}
            <button className="wf-button">Salvar texto</button>
          </form>
        )}
      </WorkflowDialog>
      <WorkflowDialog
        open={!!publishPost}
        onOpenChange={(open) => !open && setPublishPost(null)}
        title="Alterar publicação no perfil?"
        description="O texto será mostrado ou retirado do perfil público na internet."
      >
        <div className="wf-confirm-actions">
          <button
            className="wf-button secondary"
            onClick={() => setPublishPost(null)}
          >
            Voltar
          </button>
          <button
            className="wf-button"
            onClick={async () => {
              if (
                !(await persist({
                  ...state,
                  posts: state.posts.map((p) =>
                    p.id === publishPost
                      ? {
                          ...p,
                          published: !p.published,
                          updated: new Date().toISOString(),
                        }
                      : p,
                  ),
                }))
              )
                return;
              setPublishPost(null);
              setFeedback("Publicação atualizada no perfil público.");
            }}
          >
            Confirmar publicação
          </button>
        </div>
      </WorkflowDialog>
    </div>
  );
}
