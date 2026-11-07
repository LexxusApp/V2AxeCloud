import {
  gallerySaves,
  gallerySubmission,
  type GalleryEditor as Editor,
  type GalleryUploadChoice as UploadChoice,
} from "./galleryBackground";
import PageLoading from "../shared/PageLoading";
import { OperationStatus, useOperationBusy } from "./LocalFeedback";
import { useCreateRequest } from "./useCreateRequest";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  FolderOpen,
  Heart,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  galleryCategories,
  galleryDate,
  gallerySize,
  type GalleryAlbum,
  type GalleryCategory,
  type GalleryMedia,
  type LocalGallery,
} from "./gallery";
import { WorkflowDialog, WorkflowEmpty, textMatch } from "./WorkflowUI";
import { HouseState, HouseStateTools, type HouseMode } from "./HouseStates";
import "./house-shared.css";
import "./gallery.css";

type Props = {
  state: LocalGallery;
  onChange: (state: LocalGallery) => void | Promise<void>;
  scopeKey?: string;
  createRequest: number;
  onCreateHandled: () => void;
};

function useMediaSource(source?: string | File) {
  const [url, setUrl] = useState(() =>
    typeof source === "string" ? source : "",
  );
  useEffect(() => {
    if (!source) {
      setUrl("");
      return;
    }
    if (typeof source === "string") {
      setUrl(source);
      return;
    }
    const next = URL.createObjectURL(source);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [source]);
  return url;
}
function MediaPreview({
  media,
  full = false,
  eager = false,
}: {
  media: Pick<GalleryMedia, "source" | "title" | "type">;
  full?: boolean;
  eager?: boolean;
}) {
  const url = useMediaSource(media.source);
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className="gl-media-failed">
        <ImageIcon size={25} />
        <span>Não foi possível abrir este arquivo.</span>
      </span>
    );
  if (!url)
    return (
      <span
        className="gl-media-loading"
        aria-label="Preparando arquivo local"
      />
    );
  if (media.type === "video")
    return full ? (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        aria-label={media.title}
      />
    ) : (
      <span className="gl-video-preview">
        <Film size={32} />
        <span>Vídeo</span>
      </span>
    );
  return (
    <img
      src={url}
      alt={media.title}
      loading={eager || full ? "eager" : "lazy"}
      decoding="async"
      width={1536}
      height={1024}
      onError={() => setFailed(true)}
    />
  );
}
export default function GalleryPage({
  state,
  onChange,
  createRequest,
  onCreateHandled,
  scopeKey = "local",
}: Props) {
  const operationBusy = useOperationBusy("gallery");
  const backgroundSave = useSyncExternalStore(
    gallerySaves.subscribe,
    () => gallerySaves.snapshot(scopeKey),
    () => undefined,
  );
  const busy = operationBusy || backgroundSave?.phase === "working";
  const submitLock = useRef(false);
  const [mode, setMode] = useState<HouseMode>("ready");
  const [view, setView] = useState("albums");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [likedOnly, setLikedOnly] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorStarted, setEditorStarted] = useState(0);
  const [uploads, setUploads] = useState<UploadChoice[]>([]);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deleteMedia, setDeleteMedia] = useState<GalleryMedia | null>(null),
    [deleteError, setDeleteError] = useState(""),
    [deleting, setDeleting] = useState(false);
  const deleteLock = useRef(false);
  const [deleteAlbumId, setDeleteAlbumId] = useState<string | null>(null);
  const [mediaEditor, setMediaEditor] = useState<GalleryMedia | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [dragging, setDragging] = useState(false);
  const request = useRef(createRequest);
  const fileInput = useRef<HTMLInputElement>(null);
  const sectionHeading = useRef<HTMLHeadingElement>(null);
  const viewerOpener = useRef<HTMLElement | null>(null);
  const records = mode === "empty" ? { albums: [], media: [] } : state;
  const activeAlbum = records.albums.find((a) => a.id === selectedAlbum);
  const albums = records.albums
    .filter(
      (a) =>
        (!activeAlbum || a.id === activeAlbum.id) &&
        (category === "all" || a.category === category) &&
        (!likedOnly ||
          records.media.some((m) => m.albumId === a.id && m.liked)) &&
        (textMatch(`${a.name} ${a.description}`, query) ||
          records.media.some(
            (m) =>
              m.albumId === a.id && textMatch(`${m.title} ${m.caption}`, query),
          )),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "pt-BR")
        : Date.parse(b.created) - Date.parse(a.created),
    );
  const photos = records.media
    .filter(
      (m) =>
        (!activeAlbum || m.albumId === activeAlbum.id) &&
        (category === "all" ||
          records.albums.find((a) => a.id === m.albumId)?.category ===
            category) &&
        (!likedOnly || m.liked) &&
        textMatch(
          `${m.title} ${m.caption} ${records.albums.find((a) => a.id === m.albumId)?.name || ""}`,
          query,
        ),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title, "pt-BR")
        : Date.parse(b.created) - Date.parse(a.created),
    );
  const viewerItems = viewerIds
    .map((id) => state.media.find((m) => m.id === id))
    .filter((m): m is GalleryMedia => !!m);
  const currentMedia = viewerItems.find((m) => m.id === viewerId);
  const viewerIndex = viewerItems.findIndex((m) => m.id === viewerId);
  const viewerUrl = useMediaSource(currentMedia?.source);
  const viewerAlbum = state.albums.find((a) => a.id === currentMedia?.albumId);
  const deletion = state.albums.find((a) => a.id === deleteAlbumId);
  const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;
  const countText = (items: GalleryMedia[]) =>
    `${plural(items.filter((m) => m.type === "image").length, "foto", "fotos")} · ${plural(items.filter((m) => m.type === "video").length, "vídeo", "vídeos")}`;
  const albumMedia = (id: string) =>
    records.media.filter((m) => m.albumId === id);
  const cover = (album: GalleryAlbum) =>
    albumMedia(album.id).find((m) => m.id === album.coverId) ||
    albumMedia(album.id).find((m) => m.type === "image") ||
    albumMedia(album.id)[0];
  function openEditor(album?: GalleryAlbum, add = false) {
    if (busy) return;
    setEditorStarted(Date.now());
    setEditor({
      kind: add ? "add" : album ? "edit" : "new",
      id: album?.id || crypto.randomUUID(),
      name: album?.name || "",
      description: album?.description || "",
      category: album?.category || "lembranca",
    });
    setUploads([]);
    setError("");
  }
  useCreateRequest(createRequest, onCreateHandled, () => {
    openEditor();
  });
  function openAlbum(id: string) {
    setSelectedAlbum(id);
    setView("photos");
    setQuery("");
    setCategory("all");
    setLikedOnly(false);
    setFeedback("");
    requestAnimationFrame(() => {
      sectionHeading.current?.focus({ preventScroll: true });
      sectionHeading.current?.scrollIntoView({ block: "start" });
    });
  }
  function openMedia(media: GalleryMedia) {
    setViewerIds(photos.map((m) => m.id));
    setViewerId(media.id);
    setRetry(0);
  }
  function moveViewer(direction: number) {
    const next = viewerItems[viewerIndex + direction];
    if (next) {
      setViewerId(next.id);
      setRetry(0);
    }
  }
  async function toggleLike(media: GalleryMedia) {
    await onChange({
      ...state,
      media: state.media.map((m) =>
        m.id === media.id ? { ...m, liked: !m.liked } : m,
      ),
    });
  }
  function receiveFiles(files: File[]) {
    const accepted: UploadChoice[] = [];
    const issues: string[] = [];
    for (const file of files) {
      const image = ["image/jpeg", "image/png", "image/webp"].includes(
        file.type,
      );
      const video = ["video/mp4", "video/webm"].includes(file.type);
      if (!image && !video) {
        issues.push(`${file.name}: formato não aceito.`);
        continue;
      }
      if (file.size > (image ? 10 : 30) * 1024 * 1024) {
        issues.push(`${file.name}: excede ${image ? 10 : 30} MB.`);
        continue;
      }
      if (
        uploads.some(
          (m) =>
            m.source instanceof File &&
            m.source.name === file.name &&
            m.source.size === file.size,
        )
      )
        continue;
      accepted.push({
        id: crypto.randomUUID(),
        source: file,
        fileName: file.name,
        title: file.name.replace(/\.[^.]+$/, ""),
        caption: "",
        type: image ? "image" : "video",
        bytes: file.size,
        illustrative: false,
      });
    }
    const remaining = Math.max(0, 12 - uploads.length);
    if (accepted.length > remaining)
      issues.push("Adicione até 12 arquivos por vez.");
    setUploads((previous) => [...previous, ...accepted.slice(0, remaining)]);
    setError(issues.join(" "));
  }
  async function saveAlbum(e: FormEvent) {
    e.preventDefault();
    if (!editor || busy || submitLock.current) return;
    if (editor.kind !== "add" && editor.name.trim().length < 3) {
      setError("Dê um nome ao álbum com pelo menos três caracteres.");
      return;
    }
    if (editor.kind === "add" && !uploads.length) {
      setError("Escolha ao menos um arquivo.");
      return;
    }
    const draft = {
      editor: { ...editor },
      uploads: [...uploads],
      created: new Date().toISOString(),
    };
    const next = gallerySubmission(state, draft);
    submitLock.current = true;
    if (draft.uploads.length) {
      const pending = gallerySaves.start(scopeKey, draft, () => onChange(next));
      if (!pending) {
        submitLock.current = false;
        return;
      }
      // The writer owns the File objects and progress from this point onward.
      // Closing/unmounting the editor only releases its preview object URLs.
      setEditor(null);
      setUploads([]);
      setDragging(false);
      setError("");
      setFeedback("");
      setMode("ready");
      void pending.finally(() => {
        submitLock.current = false;
      });
      return;
    }
    try {
      await onChange(next);
      setEditor(null);
      setUploads([]);
      setMode("ready");
      setFeedback(
        editor.kind === "edit"
          ? "Álbum atualizado no sistema."
          : "Álbum criado no sistema.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "A alteração não foi confirmada.",
      );
    } finally {
      submitLock.current = false;
    }
  }
  function removeMedia(media: GalleryMedia) {
    setDeleteError("");
    setDeleteMedia(media);
  }
  async function confirmDeletion() {
    if (deleteLock.current || (!deleteMedia && !deletion)) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      if (deleteMedia) {
        await onChange({
          ...state,
          media: state.media.filter((row) => row.id !== deleteMedia.id),
        });
        setViewerId(null);
        setDeleteMedia(null);
        setFeedback("Registro excluído do sistema.");
      } else if (deletion) {
        await onChange({
          albums: state.albums.filter((row) => row.id !== deletion.id),
          media: state.media.filter((row) => row.albumId !== deletion.id),
        });
        setDeleteAlbumId(null);
        if (selectedAlbum === deletion.id) setSelectedAlbum(null);
        setFeedback("Álbum excluído do sistema.");
      }
    } catch (reason) {
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : "A exclusão não foi confirmada.",
      );
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  }
  function photoCard(media: GalleryMedia) {
    return (
      <article key={media.id} className="gl-photo">
        <button
          className="gl-photo-open"
          aria-label={`Abrir registro: ${media.title}`}
          onClick={() => openMedia(media)}
        >
          <MediaPreview media={media} />
          <span className="gl-photo-kind">
            {media.type === "video" ? (
              <Film size={13} />
            ) : (
              <ImageIcon size={13} />
            )}
            {typeof media.source === "string"
              ? "Registro da casa"
              : "Arquivo selecionado"}
          </span>
        </button>
        <div className="gl-photo-copy">
          <div>
            <h3>{media.title}</h3>
            <p>{state.albums.find((a) => a.id === media.albumId)?.name}</p>
          </div>
          <button
            className={`gl-like ${media.liked ? "selected" : ""}`}
            aria-label={`${media.liked ? "Retirar meu Axé de" : "Dar Axé para"} ${media.title}`}
            aria-pressed={media.liked}
            onClick={async () => await toggleLike(media)}
          >
            <Heart size={17} fill={media.liked ? "currentColor" : "none"} />
            <span>{media.likeCount ?? (media.liked ? 1 : 0)}</span>
          </button>
        </div>
        <div className="gl-photo-actions">
          <button
            aria-label={`Editar legenda: ${media.title}`}
            onClick={() => {
              setMediaEditor({ ...media });
              setMediaError("");
            }}
          >
            <Pencil size={13} />
            Legenda
          </button>
          {activeAlbum && media.type === "image" && (
            <button
              disabled={cover(activeAlbum)?.id === media.id}
              onClick={async () => {
                await onChange({
                  ...state,
                  albums: state.albums.map((a) =>
                    a.id === media.albumId ? { ...a, coverId: media.id } : a,
                  ),
                });
                setFeedback("Capa do álbum atualizada no sistema.");
              }}
            >
              {cover(activeAlbum)?.id === media.id ? (
                <Check size={13} />
              ) : (
                <Images size={13} />
              )}
              {cover(activeAlbum)?.id === media.id ? "Capa" : "Usar como capa"}
            </button>
          )}
          <button
            aria-label={`Remover registro: ${media.title}`}
            onClick={async () => await removeMedia(media)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </article>
    );
  }
  return (
    <div className="gallery-page">
      {backgroundSave?.phase === "failed" && (
        <section className="gl-upload-recovery" role="alert">
          <div>
            <strong>O envio precisa de atenção.</strong>
            <p>{backgroundSave.message}</p>
            <small>
              A seleção continua disponível enquanto você navega pelo sistema.
            </small>
          </div>
          <div>
            <button
              className="wf-button secondary"
              disabled={busy}
              onClick={() => {
                setEditor({ ...backgroundSave.draft.editor });
                setUploads([...backgroundSave.draft.uploads]);
                setError("");
                setEditorStarted(Date.now());
              }}
            >
              Retomar envio
            </button>
            <button
              className="wf-button secondary"
              disabled={busy}
              onClick={() => gallerySaves.discard(scopeKey)}
            >
              Descartar seleção
            </button>
          </div>
        </section>
      )}
      {feedback && (
        <div className="wf-feedback" role="status">
          <Check size={16} />
          <span>{feedback}</span>
        </div>
      )}
      {mode === "loading" ? (
        <PageLoading route="gallery" />
      ) : mode === "error" ? (
        <HouseState mode={mode} onReset={() => setMode("ready")} />
      ) : (
        <>
          {activeAlbum ? (
            <div className="gl-album-heading">
              <button
                className="gl-back"
                onClick={() => {
                  setSelectedAlbum(null);
                  setView("albums");
                  setQuery("");
                  setCategory("all");
                  setLikedOnly(false);
                }}
              >
                <ArrowLeft size={17} />
                Todos os álbuns
              </button>
              <div>
                <span className="gl-category">
                  {galleryCategories[activeAlbum.category]}
                </span>
                <h2 ref={sectionHeading} tabIndex={-1}>
                  {activeAlbum.name}
                </h2>
                <p>
                  {activeAlbum.description ||
                    "Este álbum ainda não tem descrição."}
                </p>
                <small>
                  Adicionado em {galleryDate(activeAlbum.created)} ·{" "}
                  {countText(albumMedia(activeAlbum.id))}
                </small>
              </div>
              <div>
                <button
                  className="wf-button secondary"
                  onClick={() => openEditor(activeAlbum)}
                >
                  <Pencil size={15} />
                  Editar álbum
                </button>
                <button
                  className="wf-button"
                  onClick={() => openEditor(activeAlbum, true)}
                >
                  <Upload size={16} />
                  Adicionar registros
                </button>
              </div>
            </div>
          ) : (
            <div className="gl-overview">
              <div>
                <h2 ref={sectionHeading} tabIndex={-1}>
                  Memórias que ficam.
                </h2>
                <p>Os encontros, os detalhes e os espaços da casa.</p>
              </div>
              <div>
                <span>
                  <FolderOpen size={16} />
                  {records.albums.length} álbuns
                </span>
                <span>
                  <ImageIcon size={16} />
                  {records.media.filter((m) => m.type === "image").length} fotos
                </span>
                <span>
                  <Film size={16} />
                  {records.media.filter((m) => m.type === "video").length}{" "}
                  vídeos
                </span>
              </div>
            </div>
          )}
          <div className="gl-toolbar">
            <div className="gl-views" aria-label="Visualização da galeria">
              {!activeAlbum && (
                <button
                  aria-pressed={view === "albums"}
                  onClick={() => setView("albums")}
                >
                  <LayoutGrid size={16} />
                  Álbuns
                </button>
              )}
              <button
                aria-pressed={view === "photos" || !!activeAlbum}
                onClick={() => setView("photos")}
              >
                <Images size={16} />
                Fotos e vídeos
              </button>
            </div>
            <label className="wf-search">
              <Search size={16} />
              <input
                aria-label="Buscar na galeria"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nas memórias…"
              />
            </label>
            <select
              aria-label="Ordenar galeria"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Mais recentes</option>
              <option value="name">Nome A–Z</option>
            </select>
            <button
              className={`gl-liked-filter ${likedOnly ? "selected" : ""}`}
              aria-pressed={likedOnly}
              onClick={() => setLikedOnly(!likedOnly)}
            >
              <Heart size={16} />
              Meu Axé
            </button>
          </div>
          {!activeAlbum && (
            <div className="gl-categories" aria-label="Categoria da galeria">
              {[["all", "Tudo"], ...Object.entries(galleryCategories)].map(
                ([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={category === id}
                    onClick={() => setCategory(id)}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          )}

          {view === "albums" && !activeAlbum ? (
            <div className="gl-albums">
              {albums.map((album, i) => {
                const item = cover(album);
                const items = albumMedia(album.id);
                return (
                  <article className="gl-album" key={album.id}>
                    <button
                      className="gl-open-album"
                      aria-label={`Abrir álbum: ${album.name}`}
                      onClick={() => openAlbum(album.id)}
                    >
                      <div className="gl-album-cover">
                        {item ? (
                          <MediaPreview media={item} eager={i === 0} />
                        ) : (
                          <span className="gl-empty-cover">
                            <FolderOpen size={30} />
                            <span>Álbum sem registros</span>
                          </span>
                        )}
                      </div>
                      <div className="gl-album-caption">
                        <span>{galleryCategories[album.category]}</span>
                        <h3>{album.name}</h3>
                        <p>
                          {album.description ||
                            "Adicione os primeiros registros desta memória."}
                        </p>
                        <small>
                          {galleryDate(album.created)} · {items.length}{" "}
                          {items.length === 1 ? "registro" : "registros"}
                        </small>
                        <span className="gl-album-link">
                          Explorar álbum
                          <ArrowRight size={16} />
                        </span>
                      </div>
                    </button>
                    <footer>
                      <span>
                        Arquivos da casa
                      </span>
                      <button
                        aria-label={`Editar álbum: ${album.name}`}
                        onClick={() => openEditor(album)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label={`Remover álbum: ${album.name}`}
                        onClick={() => setDeleteAlbumId(album.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="gl-photos">{photos.map(photoCard)}</div>
          )}
          {((view === "albums" && !activeAlbum && !albums.length) ||
            ((view === "photos" || activeAlbum) && !photos.length)) && (
            <div className="gl-empty">
              <WorkflowEmpty
                title={
                  likedOnly
                    ? "Nenhum registro com seu Axé neste filtro."
                    : query || category !== "all"
                      ? "Nenhuma memória encontrada."
                      : activeAlbum
                        ? "O álbum está pronto para os primeiros registros."
                        : "A história da casa começa a ser guardada aqui."
                }
                text={
                  likedOnly
                    ? "Abra Fotos e vídeos e toque no coração para guardar seus favoritos locais."
                    : activeAlbum
                      ? "Adicione fotos ou vídeos autorizados a este álbum."
                      : "Ajuste os filtros ou crie um álbum para guardar as memórias da casa."
                }
              />
              <button
                className="wf-button secondary"
                onClick={() =>
                  activeAlbum ? openEditor(activeAlbum, true) : openEditor()
                }
              >
                <Plus size={16} />
                {activeAlbum ? "Adicionar registros" : "Criar álbum"}
              </button>
            </div>
          )}
          <div className="gl-footnote">
            <span>
              {view === "albums" && !activeAlbum
                ? `${plural(albums.length, "álbum", "álbuns")} neste filtro`
                : `${plural(photos.length, "registro", "registros")} neste filtro`}
            </span>
            <span>
              {gallerySize(records.media.reduce((sum, m) => sum + m.bytes, 0))}{" "}
              de arquivos da galeria
            </span>
          </div>
        </>
      )}
      <WorkflowDialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditor(null);
            setUploads([]);
            setDragging(false);
          }
        }}
        title={
          editor?.kind === "edit"
            ? "Editar álbum"
            : editor?.kind === "add"
              ? "Adicionar registros"
              : "Criar álbum"
        }
        description="Os arquivos serão enviados para a galeria da casa. Acompanhe a transferência e a confirmação de cada um."
      >
        {editor && (
          <form onSubmit={saveAlbum} noValidate aria-busy={busy}>
            <fieldset disabled={busy}>
              {editor.kind !== "add" ? (
                <>
                  <label className="wf-field">
                    Nome do álbum
                    <input
                      maxLength={90}
                      value={editor.name}
                      onChange={(e) =>
                        setEditor({ ...editor, name: e.target.value })
                      }
                      placeholder="Como você quer guardar essa memória?"
                    />
                  </label>
                  <label className="wf-field">
                    Categoria
                    <select
                      value={editor.category}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          category: e.target.value as GalleryCategory,
                        })
                      }
                    >
                      {Object.entries(galleryCategories).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wf-field">
                    Descrição
                    <textarea
                      className="hs-textarea"
                      rows={3}
                      maxLength={600}
                      value={editor.description}
                      onChange={(e) =>
                        setEditor({ ...editor, description: e.target.value })
                      }
                      placeholder="Conte um pouco sobre este álbum."
                    />
                  </label>
                </>
              ) : (
                <p className="gl-upload-album">
                  Álbum: <strong>{editor.name}</strong>
                </p>
              )}
              {editor.kind !== "edit" && (
                <>
                  <div
                    className={`gl-dropzone ${dragging ? "dragging" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      receiveFiles(Array.from(e.dataTransfer.files));
                    }}
                  >
                    <Upload size={24} />
                    <strong>Escolha fotos ou vídeos</strong>
                    <p>
                      Imagens PNG, JPG e WebP até 10 MB. Vídeos MP4 e WebM até
                      30 MB. Até 12 arquivos por vez.
                    </p>
                    <button
                      type="button"
                      className="wf-button secondary"
                      onClick={() => fileInput.current?.click()}
                    >
                      Selecionar arquivos
                    </button>
                    <input
                      ref={fileInput}
                      tabIndex={-1}
                      className="sr-only"
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                      aria-label="Arquivos para o álbum"
                      onChange={(e) => {
                        receiveFiles(Array.from(e.target.files || []));
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <div className="gl-upload-list">
                    {uploads.map((item) => (
                      <div key={item.id}>
                        <div className="gl-upload-thumb">
                          <MediaPreview media={item} />
                        </div>
                        <span>
                          <strong>{item.fileName}</strong>
                          <small>
                            {gallerySize(item.bytes)} · Arquivo local
                          </small>
                        </span>
                        <button
                          className="gl-icon"
                          type="button"
                          aria-label={`Retirar arquivo: ${item.fileName}`}
                          onClick={() =>
                            setUploads((previous) =>
                              previous.filter((p) => p.id !== item.id),
                            )
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="wf-demo-note">
                    {uploads.length
                      ? `${uploads.length} arquivos selecionados.`
                      : "Você também pode criar o álbum vazio e adicionar os registros depois."}
                  </p>
                </>
              )}
            </fieldset>
            {error && (
              <p className="wf-error" role="alert">
                {error}
              </p>
            )}
            <OperationStatus resource="gallery" since={editorStarted} />
            <button className="wf-button" type="submit" disabled={busy}>
              <Upload size={16} />
              {busy
                ? "Enviando e confirmando…"
                : editor.kind === "new"
                  ? "Criar álbum e enviar"
                  : "Salvar na galeria"}
            </button>
          </form>
        )}
      </WorkflowDialog>
      <WorkflowDialog
        open={!!mediaEditor}
        onOpenChange={(open) => {
          if (!open) setMediaEditor(null);
        }}
        title="Editar registro"
        description="A legenda ajuda a contar a história e a descrever a imagem."
      >
        {mediaEditor && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (mediaEditor.title.trim().length < 2) {
                setMediaError(
                  "Informe um título com pelo menos dois caracteres.",
                );
                return;
              }
              await onChange({
                ...state,
                media: state.media.map((m) =>
                  m.id === mediaEditor.id
                    ? {
                        ...mediaEditor,
                        title: mediaEditor.title.trim(),
                        caption: mediaEditor.caption.trim(),
                      }
                    : m,
                ),
              });
              setMediaEditor(null);
              setFeedback("Título e legenda atualizados na galeria.");
            }}
          >
            <label className="wf-field">
              Título do registro
              <input
                maxLength={110}
                value={mediaEditor.title}
                onChange={(e) =>
                  setMediaEditor({ ...mediaEditor, title: e.target.value })
                }
              />
            </label>
            <label className="wf-field">
              Legenda
              <textarea
                className="hs-textarea"
                rows={4}
                maxLength={1200}
                value={mediaEditor.caption}
                onChange={(e) =>
                  setMediaEditor({ ...mediaEditor, caption: e.target.value })
                }
              />
            </label>
            {mediaError && (
              <p className="wf-error" role="alert">
                {mediaError}
              </p>
            )}
            <button className="wf-button" type="submit">
              Salvar legenda
            </button>
          </form>
        )}
      </WorkflowDialog>
      <WorkflowDialog
        open={!!deletion || !!deleteMedia}
        onOpenChange={(open) => {
          if (!open && !deleteLock.current) {
            setDeleteAlbumId(null);
            setDeleteMedia(null);
            setDeleteError("");
          }
        }}
        title={deleteMedia ? "Excluir este registro?" : "Excluir este álbum?"}
        description="Esta exclusão é permanente. Os arquivos removidos não poderão ser restaurados pelo sistema."
      >
        <div className="gl-delete-summary">
          <strong>{deleteMedia?.title || deletion?.name}</strong>
          {deletion && (
            <p>{albumMedia(deletion.id).length} registros neste álbum.</p>
          )}
        </div>
        {deleteError && (
          <p className="wf-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="wf-confirm-actions">
          <button
            className="wf-button secondary"
            disabled={deleting}
            onClick={() => {
              setDeleteAlbumId(null);
              setDeleteMedia(null);
              setDeleteError("");
            }}
          >
            Cancelar
          </button>
          <button
            className="wf-button"
            disabled={deleting}
            onClick={() => void confirmDeletion()}
          >
            {deleting ? "Excluindo…" : "Excluir permanentemente"}
          </button>
        </div>
      </WorkflowDialog>
      <Dialog.Root
        open={!!currentMedia}
        onOpenChange={(open) => {
          if (!open) setViewerId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="gl-viewer-overlay" />
          <Dialog.Content
            className="gl-viewer"
            onOpenAutoFocus={() => {
              viewerOpener.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              if (viewerOpener.current?.isConnected)
                viewerOpener.current.focus();
              else sectionHeading.current?.focus();
            }}
            onKeyDown={(e) => {
              if ((e.target as HTMLElement).tagName === "VIDEO") return;
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                moveViewer(-1);
              }
              if (e.key === "ArrowRight") {
                e.preventDefault();
                moveViewer(1);
              }
            }}
          >
            {currentMedia && (
              <>
                <header>
                  <div>
                    <Dialog.Title>{currentMedia.title}</Dialog.Title>
                    <Dialog.Description>
                      {viewerAlbum?.name} · {viewerIndex + 1} de{" "}
                      {viewerItems.length}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="gl-viewer-icon"
                      aria-label="Fechar visualizador"
                    >
                      <X size={22} />
                    </button>
                  </Dialog.Close>
                </header>
                <div className="gl-viewer-stage">
                  <button
                    className="gl-viewer-icon"
                    aria-label="Registro anterior"
                    disabled={viewerIndex <= 0}
                    onClick={() => moveViewer(-1)}
                  >
                    <ChevronLeft size={25} />
                  </button>
                  <div className="gl-full-media">
                    <MediaPreview
                      key={`${currentMedia.id}-${retry}`}
                      media={currentMedia}
                      full
                    />
                  </div>
                  <button
                    className="gl-viewer-icon"
                    aria-label="Próximo registro"
                    disabled={viewerIndex === viewerItems.length - 1}
                    onClick={() => moveViewer(1)}
                  >
                    <ChevronRight size={25} />
                  </button>
                </div>
                <div className="gl-viewer-caption">
                  <p>{currentMedia.caption || "Sem legenda neste registro."}</p>
                  <small>
                    Arquivo da galeria{" "}
                    · Adicionado em {galleryDate(currentMedia.created)}
                  </small>
                  <div>
                    <button
                      aria-pressed={currentMedia.liked}
                      onClick={async () => await toggleLike(currentMedia)}
                    >
                      <Heart
                        size={17}
                        fill={currentMedia.liked ? "currentColor" : "none"}
                      />
                      {currentMedia.liked ? "Meu Axé" : "Dar Axé"}
                    </button>
                    {viewerUrl && (
                      <a href={viewerUrl} download={currentMedia.fileName}>
                        <Download size={16} />
                        Baixar arquivo
                      </a>
                    )}
                    <button onClick={() => setRetry((n) => n + 1)}>
                      Recarregar arquivo
                    </button>
                  </div>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <HouseStateTools
        mode={mode}
        onChange={(next) => {
          setMode(next);
          if (next === "empty") setSelectedAlbum(null);
        }}
      />
    </div>
  );
}
