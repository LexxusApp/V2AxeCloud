import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, 
  Plus, 
  FileText, 
  Search, 
  Upload, 
  X, 
  Loader2, 
  Download, 
  ExternalLink,
  Trash2,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { authFetch, getAccessToken } from '../lib/authenticatedFetch';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../lib/modalMotion';
import { cn } from '../lib/utils';
import { hasPlanAccess } from '../constants/plans';
import CommentSection from '../components/CommentSection';
import { AppPageShell } from '../components/app/AppTopNav';
import { AppDemoCard, AppDemoPanelHeader, AppPrimaryButton, appInputClass, appLabelClass } from '../components/ui/appDemoUi';
import { LibraryCardSkeleton } from '../components/Skeleton';
import { readStaleCache, writeStaleCache } from '../lib/staleCache';
import { resolveTenantIdForFinance } from '../lib/tenantCache';

interface LibraryProps {
  user: any;
  userRole: string;
  tenantData: any;
  isAdminGlobal?: boolean;
  /** Painel compacto ao lado do mural (portal do filho) — abre PDF em nova aba */
  embedded?: boolean;
}

interface Material {
  id: string;
  titulo: string;
  categoria: string;
  arquivo_url: string;
  created_at: string;
  tenant_id: string;
  storage_path?: string;
}

const CATEGORIES = ['Cantigas', 'História', 'Ervas', 'Orixás', 'Fundamentos'];

/** Miniatura da capa do PDF — renderiza a 1ª página via PDF.js em canvas */
function PdfCover({
  url,
  storagePath,
  tenantId,
  compact,
}: {
  url: string;
  storagePath?: string;
  tenantId?: string;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        setStatus('loading');
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const sources: { url: string; httpHeaders?: Record<string, string> }[] = [];
        const token = await getAccessToken();
        if (storagePath && tenantId && token) {
          sources.push({
            url: `/api/v1/library/pdf-proxy?path=${encodeURIComponent(storagePath)}&tenantId=${encodeURIComponent(tenantId)}`,
            httpHeaders: { Authorization: `Bearer ${token}` },
          });
        }
        sources.push({ url });
        let pdf: any = null;
        let lastError: unknown = null;
        for (const source of sources) {
          try {
            pdf = await pdfjsLib.getDocument({
              url: source.url,
              httpHeaders: source.httpHeaders,
              withCredentials: false,
              disableRange: true,
              disableStream: true,
            }).promise;
            break;
          } catch (err) {
            lastError = err;
          }
        }
        if (!pdf) throw lastError || new Error('Falha ao carregar PDF');
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Renderiza em resolução maior para melhor qualidade, CSS escala depois
        const TARGET_WIDTH = 400;
        const viewport = page.getViewport({ scale: 1 });
        const scale = TARGET_WIDTH / viewport.width;
        const scaled = page.getViewport({ scale });

        // Atributos do canvas controlam a resolução real de renderização
        canvas.width = Math.floor(scaled.width);
        canvas.height = Math.floor(scaled.height);

        const ctx = canvas.getContext('2d');
        if (!ctx) { setStatus('error'); return; }

        // Fundo branco explícito (para PDFs transparentes)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise;
        if (!cancelled) setStatus('loaded');
      } catch (err) {
        console.warn('[PdfCover] Erro ao renderizar capa:', err);
        if (!cancelled) setStatus('error');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [url, storagePath, tenantId]);

  return (
    <div className={`relative w-full overflow-hidden bg-[#12161A] ${compact ? 'pdf-cover-compact' : 'pdf-cover-normal'}`}>
      {/* Spinner enquanto processa */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary/40 animate-spin" />
        </div>
      )}

      {/* Fallback de erro */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/5 to-transparent">
          <FileText className="w-14 h-14 text-primary/25" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">PDF</span>
        </div>
      )}

      {/* Canvas: 100% de largura via CSS, altura natural — container clipa em 200px */}
      <canvas
        ref={canvasRef}
        className={status === 'loaded' ? 'pdf-canvas block' : 'pdf-canvas hidden'}
      />

      {/* Gradiente inferior */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#13171D]/95" />
    </div>
  );
}

export default function Library({ user, userRole, tenantData, isAdminGlobal, setActiveTab, embedded }: LibraryProps & { setActiveTab: (tab: string) => void }) {
  // Não-filhos são sempre gestores do terreiro (plano determina quais funções de gestão estão disponíveis).
  const isAdmin = userRole !== 'filho';
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  const [newMaterial, setNewMaterial] = useState({
    titulo: '',
    categoria: 'Cantigas',
    file: null as File | null
  });

  const effectiveTenantId =
    resolveTenantIdForFinance(tenantData?.tenant_id, user.id, userRole === 'filho') ||
    (userRole !== 'filho' ? tenantData?.tenant_id || user.id : '');

  const fetchMaterials = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    const cacheKey = `library_mats_${effectiveTenantId}`;
    const cached = readStaleCache<Material[]>(cacheKey);
    if (cached != null) {
      setMaterials(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const res = await authFetch(`/api/v1/library/materials?tenantId=${encodeURIComponent(effectiveTenantId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      const list = data || [];
      setMaterials(list);
      writeStaleCache(cacheKey, list);
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveTenantId) {
      void fetchMaterials();

      if (isAdmin) {
        supabase
          .from('notificacoes')
          .update({ lida: true })
          .eq('tenant_id', effectiveTenantId)
          .eq('tipo', 'biblioteca_duvida')
          .then(({ error }) => {
            if (error) console.error('Error marking notifications as read:', error);
          });
      }
    }
  }, [effectiveTenantId, user.id, userRole, isAdmin]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMaterial.file) {
      alert('Por favor, selecione um arquivo PDF.');
      return;
    }
    if (!newMaterial.titulo) {
      alert('Por favor, insira um título para o material.');
      return;
    }

    if (!effectiveTenantId) {
      alert('Erro: ID do terreiro não encontrado. Tente recarregar a página.');
      return;
    }

    try {
      setUploading(true);
      
      const file = newMaterial.file;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;

      // Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const uploadUrlResponse = await authFetch('/api/v1/library/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          fileName,
          contentType: file.type,
          categoria: newMaterial.categoria,
          tenantId: effectiveTenantId
        })
      });

      const uploadUrlResult = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok) {
        throw new Error(uploadUrlResult.error || 'Erro ao preparar upload');
      }

      const { error: uploadError } = await supabase.storage
        .from('biblioteca_estudos')
        .uploadToSignedUrl(uploadUrlResult.path, uploadUrlResult.token, file, {
          contentType: file.type || uploadUrlResult.contentType || 'application/pdf',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const completeResponse = await authFetch('/api/v1/library/complete-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          storagePath: uploadUrlResult.path,
          titulo: newMaterial.titulo,
          categoria: newMaterial.categoria,
          tenantId: effectiveTenantId
        })
      });

      const completeResult = await completeResponse.json();
      if (!completeResponse.ok) {
        throw new Error(completeResult.error || 'Erro ao salvar material');
      }

      setIsUploadModalOpen(false);
      setNewMaterial({ titulo: '', categoria: 'Cantigas', file: null });
      fetchMaterials();
    } catch (error: any) {
      console.error('Error uploading material:', error);
      alert('Erro ao subir material: ' + (error.message || 'Desconhecido'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, storagePath: string) => {
    if (!confirm('Deseja realmente excluir este material?')) return;

    if (!effectiveTenantId) {
      alert('Terreiro não identificado.');
      return;
    }

    try {
      const res = await authFetch(
        `/api/v1/library/material/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(effectiveTenantId)}`,
        { method: 'DELETE' }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erro ao excluir material');
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      alert('Erro ao excluir material.');
    }
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesSearch = m.titulo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? m.categoria === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [materials, searchQuery, selectedCategory]);

  const openMaterial = (m: Material) => {
    if (embedded) {
      window.open(m.arquivo_url, '_blank', 'noopener,noreferrer');
    } else {
      setSelectedMaterial(m);
    }
  };

  const body = (
    <div className={cn('flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden', embedded && 'min-h-0')}>
      <AnimatePresence mode="wait">
        {selectedMaterial && !embedded ? (
          <motion.div 
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mx-auto box-border w-full min-w-0 max-w-[1440px] flex-1 space-y-8 px-3 pb-10 sm:space-y-10 sm:px-4 sm:pb-12 md:px-6 lg:px-10 lg:pb-16"
          >
            {/* Detail Header */}
            <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <button 
                  onClick={() => setSelectedMaterial(null)}
                  className="shrink-0 rounded-xl border border-[#1E242B] bg-[#12161A] p-3 text-[#94A3B8] transition hover:border-[#2F3643] hover:text-[#F1F5F9] sm:p-3.5"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-xl font-bold tracking-tight text-[#F1F5F9] sm:text-2xl md:text-3xl">{selectedMaterial.titulo}</h1>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-primary">{selectedMaterial.categoria}</p>
                </div>
              </div>
              
              <button 
                onClick={() => window.open(selectedMaterial.arquivo_url, '_blank')}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-3 text-sm font-bold text-[#F1F5F9] transition hover:border-primary/40 sm:w-auto md:px-6"
              >
                <Download className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Baixar PDF
              </button>
            </div>

            {/* PDF Viewer (Iframe) */}
            <AppDemoCard className="relative aspect-[16/9] w-full min-w-0 max-w-full overflow-hidden p-0">
              <iframe 
                src={`${selectedMaterial.arquivo_url}#toolbar=0`}
                className="w-full h-full border-none"
                title={selectedMaterial.titulo}
              />
              <div className="absolute right-2 top-2 max-w-[calc(100%-1rem)] sm:right-4 sm:top-4">
                <div className="rounded-lg border border-[#1E242B] bg-[#13171D]/90 px-2 py-1.5 text-[8px] font-bold uppercase tracking-wide text-[#94A3B8] backdrop-blur-sm sm:px-3 sm:py-2 sm:text-[10px]">
                  Modo de estudo
                </div>
              </div>
            </AppDemoCard>

            {/* Comments Section */}
            <div className="mx-auto w-full min-w-0 max-w-4xl">
              <CommentSection 
                materialId={selectedMaterial.id}
                user={user}
                userRole={userRole}
                tenantId={tenantData.tenant_id}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={cn('flex min-h-full w-full min-w-0 max-w-full flex-col', embedded && 'min-h-0 flex-1')}
          >
            {embedded ? (
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-[#1E242B] pb-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Biblioteca de estudos</p>
                  <h2 className="mt-0.5 text-base font-bold text-[#F1F5F9] sm:text-lg">PDFs do terreiro</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('library')}
                  className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#64748B] transition hover:text-primary"
                >
                  Ver tudo
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <AppDemoPanelHeader
                title="Biblioteca de estudos"
                description="O conhecimento é a base do fundamento."
                action={
                  isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(true)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-[#080A0D] transition hover:bg-[#fde047]',
                        !hasPlanAccess(tenantData?.plan, 'library') && 'opacity-50',
                      )}
                    >
                      {!hasPlanAccess(tenantData?.plan, 'library') ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Subir material
                    </button>
                  ) : null
                }
              />
            )}

            <div className={cn(
              'mx-auto box-border w-full min-w-0 max-w-[1440px] flex-1 space-y-10 px-3 pb-10 sm:px-4 sm:pb-12 md:px-6 lg:px-10 lg:pb-16',
              embedded && 'max-w-none flex min-h-0 flex-col space-y-3 px-0 pb-0 sm:space-y-3 sm:px-0 sm:pb-0 md:px-0 lg:px-0 lg:pb-0'
            )}>
              {/* Search & Filters */}
            <div className={cn('flex min-w-0 max-w-full flex-col gap-4 sm:gap-6', embedded && 'shrink-0 gap-2 sm:gap-2')}>
              <div className="relative min-w-0 flex-1 group">
                <Search className={cn('absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8] transition-colors group-focus-within:text-primary sm:left-3.5', embedded && 'left-3 h-3.5 w-3.5')} />
                <input 
                  type="text"
                  placeholder="Buscar material..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(appInputClass, 'pl-10 sm:pl-10', embedded && 'py-2 text-xs')}
                />
              </div>
              <div className={cn(
                'flex min-h-[40px] min-w-0 w-full max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto rounded-xl border border-[#1E242B] bg-[#12161A] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                embedded && 'min-h-[36px]'
              )}>
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-all whitespace-nowrap',
                    !selectedCategory ? 'bg-primary text-[#080A0D] shadow-sm' : 'text-[#94A3B8] hover:text-[#F1F5F9]',
                    embedded && 'px-2.5 py-1.5 text-[10px]'
                  )}
                >
                  Todos
                </button>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-all whitespace-nowrap',
                      selectedCategory === cat ? 'bg-primary text-[#080A0D] shadow-sm' : 'text-[#94A3B8] hover:text-[#F1F5F9]',
                      embedded && 'px-2.5 py-1.5 text-[10px]'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Materials Grid */}
            {loading && materials.length === 0 ? (
              <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4', embedded && 'grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-2')}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <LibraryCardSkeleton key={i} embedded={embedded} />
                ))}
              </div>
            ) : filteredMaterials.length > 0 ? (
              <div className={cn(
                'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4',
                embedded && 'min-h-0 max-h-[min(340px,40vh)] flex-1 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 [scrollbar-width:thin]'
              )}>
                {filteredMaterials.map((material) => (
                  <motion.div
                    key={material.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-500/20 hover:shadow-lg"
                  >
                    {/* Capa do PDF */}
                    <div
                      className="cursor-pointer"
                      onClick={() => openMaterial(material)}
                    >
                      <PdfCover
                        url={material.arquivo_url}
                        storagePath={material.storage_path}
                        tenantId={material.tenant_id}
                        compact={embedded}
                      />
                    </div>

                    {/* Badge de categoria — sobrepõe a miniatura */}
                    <span className="absolute right-2 top-2 z-10 rounded-md border border-primary/25 bg-[#13171D]/90 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary backdrop-blur-sm">
                      {material.categoria}
                    </span>

                    <div className={cn('flex flex-1 flex-col gap-2 p-3', embedded && 'gap-1 p-2')}>
                      <div className="min-w-0">
                        <h3
                          className={cn(
                            'line-clamp-2 cursor-pointer text-xs font-bold leading-snug text-[#F1F5F9] transition-colors group-hover:text-primary',
                            embedded && 'text-[10px] leading-tight'
                          )}
                          onClick={() => openMaterial(material)}
                        >
                          {material.titulo}
                        </h3>
                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-[#64748B]">
                          {new Date(material.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <div className="mt-auto flex min-w-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openMaterial(material)}
                          className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border border-[#1E242B] bg-[#12161A] py-2 text-[10px] font-bold text-[#F1F5F9] transition hover:border-primary/40"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{embedded ? 'Abrir PDF' : 'Estudar'}</span>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(material.id, (material as any).storage_path)}
                            className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-950/40 p-2 text-rose-300 transition hover:bg-rose-950/60"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              embedded ? (
                <div className="rounded-xl border border-dashed border-[#2F3643] bg-[#12161A] py-10 px-4 text-center">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-primary/40" />
                  <h3 className="text-sm font-bold text-[#F1F5F9]">Nenhum material encontrado</h3>
                  <p className="mt-1 text-xs text-[#94A3B8]">Tente ajustar a busca ou veja a biblioteca completa.</p>
                </div>
              ) : (
              <AppDemoCard className="py-16 text-center sm:py-20">
                <BookOpen className="mx-auto mb-4 h-12 w-12 text-primary/40" />
                <h3 className="text-lg font-bold text-[#F1F5F9]">Nenhum material encontrado</h3>
                <p className="mt-2 text-sm text-[#94A3B8]">Tente ajustar sua busca ou filtros.</p>
              </AppDemoCard>
              )
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute inset-0 bg-black/[0.94] backdrop-blur-none"
            />
            <motion.div 
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-2xl sm:max-w-lg"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#1E242B] px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#F1F5F9] sm:text-lg">Subir material</h3>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">PDF para a biblioteca do terreiro</p>
                </div>
                <button onClick={() => setIsUploadModalOpen(false)} className="shrink-0 rounded-lg p-2 text-[#94A3B8] transition hover:bg-[#12161A] hover:text-[#F1F5F9]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-1.5">
                  <label className={appLabelClass}>Título do material</label>
                  <input type="text" value={newMaterial.titulo}
                    onChange={e => setNewMaterial({ ...newMaterial, titulo: e.target.value })}
                    className={appInputClass}
                    placeholder="Ex: Cantigas de Oxóssi" />
                </div>

                <div className="space-y-1.5">
                  <label className={appLabelClass}>Categoria</label>
                  <select value={newMaterial.categoria}
                    onChange={e => setNewMaterial({ ...newMaterial, categoria: e.target.value })}
                    className={cn(appInputClass, '[&>option]:bg-[#13171D]')}>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className={appLabelClass}>Arquivo PDF</label>
                  <div className="relative">
                    <input type="file" accept=".pdf"
                      onChange={e => setNewMaterial({ ...newMaterial, file: e.target.files?.[0] || null })}
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
                    <div className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#1E242B] bg-[#12161A] px-4 py-6 transition hover:border-[#2F3643]">
                      <Upload className="h-7 w-7 text-[#94A3B8]" />
                      <p className="max-w-full truncate px-2 text-center text-xs font-bold text-[#94A3B8]" title={newMaterial.file?.name}>
                        {newMaterial.file ? newMaterial.file.name : 'Selecione ou arraste o PDF'}
                      </p>
                    </div>
                  </div>
                </div>

                <AppPrimaryButton type="submit" disabled={uploading} className="flex w-full items-center justify-center gap-2">
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Subindo…</> : <><Upload className="h-4 w-4" />Confirmar upload</>}
                </AppPrimaryButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  return embedded ? body : <AppPageShell>{body}</AppPageShell>;
}
