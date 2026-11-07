import { downloadLibraryDocument } from '../lib/libraryDownload';
import DataLoadError from '../components/DataLoadError';
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
  Lock,
  CalendarDays,
  Files,
  Tags
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { authFetch, getAccessToken } from '../lib/authenticatedFetch';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../lib/modalMotion';
import { cn } from '../lib/utils';
import { hasPlanAccess } from '../constants/plans';
import CommentSection from '../components/CommentSection';
import { AppPageShell } from '../components/app/AppTopNav';
import { AppDemoCard, AppDemoPanelHeader, AppPrimaryButton, appInputClass } from '../components/ui/appDemoUi';
import { AxePageHeader, AxeMetricRail, AxeMetricCard, AxeButton, AxeCard } from '../components/shared/AxePageScaffold';
import BodyPortal from '../components/BodyPortal';
import { confirmAction } from '../lib/confirmAction';
import { LibraryCardSkeleton } from '../components/Skeleton';
import { clearStaleCacheKey } from '../lib/staleCache';
import { resolveTenantIdForFinance } from '../lib/tenantCache';
import { showHouseToast } from '../lib/houseToast';
import { FundamentosAcervo } from '../components/library/FundamentosAcervo';
import FilhoLibraryExperience from '../components/filho/FilhoLibraryExperience';
import { AuthenticatedPdfFrame } from '../components/library/AuthenticatedPdfFrame';

interface LibraryProps {
  user: any;
  userRole: string;
  tenantData: any;
  isAdminGlobal?: boolean;
  /** Painel compacto ao lado do mural (portal do filho) — abre PDF em nova aba */
  embedded?: boolean;
  /** Oculta título no modo embedded (dashboard do filho fornece o cabeçalho). */
  hideEmbeddedHeader?: boolean;
}

export interface Material {
  id: string;
  titulo: string;
  categoria: string;
  arquivo_url: string;
  created_at: string;
  tenant_id: string;
  storage_path?: string;
  visibilidade?: 'casa' | 'individual';
  destinatarios?: string[];
}

const CATEGORIES = ['Cantigas', 'História', 'Ervas', 'Orixás', 'Fundamentos'];

/** Miniatura da capa do PDF — renderiza a 1ª página via PDF.js em canvas */
function PdfCover({
  url,
  storagePath,
  tenantId,
  categoria,
  compact,
}: {
  url: string;
  storagePath?: string;
  tenantId?: string;
  categoria?: string;
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
        if (storagePath) {
          if (!tenantId || !token) throw Error('Sessão necessária para abrir o material.');
          sources.push({
            url: `/api/v1/library/pdf-proxy?path=${encodeURIComponent(storagePath)}&tenantId=${encodeURIComponent(tenantId)}`,
            httpHeaders: { Authorization: `Bearer ${token}` },
          });
        }
        if (!storagePath && url) sources.push({ url });
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

        const TARGET_WIDTH = 400;
        const viewport = page.getViewport({ scale: 1 });
        const scale = TARGET_WIDTH / viewport.width;
        const scaled = page.getViewport({ scale });

        canvas.width = Math.floor(scaled.width);
        canvas.height = Math.floor(scaled.height);

        const ctx = canvas.getContext('2d');
        if (!ctx) { setStatus('error'); return; }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise;
        if (!cancelled) setStatus('loaded');
      } catch (err) {
        if (!cancelled) setStatus('error');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [url, storagePath, tenantId]);

  return (
    <div className={cn(
      'relative w-full overflow-hidden border-b border-[#E5DECF] transition-colors',
      compact ? 'h-32' : 'h-44 sm:h-48',
      'bg-gradient-to-br from-[#0F261B] via-[#163828] to-[#0A1A12]'
    )}>
      {/* Visual litúrgico da encadernação do documento */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          {/* Textura decorativa sagrada */}
          <div className="pointer-events-none absolute inset-2 rounded-xl border border-[#D4AF37]/30" />
          <div className="pointer-events-none absolute inset-3 rounded-lg border border-white/10" />

          <div className="relative mb-2 flex h-12 w-12 items-center justify-center rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#F2CE55] shadow-inner">
            <BookOpen className="h-6 w-6" />
          </div>

          <span className="text-[10px] font-black uppercase tracking-widest text-[#F2CE55]">
            {categoria || 'Doutrina & Axé'}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold text-emerald-100/70">
            Apostila & Documento Oficial
          </span>
        </div>
      )}

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#FAF8F5]">
          <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
        </div>
      )}

      {/* Canvas da 1ª página se renderizada */}
      <canvas
        ref={canvasRef}
        className={status === 'loaded' ? 'pdf-canvas block w-full h-full object-cover' : 'pdf-canvas hidden'}
      />
    </div>
  );
}

export default function Library({ user, userRole, tenantData, isAdminGlobal, setActiveTab, embedded, hideEmbeddedHeader }: LibraryProps & { setActiveTab: (tab: string) => void }) {
  // Não-filhos são sempre gestores do terreiro (plano determina quais funções de gestão estão disponíveis).
  const isAdmin = userRole !== 'filho';
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [libraryMode, setLibraryMode] = useState<'estudos' | 'fundamentos'>('estudos');
  const [recipientOptions, setRecipientOptions] = useState<Array<{ id: string; nome: string }>>([]);
  const [recipientError, setRecipientError] = useState('');
  const [privateAudienceAvailable, setPrivateAudienceAvailable] = useState(false);
  const materialRequest = useRef(0);
  const uploadLock = useRef(false);

  const [newMaterial, setNewMaterial] = useState({
    titulo: '',
    categoria: 'Cantigas',
    file: null as File | null,
    visibilidade: 'casa' as 'casa' | 'individual',
    destinatarios: [] as string[],
  });

  const effectiveTenantId =
    resolveTenantIdForFinance(tenantData?.tenant_id, user.id, userRole === 'filho') ||
    (userRole !== 'filho' ? tenantData?.tenant_id || user.id : '');

  useEffect(() => {
    if (!isUploadModalOpen || !isAdmin || !effectiveTenantId) return;
    const controller = new AbortController();
    setRecipientError('');
    void authFetch(`/api/children?tenantId=${encodeURIComponent(effectiveTenantId)}&userRole=admin`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw Error('Não foi possível carregar os filhos. Feche e reabra este formulário para tentar novamente.'); const result = await response.json(); if (!Array.isArray(result.data)) throw Error('Lista de filhos inválida.'); if (!controller.signal.aborted) setRecipientOptions(result.data.map((child: { id: string; nome: string }) => ({ id: child.id, nome: child.nome }))); })
      .catch(error => { if (!controller.signal.aborted) setRecipientError(error.message); });
    return () => controller.abort();
  }, [isUploadModalOpen, isAdmin, effectiveTenantId]);

  const fetchMaterials = async () => {
    const request = ++materialRequest.current;
    setLoadError(null);
    if (!effectiveTenantId) {
      setMaterials([]);
      setLoading(false);
      return;
    }

    // A versão anterior armazenava PDFs de demonstração neste cache.
    clearStaleCacheKey(`library_mats_${effectiveTenantId}`);
    clearStaleCacheKey(`library_mats_real_${effectiveTenantId}`);
    setLoading(true);

    try {
      const res = await authFetch(`/api/v1/library/materials?tenantId=${encodeURIComponent(effectiveTenantId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data, capabilities } = await res.json();
      if (!Array.isArray(data)) throw new Error('Resposta de materiais inválida');
      if (request !== materialRequest.current) return;
      setPrivateAudienceAvailable(capabilities?.individualAudience === true && capabilities?.authenticatedDownloads === true);
      setMaterials(data);
    } catch (error) {
      if (request !== materialRequest.current) return;
      console.warn('Error fetching materials:', error);
      setMaterials([]);
      setLoadError('Não foi possível carregar a biblioteca da casa. Tente novamente.');
    } finally {
      if (request === materialRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    setMaterials([]);
    setSelectedMaterial(null);
    setRecipientOptions([]);
    setPrivateAudienceAvailable(false);
    setIsUploadModalOpen(false);
    void fetchMaterials();
    if (effectiveTenantId) {

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
    return () => { materialRequest.current++; };
  }, [effectiveTenantId, user.id, userRole, isAdmin]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadLock.current) return;

    if (!newMaterial.file) {
      showHouseToast('Selecione um arquivo PDF.', 'error');
      return;
    }
    if (!newMaterial.titulo) {
      showHouseToast('Informe um título para o material.', 'error');
      return;
    }

    if (!effectiveTenantId) {
      showHouseToast('Terreiro não identificado. Recarregue a página.', 'error');
      return;
    }
    if (newMaterial.visibilidade === 'individual' && (!newMaterial.destinatarios.length || recipientError)) {
      showHouseToast(recipientError || 'Selecione quem poderá ler este material privado.', 'error');
      return;
    }
    if (newMaterial.visibilidade === 'individual' && !privateAudienceAvailable) {
      showHouseToast('O envio privado está indisponível. Reabra a biblioteca e tente novamente mais tarde.', 'error');
      return;
    }

    try {
      uploadLock.current = true;
      setUploading(true);
      
      const file = newMaterial.file;
      if (file.size > 50 * 1024 * 1024 || await file.slice(0, 5).text() !== '%PDF-') throw Error('Escolha um PDF válido de até 50 MB.');
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
          tenantId: effectiveTenantId,
          audienceVersion: 1,
        })
      });

      const uploadUrlResult = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok) {
        throw new Error(uploadUrlResult.error || 'Erro ao preparar upload');
      }
      if (newMaterial.visibilidade === 'individual' && uploadUrlResult.audienceVersion !== 1) {
        throw Error('O envio privado está indisponível. O arquivo não foi enviado. Tente novamente mais tarde.');
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
          tenantId: effectiveTenantId,
          visibilidade: newMaterial.visibilidade,
          destinatarios: newMaterial.visibilidade === 'individual' ? newMaterial.destinatarios : [],
        })
      });

      const completeResult = await completeResponse.json();
      if (!completeResponse.ok) {
        throw new Error(completeResult.error || 'Erro ao salvar material');
      }

      setIsUploadModalOpen(false);
      setNewMaterial({ titulo: '', categoria: 'Cantigas', file: null, visibilidade: 'casa', destinatarios: [] });
      fetchMaterials();
      showHouseToast(newMaterial.visibilidade === 'individual' ? 'Material privado disponível para os filhos selecionados' : 'Material publicado na biblioteca');
    } catch (error: any) {
      console.error('Error uploading material:', error);
      showHouseToast(`Erro ao publicar material: ${error.message || 'tente novamente'}`, 'error');
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, storagePath: string) => {
    if (deletingMaterialId) return;
    if (!(await confirmAction({ title: 'Excluir material?', description: 'O material deixará de aparecer na biblioteca da casa.', confirmLabel: 'Excluir material', tone: 'danger' }))) return;

    if (!effectiveTenantId) {
      showHouseToast('Terreiro não identificado.', 'error');
      return;
    }

    setDeletingMaterialId(id);
    showHouseToast('Excluindo material…', 'info');
    try {
      const res = await authFetch(
        `/api/v1/library/material/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(effectiveTenantId)}`,
        { method: 'DELETE' }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erro ao excluir material');
      fetchMaterials();
      showHouseToast('Material excluído da biblioteca');
    } catch (error) {
      console.error('Error deleting material:', error);
      showHouseToast('Erro ao excluir material.', 'error');
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesSearch = m.titulo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? m.categoria === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [materials, searchQuery, selectedCategory]);

  const libraryStats = useMemo(() => {
    const now = new Date();
    const recent = materials.filter((material) => {
      const createdAt = new Date(material.created_at);
      return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
    }).length;
    return {
      total: materials.length,
      categories: new Set(materials.map((material) => material.categoria)).size,
      recent,
    };
  }, [materials]);

  const openMaterial = (m: Material) => {
    if (embedded) {
      void downloadLibraryDocument(m, effectiveTenantId);
    } else {
      setSelectedMaterial(m);
    }
  };

  if (!embedded && libraryMode === 'fundamentos') {
    return (
      <AppPageShell>
        <FundamentosAcervo
          tenantId={effectiveTenantId}
          isAdmin={isAdmin}
          onBack={() => setLibraryMode('estudos')}
        />
      </AppPageShell>
    );
  }

  if (!embedded && !isAdmin) {
    return (
      <AppPageShell fullWidth>
        <DataLoadError message={loadError} onRetry={() => void fetchMaterials()} />
        <FilhoLibraryExperience
          materials={materials}
          loading={loading}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          selectedMaterial={selectedMaterial}
          categories={CATEGORIES}
          user={user}
          tenantId={effectiveTenantId}
          onSearchChange={setSearchQuery}
          onCategoryChange={setSelectedCategory}
          onSelectMaterial={setSelectedMaterial}
          onOpenFundamentos={() => setLibraryMode('fundamentos')}
        />
      </AppPageShell>
    );
  }

  const body = (
    <div className={cn('library-v5-page flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden', embedded && 'min-h-0')}>
      <DataLoadError message={loadError} onRetry={() => void fetchMaterials()} />
      <AnimatePresence mode="wait">
        {selectedMaterial && !embedded ? (
          <motion.div 
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mx-auto box-border w-full min-w-0 max-w-[1440px] flex-1 space-y-5 pb-10 sm:pb-12 lg:pb-16"
          >
            {/* Detail Header */}
            <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <button 
                  onClick={() => setSelectedMaterial(null)}
                  className="shrink-0 rounded-xl border border-[#D8D1C4] bg-white p-3 text-[#3D382F] transition hover:border-[#11151A] hover:text-[#11151A]"
                  aria-label="Voltar para a biblioteca"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words font-display text-xl font-black tracking-tight text-[#17130D] sm:text-2xl md:text-3xl">{selectedMaterial.titulo}</h1>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-primary">{selectedMaterial.categoria}</p>
                </div>
              </div>
              
              <button 
                onClick={() => void downloadLibraryDocument(selectedMaterial, effectiveTenantId)}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-[#080A0D] transition hover:bg-[#fde047] sm:w-auto md:px-6"
              >
                <Download className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Baixar PDF
              </button>
            </div>

            {/* PDF Viewer */}
            <AppDemoCard className="relative w-full min-w-0 max-w-full h-[75vh] min-h-[520px] sm:h-[82vh] sm:min-h-[660px] max-h-[1050px] overflow-hidden p-0 rounded-lg border border-[#D8D1C4] bg-[#1A1F26] shadow-md flex flex-col">
              <AuthenticatedPdfFrame
                title={selectedMaterial.titulo}
                url={selectedMaterial.arquivo_url}
                storagePath={selectedMaterial.storage_path}
                tenantId={effectiveTenantId}
                className="h-full w-full border-none"
              />
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
            {embedded && !hideEmbeddedHeader ? (
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
              <AxePageHeader
                theme="liturgical"
                kicker="SABERES ANCESTRAIS & DOUTRINA DO TERREIRO"
                title="Biblioteca de Estudos"
                description="Organize apostilas, cantigas, rezas e fundamentos em um acervo sagrado e acessível para a corrente."
                actions={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setLibraryMode('fundamentos')}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/50 bg-black/40 backdrop-blur-md px-4 py-2.5 text-xs font-black text-amber-200 transition hover:bg-black/60 hover:text-white hover:border-[#D4AF37]"
                    >
                      <BookOpen className="h-4 w-4" />
                      Acervo Restrito
                    </button>
                    {isAdmin ? (
                      <AxeButton
                        variant="primary"
                        onClick={() => setIsUploadModalOpen(true)}
                        className={cn(!hasPlanAccess(tenantData?.plan, 'library') && 'opacity-50')}
                      >
                        {!hasPlanAccess(tenantData?.plan, 'library') ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Adicionar Material
                      </AxeButton>
                    ) : null}
                  </div>
                }
              />
            )}

            <div className={cn(
              'mx-auto box-border w-full min-w-0 max-w-[1440px] flex-1 space-y-5 px-0 pb-10 sm:pb-12 lg:pb-16',
              embedded && 'max-w-none flex min-h-0 flex-col space-y-3 px-0 pb-0 sm:space-y-3 sm:px-0 sm:pb-0 md:px-0 lg:px-0 lg:pb-0'
            )}>
              {!embedded ? (
                <AxeMetricRail className="grid grid-cols-1 sm:grid-cols-3">
                  <AxeMetricCard
                    label="Materiais de Estudo"
                    value={libraryStats.total}
                    icon={Files}
                    tone="emerald"
                    subtext="PDFs e apostilas disponíveis"
                  />
                  <AxeMetricCard
                    label="Categorias Litúrgicas"
                    value={libraryStats.categories}
                    icon={Tags}
                    tone="blue"
                    subtext="Áreas de aprendizado da casa"
                  />
                  <AxeMetricCard
                    label="Novos no Mês"
                    value={libraryStats.recent}
                    icon={CalendarDays}
                    tone="purple"
                    subtext="Adições recentes ao acervo"
                  />
                </AxeMetricRail>
              ) : null}

              {/* Search & Filters */}
            <div className={cn(
              'flex min-w-0 max-w-full flex-col gap-4',
              !embedded && 'library-catalog rounded-lg border border-[#E5DECF] bg-white p-5 shadow-sm',
              embedded && 'shrink-0 gap-2 sm:gap-2',
            )}>
              {!embedded ? (
                <div>
                  <h3 className="text-sm font-black text-[#1C2024]">Explorar acervo de estudos</h3>
                  <p className="mt-0.5 text-xs text-[#7C8691]">
                    {filteredMaterials.length} de {materials.length} material{materials.length === 1 ? '' : 's'} catalogados
                  </p>
                </div>
              ) : null}
              <div className="relative min-w-0 flex-1 group">
                <Search className={cn('absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8] transition-colors group-focus-within:text-[#D4AF37] sm:left-3.5', embedded && 'left-3 h-3.5 w-3.5')} />
                <input 
                  type="text"
                  placeholder="Buscar apostila, ponto ou fundamento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border border-[#E5DECF] bg-[#FAF8F5] py-2.5 pl-10 text-xs font-semibold text-[#1C2024] placeholder:text-[#94A3B8] transition focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20',
                    embedded && 'py-2 text-xs'
                  )}
                />
              </div>
              <div className={cn(
                'flex min-h-[40px] min-w-0 w-full max-w-full flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                !embedded && 'border-t border-[#E5DECF] pt-3.5',
                embedded && 'min-h-[36px] rounded-xl border border-[#E5DECF] bg-[#FAF8F5] p-1'
              )}>
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    'shrink-0 rounded-xl border px-3.5 py-1.5 text-[10px] font-black transition-all whitespace-nowrap',
                    !selectedCategory ? 'border-[#0F261B] bg-[#0F261B] text-[#F3E5AB] shadow-sm' : 'border-[#E5DECF] bg-[#FAF8F5] text-[#555E68] hover:border-[#D4AF37] hover:text-[#1C2024]',
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
                      'shrink-0 rounded-xl border px-3.5 py-1.5 text-[10px] font-black transition-all whitespace-nowrap',
                      selectedCategory === cat ? 'border-[#0F261B] bg-[#0F261B] text-[#F3E5AB] shadow-sm' : 'border-[#E5DECF] bg-[#FAF8F5] text-[#555E68] hover:border-[#D4AF37] hover:text-[#1C2024]',
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
              <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4', embedded && 'grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-2')}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <LibraryCardSkeleton key={i} embedded={embedded} />
                ))}
              </div>
            ) : filteredMaterials.length > 0 ? (
              <div className={cn(
                'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
                embedded && 'min-h-0 max-h-[min(340px,40vh)] flex-1 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 [scrollbar-width:thin]'
              )}>
                {filteredMaterials.map((material) => (
                  <motion.div
                    key={material.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="library-book-card group relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#E5DECF] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/60 hover:shadow-xl"
                  >
                    {/* Capa do PDF com visual litúrgico sagrado */}
                    <div
                      className="cursor-pointer"
                      onClick={() => openMaterial(material)}
                    >
                      <PdfCover
                        url={material.arquivo_url}
                        storagePath={material.storage_path}
                        tenantId={material.tenant_id}
                        categoria={material.categoria}
                        compact={embedded}
                      />
                    </div>

                    {/* Badge de categoria — sobrepõe a miniatura */}
                    <span className="absolute right-3 top-3 z-10 rounded-lg border border-[#D4AF37]/40 bg-[#0F261B]/85 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-[#F2CE55] backdrop-blur-md shadow-sm">
                      {material.categoria}
                    </span>

                    <div className={cn('flex flex-1 flex-col gap-2 p-4', embedded && 'gap-1 p-2')}>
                      <div className="min-w-0">
                        <h3
                          className={cn(
                            'line-clamp-2 cursor-pointer text-sm font-black leading-snug text-[#1C2024] transition-colors group-hover:text-[#D4AF37]',
                            embedded && 'text-[10px] leading-tight'
                          )}
                          onClick={() => openMaterial(material)}
                        >
                          {material.titulo}
                        </h3>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#7C8691]">
                          {new Date(material.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => openMaterial(material)}
                          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E5DECF] bg-[#FAF8F5] py-2 text-[10px] font-bold text-[#1C2024] transition hover:border-[#D4AF37] hover:bg-[#FFFDF9]"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
                          <span className="truncate">{embedded ? 'Abrir PDF' : 'Abrir material'}</span>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(material.id, (material as any).storage_path)}
                            disabled={deletingMaterialId !== null}
                            aria-busy={deletingMaterialId === material.id}
                            className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-55"
                            aria-label={`Excluir ${material.titulo}`}
                          >
                            {deletingMaterialId === material.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              embedded ? (
                <div className="rounded-lg border border-dashed border-[#E5DECF] bg-[#FAF8F5] py-10 px-4 text-center">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-[#D4AF37]" />
                  <h3 className="text-sm font-bold text-[#1C2024]">Nenhum material encontrado</h3>
                  <p className="mt-1 text-xs text-[#7C8691]">Tente ajustar a busca ou veja a biblioteca completa.</p>
                </div>
              ) : (
              <div className="col-span-full rounded-lg border border-[#E5DECF] bg-white p-12 text-center shadow-xs">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-amber-500/10 text-amber-800 border border-amber-200">
                    <BookOpen className="h-7 w-7" />
                  </div>
                  <h4 className="mt-4 text-base font-black text-[#171A16]">
                    {searchQuery ? `Nenhum material encontrado para "${searchQuery}"` : 'Biblioteca de Fundamentos'}
                  </h4>
                  <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-relaxed text-[#6B6355]">
                    {searchQuery
                      ? 'Tente outro termo ou selecione uma categoria diferente no acervo.'
                      : 'Adicione apostilas e textos sagrados para fortalecer os estudos da corrente.'}
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] px-5 py-2.5 text-xs font-black text-[#0A160F] shadow-sm hover:brightness-105 active:scale-95 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      Publicar Apostila no Acervo
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Upload Modal */}
      <BodyPortal>
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-lg border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl sm:max-w-lg"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#DED8CB] px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#8F7724]">Biblioteca da casa</p>
                  <h3 className="mt-1 font-display text-base font-black text-[#171A16] sm:text-lg">Adicionar material</h3>
                  <p className="mt-0.5 text-xs text-[#6F675C]">Publique um PDF na biblioteca da casa.</p>
                </div>
                <button onClick={() => setIsUploadModalOpen(false)} className="shrink-0 rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition hover:bg-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-1.5">
                  <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]">Título do material</label>
                  <input type="text" value={newMaterial.titulo}
                    onChange={e => setNewMaterial({ ...newMaterial, titulo: e.target.value })}
                    className="min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15"
                    placeholder="Ex.: Cantigas de Oxóssi" />
                </div>

                <div className="space-y-1.5">
                  <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]">Categoria</label>
                  <select value={newMaterial.categoria}
                    onChange={e => setNewMaterial({ ...newMaterial, categoria: e.target.value })}
                    className="min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15 [&>option]:bg-white">
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <fieldset className="space-y-3 rounded-xl border border-[#D8D2C4] p-4" disabled={uploading}>
                  <legend className="px-1 text-sm font-semibold">Quem pode ler este PDF?</legend>
                  <label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="library-audience" checked={newMaterial.visibilidade === 'casa'} onChange={() => setNewMaterial(previous => ({ ...previous, visibilidade: 'casa', destinatarios: [] }))}/>Toda a corrente da casa</label>
                  <label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="library-audience" disabled={!privateAudienceAvailable} checked={newMaterial.visibilidade === 'individual'} onChange={() => setNewMaterial(previous => ({ ...previous, visibilidade: 'individual' }))}/>Privado para filhos específicos</label>
                  {!privateAudienceAvailable && <p className="text-sm text-[#626f65]">Envio privado indisponível no momento. Tente novamente mais tarde.</p>}
                  {newMaterial.visibilidade === 'individual' && <div className="space-y-2"><p className="text-sm text-[#5b675c]">Apenas a gestão e os filhos selecionados poderão abrir o arquivo.</p>{recipientError ? <p role="alert" className="text-sm text-red-800">{recipientError}</p> : !recipientOptions.length ? <p role="status" className="text-sm">Nenhum filho disponível. Confira os cadastros da casa.</p> : <div className="max-h-48 overflow-y-auto rounded-lg bg-white px-3">{recipientOptions.map(child => <label key={child.id} className="flex min-h-11 items-center gap-3 border-b border-[#E1E7DC] py-2 text-sm last:border-0"><input type="checkbox" checked={newMaterial.destinatarios.includes(child.id)} onChange={event => setNewMaterial(previous => ({ ...previous, destinatarios: event.target.checked ? [...previous.destinatarios, child.id] : previous.destinatarios.filter(id => id !== child.id) }))}/>{child.nome}</label>)}</div>}</div>}
                </fieldset>
                <div className="space-y-1.5">
                  <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]">Arquivo PDF</label>
                  <div className="relative">
                    <input type="file" accept=".pdf"
                      onChange={e => setNewMaterial({ ...newMaterial, file: e.target.files?.[0] || null })}
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
                    <div className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D8D2C4] bg-white px-4 py-8 transition hover:border-[#8F7724]/50">
                      <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#E7DDC0] bg-[#F1E8D2] text-[#8F7724]">
                        <Upload className="h-5 w-5" />
                      </div>
                      <p className="max-w-full truncate px-2 text-center text-xs font-bold text-[#6F675C]" title={newMaterial.file?.name}>
                        {newMaterial.file ? newMaterial.file.name : 'Selecione ou arraste o PDF'}
                      </p>
                      {newMaterial.file ? (
                        <span className="text-[10px] font-bold text-[#9B9184]">
                          {(newMaterial.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#9B9184]">Somente arquivos PDF</span>
                      )}
                    </div>
                  </div>
                </div>

                <AppPrimaryButton type="submit" disabled={uploading} className="flex w-full items-center justify-center gap-2 bg-[#17251D] text-[#FFFAF0] hover:bg-[#20342A]">
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando…</> : <><Upload className="h-4 w-4" />Publicar material</>}
                </AppPrimaryButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </BodyPortal>
    </div>
  );

  return embedded ? body : <AppPageShell>{body}</AppPageShell>;
}
