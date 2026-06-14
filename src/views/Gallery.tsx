import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Film,
  Heart,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import BodyPortal from '../components/BodyPortal';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import { appInputClass, appLabelClass } from '../lib/appUiTokens';
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

type MuralItem = {
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

function showToast(setter: React.Dispatch<React.SetStateAction<ToastState>>, message: string, type: ToastState['type'] = 'info') {
  setter({ message, type });
}

export default function Gallery({ tenantData, userRole, isAdminGlobal }: GalleryProps) {
  const isAdmin = userRole !== 'filho' || !!isAdminGlobal;
  const tenantId = String(tenantData?.tenant_id || '').trim();
  const zeladorName =
    String(tenantData?.nome_zelador || tenantData?.nome || '').trim() || 'Zelador';

  const [photos, setPhotos] = useState<MuralItem[]>([]);
  const [muralAlbumId, setMuralAlbumId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<GalleryFilter>('tudo');
  const [lightboxItem, setLightboxItem] = useState<MuralItem | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [newPhotoTitulo, setNewPhotoTitulo] = useState('');
  const [newPhotoLegenda, setNewPhotoLegenda] = useState('');
  const [newPhotoCategoria, setNewPhotoCategoria] = useState<GalleryCategory>('gira');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const mediaList: MuralItem[] = payload.media || [];
      setPhotos(mediaList);

      const muralAlbum =
        (payload.albums || []).find((album: { name?: string }) => album.name === 'Relicário de Axé') ||
        (payload.albums || [])[0];
      if (muralAlbum?.id) setMuralAlbumId(muralAlbum.id);
    } catch (error: any) {
      showToast(setToast, error.message || 'Erro ao carregar galeria', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchGallery();
  }, [tenantId]);

  const ensureMuralAlbum = async (): Promise<string> => {
    if (muralAlbumId) return muralAlbumId;
    const response = await authFetch('/api/v1/gallery/ensure-mural-album', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Erro ao preparar mural');
    const albumId = String(payload.album?.id || '');
    if (!albumId) throw new Error('Álbum do mural indisponível');
    setMuralAlbumId(albumId);
    return albumId;
  };

  const uploadSingleFile = async (file: File, albumId: string, title: string) => {
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
        title,
        caption: newPhotoLegenda.trim(),
        category: newPhotoCategoria,
      }),
    });
    const completeJson = await completeResponse.json();
    if (!completeResponse.ok) throw new Error(completeJson.error || 'Erro ao finalizar upload');
    return completeJson.media as MuralItem;
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
    setNewPhotoTitulo('');
    setNewPhotoLegenda('');
    setNewPhotoCategoria('gira');
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
  };

  const publishMemory = async () => {
    if (!newPhotoTitulo.trim()) {
      showToast(setToast, 'Defina o título da lembrança fotográfica!', 'error');
      return;
    }
    if (selectedFiles.length === 0) {
      showToast(setToast, 'Selecione ao menos uma foto ou vídeo do dispositivo.', 'error');
      return;
    }
    if (!tenantId) return;

    try {
      setUploading(true);
      const albumId = await ensureMuralAlbum();
      const uploaded: MuralItem[] = [];

      for (let i = 0; i < selectedFiles.length; i += 1) {
        const file = selectedFiles[i];
        const title =
          selectedFiles.length > 1
            ? `${newPhotoTitulo.trim()} (${i + 1})`
            : newPhotoTitulo.trim();
        const media = await uploadSingleFile(file, albumId, title);
        uploaded.push(media);
      }

      setPhotos((prev) => [...uploaded, ...prev]);
      clearPublishForm();
      showToast(
        setToast,
        uploaded.length > 1
          ? `${uploaded.length} lembranças eternizadas no mural!`
          : 'Lembrança eternizada no mural e compartilhada com a corrente!',
        'success',
      );
    } catch (error: any) {
      showToast(setToast, error.message || 'Erro ao publicar lembrança', 'error');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo: MuralItem) => {
    const confirmDel = window.confirm(
      `Deseja mesmo remover a lembrança "${photo.title || photo.file_name}" da corrente?`,
    );
    if (!confirmDel) return;

    try {
      const response = await authFetch(
        `/api/v1/gallery/media/${photo.id}?tenantId=${encodeURIComponent(tenantId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao remover lembrança');
      setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
      if (lightboxItem?.id === photo.id) setLightboxItem(null);
      showToast(setToast, 'Lembrança removida do mural.', 'info');
    } catch (error: any) {
      showToast(setToast, error.message || 'Erro ao remover lembrança', 'error');
    }
  };

  const sendAxe = async (photo: MuralItem) => {
    try {
      const response = await authFetch(`/api/v1/gallery/media/${photo.id}/axe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao enviar Axé');

      const updated = payload.media as MuralItem;
      setPhotos((prev) => prev.map((item) => (item.id === photo.id ? updated : item)));
      if (lightboxItem?.id === photo.id) setLightboxItem(updated);
      showToast(setToast, `Você enviou vibrações de Axé para "${photo.title || photo.file_name}"! ✨`, 'success');
    } catch (error: any) {
      showToast(setToast, error.message || 'Erro ao enviar Axé', 'error');
    }
  };

  const filteredPhotos = useMemo(() => {
    if (activeFilter === 'tudo') return photos;
    return photos.filter((photo) => photo.category === activeFilter);
  }, [photos, activeFilter]);

  const totalAxe = useMemo(
    () => photos.reduce((sum, photo) => sum + Number(photo.likes_count || 0), 0),
    [photos],
  );

  const scrollToPublish = () => {
    const el = document.getElementById('add-photo-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    else showToast(setToast, 'Preencha os campos abaixo para publicar uma lembrança!', 'info');
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
              Relicário de Axé (Mural de Lembranças)
            </h5>
            <p className="text-xs text-[#94A3B8]">
              Um álbum sagrado de recordações fotográficas das nossas giras, obrigações rituais e eventos comunitários.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={scrollToPublish}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-black shadow-md transition-all hover:bg-amber-400"
            >
              <Camera className="h-4 w-4" />
              Eternizar Nova Lembrança
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3.5 rounded-xl border border-[#1E242B] bg-[#13171D] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <ImageIcon className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <span className="block text-[8px] font-bold uppercase tracking-widest text-gray-500">
                Lembranças Salvas
              </span>
              <span className="text-lg font-black text-white">{photos.length} Fotos Registradas</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-[#1E242B] bg-[#13171D] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
              <Heart className="h-5 w-5 animate-pulse fill-rose-500/20 text-rose-500" />
            </div>
            <div>
              <span className="block text-[8px] font-bold uppercase tracking-widest text-gray-500">
                Vibrações de Axé
              </span>
              <span className="text-lg font-black text-white">{totalAxe} Consagrações</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-[#1E242B] bg-[#13171D] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
              <User className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <span className="block text-[8px] font-bold uppercase tracking-widest text-gray-500">
                Nível de Membros
              </span>
              <span className="text-lg font-black text-white">Todas as Linhagens Ativas</span>
            </div>
          </div>
        </div>

        {loading ? (
          <AppPanelLoading />
        ) : (
          <div className="space-y-8">
            {isAdmin && (
              <div
                id="add-photo-section"
                className="relative space-y-6 overflow-hidden rounded-3xl border border-amber-500/10 bg-[#13171D] p-6 shadow-xl"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-gradient-to-bl from-amber-500/5 to-transparent blur-3xl" />

                <div className="border-b border-[#1E242B] pb-4">
                  <h6 className="flex items-center gap-2 font-display text-sm font-black text-[#FACC15]">
                    <Camera className="h-4 w-4" />
                    Painel de Publicação Litúrgica (Exclusivo Zeladoria)
                  </h6>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    Selecione fotos ou vídeos do seu celular ou computador para eternizar no mural da corrente.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="space-y-4 lg:col-span-2">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={appLabelClass}>Título da Lembrança</label>
                        <input
                          type="text"
                          value={newPhotoTitulo}
                          onChange={(e) => setNewPhotoTitulo(e.target.value)}
                          placeholder="Ex: Festa da Iansã, Batismo de Abassá..."
                          className={appInputClass}
                        />
                      </div>
                      <div>
                        <label className={appLabelClass}>Tipo da Atividade</label>
                        <select
                          value={newPhotoCategoria}
                          onChange={(e) => setNewPhotoCategoria(e.target.value as GalleryCategory)}
                          className={cn(appInputClass, 'cursor-pointer')}
                        >
                          <option value="gira">Gira de Trabalho</option>
                          <option value="evento">Festa / Evento Público</option>
                          <option value="lembranca">Lembrança das Linhagens</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={appLabelClass}>Breve História ou Legenda Espiritual</label>
                      <textarea
                        value={newPhotoLegenda}
                        onChange={(e) => setNewPhotoLegenda(e.target.value)}
                        rows={2}
                        placeholder="Escreva sobre a energia do dia, as entidades que trabalharam ou o preceito realizado..."
                        className={cn(appInputClass, 'resize-none')}
                      />
                    </div>

                    <div>
                      <label className={appLabelClass}>Arquivos do Dispositivo</label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-60"
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
                        {selectedFiles.length > 0 && (
                          <span className="text-[11px] text-gray-400">
                            {selectedFiles.length} arquivo(s) pronto(s) para envio
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-[#1E242B] bg-[#0C0E12]/80 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#FACC15]">
                        Pré-visualização
                      </span>
                      {selectedFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={clearPublishForm}
                          className="text-[9px] font-bold text-gray-500 hover:text-white"
                        >
                          Limpar
                        </button>
                      )}
                    </div>

                    {previewUrls.length === 0 ? (
                      <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-[#1E242B] bg-[#12161A] text-center">
                        <p className="px-4 text-[10px] text-gray-500">
                          Nenhum arquivo selecionado. Toque em «Selecionar fotos / vídeos» para escolher do dispositivo.
                        </p>
                      </div>
                    ) : (
                      <div className="grid max-h-[200px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                        {previewUrls.map((url, index) => {
                          const file = selectedFiles[index];
                          const isVideo = file?.type.startsWith('video/');
                          return (
                            <div
                              key={url}
                              className="relative aspect-video overflow-hidden rounded-xl border border-[#1E242B] bg-black"
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

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1E242B] pt-4">
                  <span className="font-mono text-[9.5px] italic text-gray-500">
                    Assinado por {zeladorName} (Zeladoria)
                  </span>
                  <div className="flex items-center gap-2">
                    {(newPhotoTitulo || selectedFiles.length > 0) && (
                      <button
                        type="button"
                        onClick={clearPublishForm}
                        disabled={uploading}
                        className="cursor-pointer px-4 py-2 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void publishMemory()}
                      disabled={uploading}
                      className="cursor-pointer rounded-xl border border-emerald-500/25 bg-[#2E5A44]/60 px-5 py-2 text-xs font-extrabold text-[#10B981] shadow transition-all hover:bg-[#2E5A44] disabled:opacity-60"
                    >
                      {uploading ? 'Enviando…' : '🌟 Eternizar no Mural'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-center sm:text-left">
                <h6 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                  Mural de Memórias Ativas
                </h6>
                <p className="text-[10px] text-gray-500">
                  Filtrar os álbuns sagrados publicados de Giras e Eventos Litúrgicos.
                </p>
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
              {filteredPhotos.length === 0 ? (
                <div className="col-span-full space-y-3 rounded-3xl border border-[#1E242B] bg-[#0C0E12] p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-lg text-amber-500">
                    📸
                  </div>
                  <h6 className="font-display text-xs font-bold text-white">
                    Nenhum registro fotográfico nesta seção
                  </h6>
                  <p className="mx-auto max-w-sm text-[11px] text-gray-500">
                    {isAdmin
                      ? 'Envie fotos do seu dispositivo no formulário acima para publicar a primeira lembrança sagrada!'
                      : 'Ainda não foram publicadas lembranças rituais para este filtro.'}
                  </p>
                </div>
              ) : (
                filteredPhotos.map((photo) => {
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
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => void deletePhoto(photo)}
                          className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-[#1E242B] bg-black/60 text-zinc-400 transition-all hover:bg-rose-950 hover:text-rose-400"
                          title="Deletar Lembrança"
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
                            <span className="block font-mono text-[8.5px]">
                              {formatMuralDate(photo.created_at)}
                            </span>
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
                })
              )}
            </div>
          </div>
        )}
      </div>

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
