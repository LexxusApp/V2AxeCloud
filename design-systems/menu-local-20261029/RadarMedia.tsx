import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Eye,
  ImagePlus,
  Landmark,
  Trash2,
} from "lucide-react";
import type { HouseProfile, RadarMedia, RadarProfileDraft } from "./completion";
export function RadarPicture({
  media,
  alt,
  className = "",
  position = "center",
}: {
  media: RadarMedia | null;
  alt: string;
  className?: string;
  position?: string;
}) {
  const [source, setSource] = useState<{ file: File; url: string } | null>(
    null,
  );
  const file = media?.source;
  useEffect(() => {
    if (!file || typeof file === "string") {
      setSource(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSource({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const url =
    typeof file === "string"
      ? file
      : source?.file === file
        ? source?.url
        : undefined;
  return url ? (
    <img
      className={className}
      src={url}
      alt={alt}
      style={{ objectPosition: position }}
    />
  ) : (
    <div className={`rs-image-fallback ${className}`}>
      <Landmark size={32} />
      <span>{media ? "Preparando imagem…" : "Sem imagem"}</span>
    </div>
  );
}
export type RadarMediaKind = "cover" | "portrait" | "gallery";
export function useRadarUploads(
  draft: RadarProfileDraft,
  onChange: (d: RadarProfileDraft) => void,
  onError: (s: string) => void,
  onBusy: (b: boolean) => void,
) {
  const current = useRef({ draft, onChange, onError, onBusy });
  current.current = { draft, onChange, onError, onBusy };
  const serial = useRef(0),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      serial.current++;
    };
  }, []);
  return async (kind: RadarMediaKind, files: File[]) => {
    if (!files.length) return;
    const token = ++serial.current;
    onError("");
    onBusy(true);
    try {
      const limit = kind === "portrait" ? 5 : 8;
      if (
        kind === "gallery" &&
        current.current.draft.gallery.length + files.length > 6
      )
        throw new Error(
          "A galeria do Radar comporta até 6 fotos. Remova uma antes de adicionar mais.",
        );
      const items: RadarMedia[] = [];
      for (const file of files) {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size === 0 ||
          file.size > limit * 1024 * 1024
        )
          throw new Error(
            `Escolha imagens PNG, JPG ou WebP de até ${limit} MB.`,
          );
        const bitmap = await createImageBitmap(file);
        const valid =
          bitmap.width >= 64 &&
          bitmap.height >= 64 &&
          bitmap.width * bitmap.height <= 24000000;
        bitmap.close();
        if (!valid)
          throw new Error(
            "Use imagens com pelo menos 64 × 64 pixels e até 24 megapixels.",
          );
        items.push({
          id: crypto.randomUUID(),
          source: file,
          caption: "",
          illustrative: false,
        });
      }
      if (!alive.current || token !== serial.current) return;
      const d = current.current.draft;
      if (kind === "gallery") {
        if (d.gallery.length + items.length > 6)
          throw new Error("O limite de 6 fotos foi atingido.");
        const keys = d.gallery.map((m) =>
          typeof m.source === "string"
            ? m.source
            : `${m.source.name}:${m.source.size}:${m.source.lastModified}`,
        );
        for (const item of items) {
          const f = item.source as File;
          const key = `${f.name}:${f.size}:${f.lastModified}`;
          if (keys.includes(key))
            throw new Error(
              "Uma das fotos já está na galeria. Escolha outra imagem.",
            );
          keys.push(key);
        }
        current.current.onChange({ ...d, gallery: [...d.gallery, ...items] });
      } else current.current.onChange({ ...d, [kind]: items[0] });
    } catch (e) {
      if (alive.current && token === serial.current)
        current.current.onError(
          e instanceof Error
            ? e.message
            : "Não foi possível ler a imagem. Escolha outro arquivo.",
        );
    } finally {
      if (alive.current && token === serial.current)
        current.current.onBusy(false);
    }
  };
}
export function RadarMediaEditor({
  draft,
  onChange,
  section,
  busy,
  onFiles,
  onView,
  account,
}: {
  draft: RadarProfileDraft;
  onChange: (p: RadarProfileDraft) => void;
  section: "identity" | "gallery";
  busy: boolean;
  onFiles: (kind: RadarMediaKind, files: File[]) => void;
  onView: (m: RadarMedia) => void;
  account: HouseProfile;
}) {
  const coverInput = useRef<HTMLInputElement>(null),
    portraitInput = useRef<HTMLInputElement>(null),
    galleryInput = useRef<HTMLInputElement>(null);
  const [removed, setRemoved] = useState<{
    media: RadarMedia;
    index: number;
  } | null>(null);
  useEffect(() => {
    if (removed && draft.gallery.some((m) => m.id === removed.media.id))
      setRemoved(null);
  }, [draft.gallery, removed]);
  const move = (i: number, offset: number) => {
    const gallery = [...draft.gallery];
    [gallery[i], gallery[i + offset]] = [gallery[i + offset], gallery[i]];
    onChange({ ...draft, gallery });
  };
  const input = (
    ref: typeof coverInput,
    kind: RadarMediaKind,
    multiple = false,
  ) => (
    <input
      ref={ref}
      className="sr-only"
      type="file"
      tabIndex={-1}
      aria-hidden="true"
      aria-label={`Arquivo ${kind === "cover" ? "da capa" : kind === "portrait" ? "da foto de perfil" : "das fotos do Radar"}`}
      accept="image/png,image/jpeg,image/webp"
      multiple={multiple}
      disabled={busy}
      onChange={(e) => {
        onFiles(kind, Array.from(e.target.files || []));
        e.target.value = "";
      }}
    />
  );
  if (section === "gallery")
    return (
      <section className="rs-gallery-editor">
        <div className="rs-section-heading">
          <div>
            <h2>Uma galeria só do Radar.</h2>
            <p>
              Fotos públicas escolhidas para apresentar a casa. Esta coleção é
              independente da Galeria interna.
            </p>
          </div>
          <span className="rs-counter">{draft.gallery.length}/6 fotos</span>
        </div>
        {input(galleryInput, "gallery", true)}
        <div className="rs-gallery-tools">
          <button
            type="button"
            className="wf-button"
            disabled={busy || draft.gallery.length >= 6}
            onClick={() => galleryInput.current?.click()}
          >
            <ImagePlus size={17} />
            {busy ? "Lendo fotos…" : "Adicionar fotos ao Radar"}
          </button>
          {removed &&
            !draft.gallery.some((m) => m.id === removed.media.id) &&
            draft.gallery.length < 6 && (
              <button
                type="button"
                className="finish-link"
                disabled={busy}
                onClick={() => {
                  const gallery = [...draft.gallery];
                  gallery.splice(
                    Math.min(removed.index, gallery.length),
                    0,
                    removed.media,
                  );
                  onChange({ ...draft, gallery });
                  setRemoved(null);
                }}
              >
                Desfazer remoção
              </button>
            )}
        </div>
        {!draft.gallery.length ? (
          <div className="rs-gallery-empty">
            <ImagePlus size={32} />
            <h3>Selecione o que merece ser visto.</h3>
            <p>
              Adicione até 6 imagens autorizadas, com uma legenda para cada uma.
            </p>
          </div>
        ) : (
          <div className="rs-gallery-grid">
            {draft.gallery.map((m, i) => (
              <article key={m.id}>
                <button
                  type="button"
                  className="rs-gallery-open"
                  aria-label={`Ver foto ${i + 1} inteira`}
                  onClick={() => onView(m)}
                >
                  <RadarPicture
                    media={m}
                    alt={m.caption || `Foto pública ${i + 1}`}
                  />
                  <span>
                    <Eye size={15} />
                    Ver inteira
                  </span>
                </button>
                <span className="rs-photo-kind">
                  Imagem selecionada por você
                </span>
                <label className="wf-field">
                  Legenda da foto {i + 1}
                  <input
                    maxLength={160}
                    value={m.caption}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        gallery: draft.gallery.map((item) =>
                          item.id === m.id
                            ? { ...item, caption: e.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <div className="rs-photo-actions">
                  <button
                    type="button"
                    aria-label={`Mover foto ${i + 1} para antes`}
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover foto ${i + 1} para depois`}
                    disabled={busy || i === draft.gallery.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowRight size={17} />
                  </button>
                  <button
                    type="button"
                    className="rs-remove-photo"
                    disabled={busy}
                    onClick={() => {
                      setRemoved({ media: m, index: i });
                      onChange({
                        ...draft,
                        gallery: draft.gallery.filter((x) => x.id !== m.id),
                      });
                    }}
                  >
                    <Trash2 size={16} />
                    Remover foto {i + 1}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="finish-note">
          PNG, JPG ou WebP · até 8 MB por foto. Adicionar, ordenar ou remover só
          fica visível no perfil público depois de salvar.
        </p>
      </section>
    );
  return (
    <div className="rs-media-editor">
      {input(coverInput, "cover")}
      {input(portraitInput, "portrait")}
      <section>
        <div className="rs-section-heading">
          <div>
            <h3>A primeira impressão da casa</h3>
            <p>Uma capa horizontal para acolher quem chega ao perfil.</p>
          </div>
          <button
            type="button"
            className="wf-button secondary"
            disabled={busy}
            onClick={() => coverInput.current?.click()}
          >
            <Camera size={17} />
            {draft.cover ? "Trocar capa" : "Adicionar capa"}
          </button>
        </div>
        <div className="rs-cover-editor">
          <RadarPicture
            media={draft.cover}
            alt="Capa selecionada para o perfil público"
            position={draft.coverPosition}
          />
          {draft.cover && (
            <button type="button" onClick={() => onView(draft.cover!)}>
              <Eye size={16} />
              Ver imagem inteira
            </button>
          )}
        </div>
        <div className="rs-media-options">
          <label className="wf-field">
            Enquadramento da capa
            <select
              value={draft.coverPosition}
              onChange={(e) =>
                onChange({
                  ...draft,
                  coverPosition: e.target
                    .value as RadarProfileDraft["coverPosition"],
                })
              }
            >
              <option value="center">Centralizado</option>
              <option value="top">Priorizar parte superior</option>
              <option value="bottom">Priorizar parte inferior</option>
            </select>
          </label>
          {draft.cover && (
            <button
              type="button"
              className="finish-link danger"
              disabled={busy}
              onClick={() => onChange({ ...draft, cover: null })}
            >
              Remover capa
            </button>
          )}
        </div>
        <small className="rs-photo-kind">
          Use uma foto autorizada. Recomendação: horizontal, 1600 × 500 pixels.{" "}
          PNG/JPG/WebP · até 8 MB.
        </small>
      </section>
      <section className="rs-portrait-editor">
        <RadarPicture
          media={draft.portrait}
          alt="Foto de perfil público selecionada"
        />
        <div>
          <h3>Foto de perfil do Radar</h3>
          <p>
            Escolha uma marca ou imagem da casa. Esta foto é independente da
            imagem privada da conta.
          </p>
          <div className="finish-actions">
            <button
              type="button"
              className="wf-button secondary"
              disabled={busy}
              onClick={() => portraitInput.current?.click()}
            >
              <Camera size={16} />
              {draft.portrait
                ? "Trocar foto de perfil"
                : "Adicionar foto de perfil"}
            </button>
            <button
              type="button"
              className="finish-link"
              disabled={busy || !account.photo}
              onClick={() =>
                onChange({
                  ...draft,
                  portrait: {
                    id: crypto.randomUUID(),
                    source: account.photo!,
                    caption: "Foto escolhida da conta",
                    illustrative: false,
                  },
                })
              }
            >
              Usar foto da conta
            </button>
            {draft.portrait && (
              <button
                type="button"
                className="finish-link danger"
                disabled={busy}
                onClick={() => onChange({ ...draft, portrait: null })}
              >
                Remover foto de perfil
              </button>
            )}
          </div>
          <small className="rs-photo-kind">
            PNG/JPG/WebP · até 5 MB.
            {!account.photo ? " A conta ainda não tem uma foto salva." : ""}
          </small>
        </div>
      </section>
    </div>
  );
}
