import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Film,
  Heart,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import BodyPortal from '../components/BodyPortal';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import { AppPrimaryButton, appInputClass, appLabelClass } from '../components/ui/appDemoUi';
import { MODAL_DLG_DONE, MODAL_DLG_IN, MODAL_DLG_OUT, MODAL_TW } from '../lib/modalMotion';
import { authFetch } from '../lib/authenticatedFetch';

interface GalleryProps {
  tenantData?: any;
  userRole?: string;
  isAdminGlobal?: boolean;
  setActiveTab: (tab: string) => void;
}

type GalleryCategory = 'gira' | 'evento' | 'lembranca';
type GalleryFilter = 'tudo' | GalleryCategory;

type MediaItem = {
  id: string;
  album_id: string;
  media_type: 'image' | 'video';
  file_name: string;
  mime_type: string;
  size_bytes: number;
  public_url: string;
  created_at: string;
  title?: string | null;
  caption?: string | null;
  category?: GalleryCategory | null;
  likes_count?: number;
  author_name?: string | null;
};

type AlbumItem = {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  category?: GalleryCategory | null;
  created_at: string;
  media: MediaItem[];
};

type ToastState = { message: string; type: 'success' | 'info' | 'error' } | null;

const FILTER_CHIPS: { value: GalleryFilter; label: string }[] = [
  { value: 'tudo', label: 'Ver Tudo 🎨' },
  { value: 'gira', label: 'Giras de Santo 🕯️' },
  { value: 'evento', label: 'Festas & Rituais 🏛️' },
  { value: 'lembranca', label: 'União do Terreiro 🌿' },
];

const CATEGORY_BADGE: Record<GalleryCategory, string> = {
  gira: 'bg-yellow-950/50 text-[#FACC15] border-yellow-500/20',
  evento: 'bg-blue-950/50 text-cyan-400 border-cyan-500/20',
  lembranca: 'bg-emerald-950/50 text-[#10B981] border-emerald-500/20',
};

const CATEGORY_LABEL: Record<GalleryCategory, string> = {
  gira: 'Gira Ativa',
  evento: 'Festa / Ritual',
  lembranca: 'Preceito',
};

function formatMuralDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

function getAlbumCategory(album: AlbumItem): GalleryCategory {
  if (album.category) return album.category;
  const fromMedia = album.media.find((item) => item.category)?.category;
  return (fromMedia as GalleryCategory) || 'lembranca';
}

function showToast(
  setter: React.Dispatch<React.SetStateAction<ToastState>>,
  message: string,
  type: ToastState['type'] = 'info',
) {
  setter({ message, type });
}

function patchAlbumMedia(albums: AlbumItem[], albumId: string, media: MediaItem[]): AlbumItem[] {
  return albums.map((album) =>
    album.id === albumId ? { ...album, media } : album,
  );
}

type AddAlbumModalPanelProps = {
  onClose: () => void;
  onPublish: () => void;
  albumName: string;
  setAlbumName: (value: string) => void;
  albumCategory: GalleryCategory;
  setAlbumCategory: (value: GalleryCategory) => void;
  albumDescription: string;
  setAlbumDescription: (value: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedFiles: File[];
  previewUrls: string[];
  onSelectFiles: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  zeladorName: string;
};

function AddAlbumModalPanel({
  onClose,
  onPublish,
  albumName,
  setAlbumName,
  albumCategory,
  setAlbumCategory,
  albumDescription,
  setAlbumDescription,
  fileInputRef,
  selectedFiles,
  previewUrls,
  onSelectFiles,
  onClear,
  uploading,
  uploadProgress,
  zeladorName,
}: AddAlbumModalPanelProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-4 pt-20 sm:p-8 sm:pt-24">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={MODAL_TW}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, x: 48 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 32 }}
        transition={MODAL_TW}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-album-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[101] flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Camera className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 id="add-album-title" className="text-base font-black text-white sm:text-lg">
                Novo álbum
              </h3>
              <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500">
                Criar álbum com fotos da gira ou evento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] lg:gap-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
              <div>
                <label className={appLabelClass}>Nome do álbum</label>
                <input
                  type="text"
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  placeholder="Ex: Gira de Ogum — Março 2026"
                  className={appInputClass}
                />
              </div>
              <div>
                <label className={appLabelClass}>Tipo da atividade</label>
                <select
                  value={albumCategory}
                  onChange={(e) => setAlbumCategory(e.target.value as GalleryCategory)}
                  className={cn(appInputClass, 'cursor-pointer')}
                >
                  <option value="gira">Gira de Trabalho</option>
                  <option value="evento">Festa / Evento Público</option>
                  <option value="lembranca">Lembrança das Linhagens</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={appLabelClass}>Legenda do álbum</label>
                <textarea
                  value={albumDescription}
                  onChange={(e) => setAlbumDescription(e.target.value)}
                  rows={2}
                  placeholder="Breve história sobre a gira, as entidades que trabalharam…"
                  className={cn(appInputClass, 'resize-none')}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={appLabelClass}>Fotos e vídeos (múltiplos)</label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Selecionar fotos / vídeos
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={onSelectFiles}
                    disabled={uploading}
                  />
                  {selectedFiles.length > 0 ? (
                    <span className="text-[11px] text-gray-400">
                      {selectedFiles.length} arquivo(s) selecionado(s)
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex min-h-[10.5rem] flex-col space-y-3 rounded-2xl border border-[#1E242B] bg-[#0C0E12]/80 p-4 lg:min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Pré-visualização
                </span>
                {selectedFiles.length > 0 ? (
                  <button
                    type="button"
                    onClick={onClear}
                    className="text-[9px] font-bold text-gray-500 hover:text-white"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
              {previewUrls.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#1E242B] bg-[#12161A] px-4 py-8 text-center">
                  <p className="text-[10px] text-gray-500">
                    Selecione várias fotos de uma gira — todas ficarão neste álbum.
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 flex-wrap content-start gap-2">
                  {previewUrls.map((url, index) => {
                    const file = selectedFiles[index];
                    const isVideo = file?.type.startsWith('video/');
                    return (
                      <div
                        key={url}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#1E242B] bg-black sm:h-[4.5rem] sm:w-[4.5rem]"
                      >
                        {isVideo ? (
                          <video src={url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4 sm:mt-6">
            <p className="font-mono text-[9.5px] italic text-gray-500">
              Assinado por {zeladorName} (Zeladoria)
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {(albumName || selectedFiles.length > 0) && (
                <button
                  type="button"
                  onClick={onClear}
                  disabled={uploading}
                  className="cursor-pointer px-4 py-2 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50"
                >
                  Limpar
                </button>
              )}
              <AppPrimaryButton
                type="button"
                onClick={onPublish}
                disabled={uploading}
                className="inline-flex min-w-[10rem] items-center justify-center"
              >
                {uploading
                  ? `Enviando ${uploadProgress.current}/${uploadProgress.total}…`
                  : 'Publicar álbum'}
              </AppPrimaryButton>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Gallery({ tenantData, userRole, isAdminGlobal }: GalleryProps) {
  const isAdmin = userRole !== 'filho' || !!isAdminGlobal;
  const tenantId = String(tenantData?.tenant_id || '').trim();
  const zeladorName =
    String(tenantData?.nome_zelador || tenantData?.nome || '').trim() || 'Zelador';

  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [activeFilter, setActiveFilter] = useState<GalleryFilter>('tudo');
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [addAlbumModalOpen, setAddAlbumModalOpen] = useState(false);

  const [albumName, setAlbumName] = useState('');
  const [albumCategory, setAlbumCategory] = useState<GalleryCategory>('gira');
  const [albumDescription, setAlbumDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === selectedAlbumId) || null,
    [albums, selectedAlbumId],
  );

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  useEffect(() => {
    if (!lightboxItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxItem]);

  const fetchGallery = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const response = await authFetch(`/api/v1/gallery/albums?tenantId=${tenantId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar galeria');
      setAlbums((payload.albums || []).filter((album: AlbumItem) => album.media?.length > 0));
    } catch (error: any) {
      showToast(setToast, error.message || 'Erro ao carregar galeria', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchGallery();
  }, [tenantId]);

  const createAlbum = async (): Promise<AlbumItem> => {
      const response = await authFetch('/api/v1/gallery/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
        name: albumName.trim(),
          description: albumDescription.trim(),
        category: albumCategory,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao criar álbum');
    return { ...payload.album, media: [] } as AlbumItem;
  };

  const uploadSingleFile = async (
    file: File,
    albumId: string,
    albumTitle: string,
    albumCaption: string,
    category: GalleryCategory,
    index: number,
    total: number,
  ) => {
        const uploadPrep = await authFetch('/api/v1/gallery/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
        albumId,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        });
        const uploadPrepJson = await uploadPrep.json();
        if (!uploadPrep.ok) throw new Error(uploadPrepJson.error || 'Erro ao preparar upload');

        const uploadToR2 = await fetch(uploadPrepJson.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadToR2.ok) throw new Error(`Falha ao enviar arquivo ${file.name}`);

    const photoTitle = total > 1 ? `${albumTitle} — foto ${index + 1}` : albumTitle;

        const completeResponse = await authFetch('/api/v1/gallery/complete-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
        albumId,
            storageKey: uploadPrepJson.storageKey,
            publicUrl: uploadPrepJson.publicUrl,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
        title: photoTitle,
        caption: albumCaption,
        category,
          }),
        });
        const completeJson = await completeResponse.json();
        if (!completeResponse.ok) throw new Error(completeJson.error || 'Erro ao finalizar upload');
    return completeJson.media as MediaItem;
  };

  const onSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    if (files.length === 0) {
      showToast(setToast, 'Selecione fotos ou vídeos do seu dispositivo.', 'error');
      return;
    }
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles(files);
    setPreviewUrls(files.map((file) => URL.createObjectURL(file)));
    event.target.value = '';
  };

  const clearPublishForm = () => {
    setAlbumName('');
    setAlbumDescription('');
    setAlbumCategory('gira');
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
  };

  const publishAlbum = async () => {
    if (!albumName.trim()) {
      showToast(setToast, 'Defina o nome do álbum!', 'error');
      return;
    }
    if (selectedFiles.length === 0) {
      showToast(setToast, 'Selecione ao menos uma foto ou vídeo do dispositivo.', 'error');
      return;
    }
    if (!tenantId) return;

    const title = albumName.trim();
    const caption = albumDescription.trim();

    try {
      setUploading(true);
      setUploadProgress({ current: 0, total: selectedFiles.length });

      const album = await createAlbum();
      const uploaded: MediaItem[] = [];

      for (let i = 0; i < selectedFiles.length; i += 1) {
        setUploadProgress({ current: i + 1, total: selectedFiles.length });
        const media = await uploadSingleFile(
          selectedFiles[i],
          album.id,
          title,
          caption,
          albumCategory,
          i,
          selectedFiles.length,
        );
        uploaded.push(media);
      }

      const newAlbum: AlbumItem = { ...album, media: uploaded };
      setAlbums((prev) => [newAlbum, ...prev]);
      clearPublishForm();
      setAddAlbumModalOpen(false);
      showToast(
        setToast,
        `Álbum "${title}" criado com ${uploaded.length} foto(s)!`,
        'success',
      );
    } catch (error: any) {
      showToast(setToast, error.message || 'Erro ao publicar álbum', 'error');
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const deletePhoto = async (photo: MediaItem) => {
    const confirmDel = window.confirm(
      `Deseja mesmo remover "${photo.title || photo.file_name}" deste álbum?`,
    );
    if (!confirmDel) return;

    try {
      const response = await authFetch(
        `/api/v1/gallery/media/${photo.id}?tenantId=${encodeURIComponent(tenantId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao remover foto');

      setAlbums((prev) => {
        const next = prev
          .map((album) =>
            album.id === photo.album_id
              ? { ...album, media: album.media.filter((item) => item.id !== photo.id) }
              : album,
          )
          .filter((album) => album.media.length > 0);

        if (selectedAlbumId && !next.some((album) => album.id === selectedAlbumId)) {
          setSelectedAlbumId(null);
        }
        return next;
      });

      if (lightboxItem?.id === photo.id) setLightboxItem(null);
      showToast(setToast, 'Foto removida do álbum.', 'info');
    } catch (error: any) {
      showToast(setToast, error.message || 'Erro ao remover foto', 'error');
    }
  };

  const deleteAlbum = async (album: AlbumItem) => {
    const confirmDel = window.confirm(
      `Deseja mesmo remover o álbum "${album.name}" e todas as ${album.media.length} foto(s) da corrente?`,
    );
    if (!confirmDel) return;

    try {
      const response = await authFetch(
        `/api/v1/gallery/albums/${album.id}?tenantId=${encodeURIComponent(tenantId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao remover álbum');

      setAlbums((prev) => prev.filter((item) => item.id !== album.id));
      if (selectedAlbumId === album.id) setSelectedAlbumId(null);
      showToast(setToast, `Álbum "${album.name}" removido.`, 'info');
    } catch (error: any) {
      showToast(setToast, error.message || 'Erro ao remover álbum', 'error');
    }
  };

  const sendAxe = async (photo: MediaItem) => {
    try {
      const response = await authFetch(`/api/v1/gallery/media/${photo.id}/axe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao enviar Axé');

      const updated = payload.media as MediaItem;
      setAlbums((prev) =>
        patchAlbumMedia(
          prev,
          photo.album_id,
          prev
            .find((a) => a.id === photo.album_id)
            ?.media.map((item) => (item.id === photo.id ? updated : item)) || [],
        ),
      );
      if (lightboxItem?.id === photo.id) setLightboxItem(updated);
      showToast(setToast, `Você enviou vibrações de Axé! ✨`, 'success');
    } catch (error: any) {
      showToast(setToast, error.message || 'Erro ao enviar Axé', 'error');
    }
  };

  const filteredAlbums = useMemo(() => {
    const withMedia = albums.filter((album) => album.media.length > 0);
    if (activeFilter === 'tudo') return withMedia;
    return withMedia.filter((album) => getAlbumCategory(album) === activeFilter);
  }, [albums, activeFilter]);

  const closeAddAlbumModal = () => {
    if (uploading) return;
    setAddAlbumModalOpen(false);
  };

  const renderPhotoCard = (photo: MediaItem) => {
    const category = (photo.category || 'lembranca') as GalleryCategory;
    const badgeClass = CATEGORY_BADGE[category] || CATEGORY_BADGE.lembranca;

  return (
      <motion.div
        key={photo.id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative flex h-full transform flex-col justify-between overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-500/20 hover:shadow-lg"
      >
        <button
          type="button"
          onClick={() => setLightboxItem(photo)}
          className="relative aspect-video w-full overflow-hidden bg-black/40 text-left"
        >
          {photo.media_type === 'video' ? (
            <>
              <video
                src={photo.public_url}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                muted
                playsInline
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                <Film className="h-8 w-8 text-white/80" />
              </div>
            </>
          ) : (
            <img
              src={photo.public_url}
              alt={photo.title || photo.file_name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
          <div className="absolute left-2 top-2">
            <span className={cn('rounded border px-2.5 py-0.5 text-[8.5px] font-black uppercase', badgeClass)}>
              {CATEGORY_LABEL[category]}
            </span>
          </div>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => void deletePhoto(photo)}
            className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-[#1E242B] bg-black/60 text-zinc-400 transition-all hover:bg-rose-950 hover:text-rose-400"
            title="Remover foto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="flex flex-grow flex-col justify-between space-y-3.5 p-4">
          <div className="space-y-1.5">
            <h6 className="font-display text-xs font-black leading-snug text-white transition-colors group-hover:text-[#FACC15]">
              {photo.title || photo.file_name}
            </h6>
            <p className="line-clamp-3 text-[10.5px] font-light leading-relaxed text-gray-400">
              {photo.caption || 'Memória com boas energias guardadas no mural do terreiro.'}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2.5 border-t border-[#1E242B]/80 pt-3 text-[9.5px]">
            <div className="max-w-[60%] space-y-0.5 text-gray-500">
              <span className="block truncate font-black text-[#F1F5F9]/80">
                Por: {photo.author_name || zeladorName}
              </span>
              <span className="block font-mono text-[8.5px]">{formatMuralDate(photo.created_at)}</span>
            </div>
            <button
              type="button"
              onClick={() => void sendAxe(photo)}
              className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-xl border border-rose-500/10 bg-rose-950/20 px-2.5 py-1.5 font-bold text-rose-400 transition-all hover:bg-rose-950/50 active:scale-95"
            >
              <Heart className="h-3.5 w-3.5 fill-rose-500/20 text-rose-500" />
              <span>{photo.likes_count || 0} Axé</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const getAlbumAxeTotal = (album: AlbumItem) =>
    album.media.reduce((sum, item) => sum + Number(item.likes_count || 0), 0);

  const getAlbumAuthor = (album: AlbumItem) =>
    album.media[0]?.author_name || zeladorName;

  const renderAlbumCard = (album: AlbumItem) => {
    const category = getAlbumCategory(album);
    const badgeClass = CATEGORY_BADGE[category];
    const cover = album.media.find((m) => m.media_type === 'image') || album.media[0];
    const totalAxe = getAlbumAxeTotal(album);
    const author = getAlbumAuthor(album);

    return (
      <motion.div
                key={album.id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        role="button"
        tabIndex={0}
                onClick={() => setSelectedAlbumId(album.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedAlbumId(album.id);
          }
        }}
        className="group relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-500/20 hover:shadow-lg"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-black/40">
          {cover ? (
            cover.media_type === 'video' ? (
              <>
                <video
                  src={cover.public_url}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Film className="h-8 w-8 text-white/80" />
                </div>
              </>
            ) : (
              <img
                src={cover.public_url}
                alt={album.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="h-10 w-10 text-gray-600" />
            </div>
          )}

          <div className="absolute left-2 top-2 flex items-center gap-1">
            <span
              className={cn(
                'rounded border px-2.5 py-0.5 text-[8.5px] font-black uppercase',
                badgeClass,
              )}
            >
              {CATEGORY_LABEL[category]}
            </span>
                </div>

          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void deleteAlbum(album);
              }}
              className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-[#1E242B] bg-black/60 text-zinc-400 transition-all hover:bg-rose-950 hover:text-rose-400"
              title="Deletar álbum"
            >
              <Trash2 className="h-3.5 w-3.5" />
              </button>
          )}
        </div>

        <div className="flex flex-grow flex-col justify-between space-y-3.5 p-4">
          <div className="space-y-1.5">
            <h6 className="font-display text-xs font-black leading-snug text-white transition-colors group-hover:text-[#FACC15]">
              {album.name}
            </h6>
            <p className="line-clamp-3 text-[10.5px] font-light leading-relaxed text-gray-400">
              {album.description ||
                'Memória com boas energias guardadas no mural do terreiro.'}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2.5 border-t border-[#1E242B]/80 pt-3 text-[9.5px]">
            <div className="max-w-[60%] space-y-0.5 text-gray-500">
              <span className="block truncate font-black text-[#F1F5F9]/80">Por: {author}</span>
              <span className="block font-mono text-[8.5px]">{formatMuralDate(album.created_at)}</span>
            </div>

            <div
              className="flex shrink-0 select-none items-center gap-1.5 rounded-xl border border-rose-500/10 bg-rose-950/20 px-2.5 py-1.5 font-bold text-rose-400"
              onClick={(e) => e.stopPropagation()}
              title={`${album.media.length} foto(s) · ${totalAxe} Axé no álbum`}
            >
              <Heart className="h-3.5 w-3.5 fill-rose-500/20 text-rose-500" />
              <span>{totalAxe} Axé</span>
            </div>
          </div>
              </div>
      </motion.div>
    );
  };

  return (
    <AppPageShell>
      <div className="space-y-6 animate-fadeIn text-[#F1F5F9]">
        {toast && (
          <div
            className={cn(
              'fixed right-4 top-20 z-[90] max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl',
              toast.type === 'success' && 'border-emerald-500/30 bg-emerald-950/95 text-emerald-100',
              toast.type === 'info' && 'border-sky-500/30 bg-sky-950/95 text-sky-100',
              toast.type === 'error' && 'border-rose-500/30 bg-rose-950/95 text-rose-100',
            )}
          >
            {toast.message}
          </div>
        )}

        <div className="flex flex-col gap-4 border-b border-[#1E242B] pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h5 className="flex items-center gap-2 font-display text-xl font-black text-white">
              <ImageIcon className="h-5 w-5 text-amber-500" />
              Relicário de Axé (Álbuns de Lembranças)
            </h5>
            <p className="text-xs text-[#94A3B8]">
              Cada gira ou evento vira um álbum — envie dezenas de fotos de uma vez e organize a memória do terreiro.
            </p>
          </div>

          {isAdmin && !selectedAlbumId && (
            <button
              type="button"
              onClick={() => setAddAlbumModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/35 bg-[#12161A] px-3 py-2 text-xs font-bold text-primary transition-all hover:border-primary/50 hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Novo Álbum
            </button>
          )}
        </div>

        {loading ? (
          <AppPanelLoading />
        ) : selectedAlbum ? (
          <div className="space-y-6">
              <button
              type="button"
                onClick={() => setSelectedAlbumId(null)}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-2 text-xs font-bold text-[#94A3B8] transition hover:border-amber-500/30 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              Voltar aos álbuns
              </button>

            <div className="rounded-2xl border border-[#1E242B] bg-[#13171D] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span
                    className={cn(
                      'mb-2 inline-block rounded border px-2.5 py-0.5 text-[8.5px] font-black uppercase',
                      CATEGORY_BADGE[getAlbumCategory(selectedAlbum)],
                    )}
                  >
                    {CATEGORY_LABEL[getAlbumCategory(selectedAlbum)]}
                  </span>
                  <h2 className="font-display text-xl font-black text-white">{selectedAlbum.name}</h2>
                  {selectedAlbum.description && (
                    <p className="mt-2 max-w-2xl text-sm text-gray-400">{selectedAlbum.description}</p>
                  )}
                  <p className="mt-2 text-[10px] text-gray-500">
                    {selectedAlbum.media.length} foto(s) · {formatMuralDate(selectedAlbum.created_at)} · Por{' '}
                    {selectedAlbum.media[0]?.author_name || zeladorName}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {selectedAlbum.media.length === 0 ? (
                <div className="col-span-full rounded-3xl border border-[#1E242B] bg-[#0C0E12] p-12 text-center text-sm text-gray-500">
                  Este álbum ainda não tem fotos.
                </div>
              ) : (
                selectedAlbum.media.map((photo) => renderPhotoCard(photo))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col gap-4 rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-center sm:text-left">
                <h6 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Álbuns do Terreiro</h6>
                <p className="text-[10px] text-gray-500">Clique em um álbum para ver todas as fotos.</p>
            </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {FILTER_CHIPS.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setActiveFilter(chip.value)}
                    className={cn(
                      'cursor-pointer rounded-xl px-3 py-1.5 text-[10px] font-black transition-all',
                      activeFilter === chip.value
                        ? 'bg-[#D97706] text-white shadow-sm'
                        : 'border border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAlbums.length === 0 ? (
                <div className="col-span-full space-y-3 rounded-3xl border border-[#1E242B] bg-[#0C0E12] p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-lg text-amber-500">
                    📸
                  </div>
                  <h6 className="font-display text-xs font-bold text-white">Nenhum álbum nesta seção</h6>
                  <p className="mx-auto max-w-sm text-[11px] text-gray-500">
                    {isAdmin
                      ? 'Clique em Novo Álbum para publicar fotos da gira ou evento.'
                      : 'Ainda não há álbuns publicados para este filtro.'}
                  </p>
                </div>
              ) : (
                filteredAlbums.map((album) => renderAlbumCard(album))
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {addAlbumModalOpen ? (
          <AddAlbumModalPanel
            onClose={closeAddAlbumModal}
            onPublish={() => void publishAlbum()}
            albumName={albumName}
            setAlbumName={setAlbumName}
            albumCategory={albumCategory}
            setAlbumCategory={setAlbumCategory}
            albumDescription={albumDescription}
            setAlbumDescription={setAlbumDescription}
            fileInputRef={fileInputRef}
            selectedFiles={selectedFiles}
            previewUrls={previewUrls}
            onSelectFiles={onSelectFiles}
            onClear={clearPublishForm}
            uploading={uploading}
            uploadProgress={uploadProgress}
            zeladorName={zeladorName}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxItem && (
          <BodyPortal>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setLightboxItem(null)}
                className="absolute inset-0 bg-black/92"
              />
              <motion.div
                initial={MODAL_DLG_IN}
                animate={MODAL_DLG_DONE}
                exit={MODAL_DLG_OUT}
                transition={MODAL_TW}
                className="relative z-10 flex max-h-[92vh] w-full max-w-[min(96vw,1200px)] flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  className="absolute -right-1 -top-12 z-20 rounded-xl border border-white/10 bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:-right-2 sm:-top-14"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="max-h-[85vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                  {lightboxItem.media_type === 'video' ? (
                    <video
                      src={lightboxItem.public_url}
                      controls
                      playsInline
                      className="mx-auto max-h-[85vh] w-full max-w-full"
                      autoPlay
                    />
                  ) : (
                    <img
                      src={lightboxItem.public_url}
                      alt={lightboxItem.title || lightboxItem.file_name}
                      className="mx-auto max-h-[85vh] w-auto max-w-full object-contain"
                    />
                  )}
                </div>
                <div className="mt-4 max-w-full px-2 text-center">
                  <p className="text-sm font-bold text-white">
                    {lightboxItem.title || lightboxItem.file_name}
                  </p>
                  {lightboxItem.caption && (
                    <p className="mt-1 text-xs text-gray-400">{lightboxItem.caption}</p>
                  )}
                </div>
              </motion.div>
            </div>
          </BodyPortal>
        )}
      </AnimatePresence>
    </AppPageShell>
  );
}
