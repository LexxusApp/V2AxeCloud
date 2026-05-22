import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Film, FolderPlus, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import BodyPortal from '../components/BodyPortal';
import { MODAL_DLG_DONE, MODAL_DLG_IN, MODAL_DLG_OUT, MODAL_TW } from '../lib/modalMotion';
import { authFetch } from '../lib/authenticatedFetch';

interface GalleryProps {
  tenantData?: any;
  userRole?: string;
  isAdminGlobal?: boolean;
  setActiveTab: (tab: string) => void;
}

type MediaItem = {
  id: string;
  album_id: string;
  media_type: 'image' | 'video';
  file_name: string;
  mime_type: string;
  size_bytes: number;
  public_url: string;
  created_at: string;
};

type AlbumItem = {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  created_at: string;
  media: MediaItem[];
};

export default function Gallery({ tenantData, userRole, isAdminGlobal, setActiveTab }: GalleryProps) {
  const isAdmin = userRole !== 'filho' || !!isAdminGlobal;
  const tenantId = String(tenantData?.tenant_id || '').trim();
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [albumName, setAlbumName] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === selectedAlbumId) || null,
    [albums, selectedAlbumId]
  );

  const fetchAlbums = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const response = await authFetch(`/api/v1/gallery/albums?tenantId=${tenantId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar galeria');
      setAlbums(payload.albums || []);
    } catch (error: any) {
      alert(error.message || 'Erro ao carregar galeria');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAlbums();
  }, [tenantId]);

  useEffect(() => {
    if (!lightboxItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxItem]);

  const createAlbum = async () => {
    const name = albumName.trim();
    if (!name || !tenantId) return;
    try {
      const response = await authFetch('/api/v1/gallery/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          name,
          description: albumDescription.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao criar álbum');
      setAlbums((prev) => [payload.album, ...prev]);
      setAlbumName('');
      setAlbumDescription('');
      setIsCreateOpen(false);
    } catch (error: any) {
      alert(error.message || 'Erro ao criar álbum');
    }
  };

  const onUploadMedia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!selectedAlbum || files.length === 0 || !tenantId) return;
    try {
      setUploading(true);
      const uploadedItems: MediaItem[] = [];

      for (const file of files) {
        const uploadPrep = await authFetch('/api/v1/gallery/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            albumId: selectedAlbum.id,
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
            albumId: selectedAlbum.id,
            storageKey: uploadPrepJson.storageKey,
            publicUrl: uploadPrepJson.publicUrl,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        });
        const completeJson = await completeResponse.json();
        if (!completeResponse.ok) throw new Error(completeJson.error || 'Erro ao finalizar upload');
        uploadedItems.push(completeJson.media);
      }

      setAlbums((prev) =>
        prev.map((album) =>
          album.id === selectedAlbum.id ? { ...album, media: [...uploadedItems, ...album.media] } : album
        )
      );
    } catch (error: any) {
      alert(error.message || 'Erro ao enviar mídia');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden">
      <PageHeader
        title={<>Galeria de <span className="text-primary">Fotos e Vídeos</span></>}
        subtitle="Crie álbuns clicáveis e gerencie mídia do seu terreiro."
        tenantData={tenantData}
        setActiveTab={setActiveTab}
        actions={
          isAdmin ? (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-background shadow-lg shadow-primary/20 transition-all hover:scale-105"
            >
              <FolderPlus className="h-4 w-4" />
              Novo Álbum
            </button>
          ) : null
        }
      />

      <div className="mx-auto w-full max-w-[1440px] flex-1 space-y-5 px-4 pb-20 md:px-6 lg:px-10">
        {loading ? (
          <div className="flex h-[45vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !selectedAlbum ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {albums.map((album) => (
              <button
                key={album.id}
                onClick={() => setSelectedAlbumId(album.id)}
                className="card-luxury group rounded-2xl border border-white/5 p-6 text-left transition-all hover:border-primary/30"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-black text-white transition-colors group-hover:text-primary">{album.name}</h3>
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {album.media.length} itens
                  </span>
                </div>
                <p className="mb-6 line-clamp-2 text-sm text-gray-400">{album.description || 'Sem descrição'}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <ImageIcon className="h-4 w-4" />
                  <span>Clique para abrir o álbum</span>
                </div>
              </button>
            ))}

            {albums.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <p className="text-lg font-black text-white">Nenhum álbum criado</p>
                <p className="mt-2 text-sm text-gray-500">Crie o primeiro álbum para começar a enviar fotos e vídeos.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setSelectedAlbumId(null)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para álbuns
              </button>
              {isAdmin && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-background hover:bg-primary/90">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Enviando...' : 'Enviar mídia'}
                  <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onUploadMedia} disabled={uploading} />
                </label>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-black text-white">{selectedAlbum.name}</h2>
              <p className="mt-2 text-sm text-gray-400">{selectedAlbum.description || 'Sem descrição'}</p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {selectedAlbum.media.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <button
                    type="button"
                    onClick={() => setLightboxItem(item)}
                    className="group relative block aspect-video w-full cursor-zoom-in overflow-hidden bg-black text-left outline-none ring-primary/40 focus-visible:ring-2"
                    aria-label={`Ampliar ${item.file_name}`}
                  >
                    {item.media_type === 'image' ? (
                      <img src={item.public_url} alt={item.file_name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <>
                        <video src={item.public_url} className="pointer-events-none h-full w-full object-cover" muted playsInline preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-90 transition-opacity group-hover:bg-black/45">
                          <span className="rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">Toque para assistir</span>
                        </div>
                      </>
                    )}
                  </button>
                  <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
                    <span className="truncate">{item.file_name}</span>
                    <span className={cn('ml-3 inline-flex items-center gap-1', item.media_type === 'video' ? 'text-purple-300' : 'text-blue-300')}>
                      {item.media_type === 'video' ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                      {item.media_type === 'video' ? 'Vídeo' : 'Foto'}
                    </span>
                  </div>
                </div>
              ))}

              {selectedAlbum.media.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                  <p className="text-lg font-black text-white">Álbum vazio</p>
                  <p className="mt-2 text-sm text-gray-500">Envie fotos e vídeos para popular este álbum.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isCreateOpen && (
          <BodyPortal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreateOpen(false)} className="absolute inset-0 bg-black/80" />
              <motion.div initial={MODAL_DLG_IN} animate={MODAL_DLG_DONE} exit={MODAL_DLG_OUT} transition={MODAL_TW} className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#1B1C1C] p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-xl font-black text-white">Novo Álbum</h3>
                  <button onClick={() => setIsCreateOpen(false)} className="rounded-xl p-2 text-gray-500 hover:bg-white/5">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input value={albumName} onChange={(e) => setAlbumName(e.target.value)} placeholder="Nome do álbum" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-primary/50" />
                  <textarea value={albumDescription} onChange={(e) => setAlbumDescription(e.target.value)} placeholder="Descrição (opcional)" className="min-h-24 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-primary/50" />
                  <button onClick={createAlbum} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-background hover:bg-primary/90">
                    <FolderPlus className="h-4 w-4" />
                    Criar álbum
                  </button>
                </div>
              </motion.div>
            </div>
          </BodyPortal>
        )}
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
                  {lightboxItem.media_type === 'image' ? (
                    <img
                      src={lightboxItem.public_url}
                      alt={lightboxItem.file_name}
                      className="mx-auto max-h-[85vh] w-auto max-w-full object-contain"
                    />
                  ) : (
                    <video
                      src={lightboxItem.public_url}
                      controls
                      playsInline
                      className="mx-auto max-h-[85vh] w-full max-w-full"
                      autoPlay
                    />
                  )}
                </div>
                <p className="mt-4 max-w-full truncate px-2 text-center text-sm font-medium text-gray-300">{lightboxItem.file_name}</p>
              </motion.div>
            </div>
          </BodyPortal>
        )}
      </AnimatePresence>
    </div>
  );
}
