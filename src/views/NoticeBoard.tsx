import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell, 
  Plus, 
  Search, 
  AlertCircle, 
  PartyPopper, 
  BookOpen, 
  Info, 
  Calendar as CalendarIcon,
  X,
  Loader2,
  Trash2,
  Copy,
  CheckCircle2,
  Share2,
  Megaphone,
  Send,
  Users,
  XCircle,
  Smartphone,
  History,
  ArrowUpRight,
  RefreshCw,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { confirmAction } from '../lib/confirmAction';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { readNoticePublication, type NoticeProgress } from '../lib/noticePublication';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../lib/modalMotion';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AppDemoCard,
  AppDemoPanelHeader,
  AppPrimaryButton,
  appInputClass,
  appLabelClass,
} from '../components/ui/appDemoUi';
import FilhoNoticeExperience from '../components/filho/FilhoNoticeExperience';
import BodyPortal from '../components/BodyPortal';
import { showHouseToast } from '../lib/houseToast';
import {
  AxeBadge,
  AxeButton,
  AxeCard,
  AxeEmptyState,
  AxeFilterBar,
  AxeMetricCard,
  AxeMetricRail,
  AxePageHeader,
} from '../components/shared/AxePageScaffold';

export interface Notice {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: 'Urgente' | 'Festas' | 'Doutrina' | 'Geral';
  data_publicacao: string;
  expiracao?: string;
  tenant_id: string;
}

interface BroadcastLog {
  id: string;
  telefone: string;
  mensagem: string;
  tipo: string;
  status: string;
  created_at: string;
}

const categories = ['Todos', 'Geral', 'Urgente', 'Festas', 'Doutrina'] as const;

const categoryConfig = {
  Urgente: {
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badge: 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
  },
  Festas: {
    icon: PartyPopper,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500 text-black font-black'
  },
  Doutrina: {
    icon: BookOpen,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500 text-white'
  },
  Geral: {
    icon: Info,
    color: 'text-gray-400',
    bg: 'bg-gray-400/10',
    border: 'border-gray-400/20',
    badge: 'bg-gray-400 text-white'
  }
};

/** Aceita YYYY-MM-DD ou ISO completo sem quebrar o dialog do mural. */
function formatNoticeExpiry(value: string): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(raw);
  const date = dateOnly ? new Date(`${dateOnly[1]}T12:00:00`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, 'dd/MM/yyyy');
}

export default function NoticeBoard({ isAdmin, tenantData, setActiveTab }: { isAdmin?: boolean, tenantData?: any, setActiveTab: (tab: string) => void }) {
  const tenantId = tenantData?.tenant_id;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [publicationProgress, setPublicationProgress] = useState<NoticeProgress | null>(null);
  const [publicationError, setPublicationError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastPostedNotice, setLastPostedNotice] = useState<{titulo: string, conteudo: string} | null>(null);
  const [lastWhatsappResult, setLastWhatsappResult] = useState<{ sent: number; errors: number; skipped: number; status?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [activeSection, setActiveSection] = useState<'published' | 'history'>('published');
  const [composerOpen, setComposerOpen] = useState(false);
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLog[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSubmitting) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [isSubmitting]);

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    conteudo: '',
    categoria: 'Geral' as Notice['categoria'],
    expiracao: ''
  });

  const getFormattedMessage = (title: string, content: string) => {
    const systemUrl = window.location.origin;
    const summary = content.length > 100 ? content.substring(0, 100) + '...' : content;
    return `📢 *AVISO DO TERREIRO - AxéCloud* 📢\n\n📌 *Assunto:* ${title}\n\n📝 ${summary}\n\n🔗 Veja o aviso completo aqui: ${systemUrl}`;
  };

  const generateWhatsAppLink = (title: string, content: string) => {
    const message = getFormattedMessage(title, content);
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const copyToClipboard = async (title: string, content: string, id?: string) => {
    const message = getFormattedMessage(title, content);
    try {
      await navigator.clipboard.writeText(message);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        showHouseToast('Texto copiado para o WhatsApp');
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  useEffect(() => {
    fetchNotices();
    if (isAdmin) void fetchBroadcastLogs();
  }, [tenantId]);

  async function fetchBroadcastLogs() {
    try {
      const response = await authFetch('/api/whatsapp/logs?limit=20', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const logs = Array.isArray(payload.logs) ? payload.logs : [];
      setBroadcastLogs(
        logs.filter((log: BroadcastLog) => {
          const type = String(log.tipo || '').toLowerCase();
          return type === 'transmissao_aviso' || type === 'mural_aviso' || type === 'broadcast';
        }),
      );
    } catch {
      setBroadcastLogs([]);
    }
  }

  async function fetchNotices() {
    setLoading(true);
    try {
      const response = await authFetch(`/api/notices?tenantId=${tenantId || ''}`);
      if (!response.ok) throw new Error('Failed to fetch notices');
      const { data } = await response.json();
      setNotices(data || []);
    } catch (error) {
      console.error('Error fetching notices:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setElapsedSeconds(0);
    setPublicationError('');
    setPublicationProgress({ stage: 'publishing' });
    let published = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Prepara os dados para inserção, tratando a data de expiração vazia como null
      const insertData = {
        titulo: formData.titulo,
        conteudo: formData.conteudo,
        categoria: formData.categoria,
        tenant_id: tenantId || user.id,
        data_publicacao: new Date().toISOString(),
        expiracao: formData.expiracao || null
      };

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await authFetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/x-ndjson',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          ...insertData,
          tenantId: tenantId || user.id,
          autorId: user.id,
          autorNome: tenantData?.nome_zelador || 'Zelador',
          notifyWhatsApp,
        })
      });

      if (!response.ok) {
        let errorMsg = 'Falha ao publicar aviso';
        try {
          const errData = await response.json();
          if (errData.details) {
            console.error('[MURAL /api/notices] debug do servidor:', errData.details);
          }
          errorMsg = errData.error || errorMsg;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMsg);
      }
      
      const payload = await readNoticePublication(response, (progress) => {
        published = progress.stage !== 'publishing';
        setPublicationProgress(progress);
      });
      setLastPostedNotice({ titulo: formData.titulo, conteudo: formData.conteudo });
      setLastWhatsappResult(
        notifyWhatsApp && payload.whatsapp
          ? {
              sent: Number(payload.whatsapp.sent || 0),
              errors: Number(payload.whatsapp.errors || 0),
              skipped: Number(payload.whatsapp.skipped || 0),
              status: String(payload.whatsapp.status || ''),
            }
          : null
      );

      setShowSuccessModal(true);
      setComposerOpen(false);
      setFormData({ titulo: '', conteudo: '', categoria: 'Geral', expiracao: '' });
      fetchNotices();
      void fetchBroadcastLogs();
    } catch (error: any) {
      console.error('Error posting notice:', error);
      const message = published
        ? 'O comunicado já está no mural. Não foi possível confirmar o resultado das notificações. Confira o histórico antes de reenviar.'
        : `Não foi possível confirmar a publicação: ${error.message || 'conexão interrompida'}. Confira o mural antes de tentar novamente.`;
      setPublicationError(message);
      void fetchNotices();
      void fetchBroadcastLogs();
      if (error.code === 'PGRST205') {
        showHouseToast('O mural está temporariamente indisponível.', 'error');
      } else {
        showHouseToast(message, 'error');
      }
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }

  async function deleteNotice(id: string) {
    if (deletingNoticeId) return;
    if (!(await confirmAction({ title: 'Excluir comunicado?', description: 'O aviso deixará de aparecer no mural da corrente.', confirmLabel: 'Excluir comunicado', tone: 'danger' }))) return;
    setDeletingNoticeId(id);
    showHouseToast('Excluindo comunicado…', 'info');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showHouseToast('Sessão expirada. Faça login novamente.', 'error');
        return;
      }
      const response = await authFetch(`/api/notices/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível excluir o aviso.');
      }
      setSelectedNotice(null);
      fetchNotices();
      showHouseToast('Comunicado excluído do mural');
    } catch (error: unknown) {
      console.error('Error deleting notice:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao excluir aviso.';
      showHouseToast(msg, 'error');
    } finally {
      setDeletingNoticeId(null);
    }
  }

  const filteredNotices = useMemo(() => {
    return notices
      .filter(n => {
        const matchesCategory = activeCategory === 'Todos' || n.categoria === activeCategory;
        const matchesSearch = n.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             n.conteudo.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        // Pinned logic: Urgente always on top
        if (a.categoria === 'Urgente' && b.categoria !== 'Urgente') return -1;
        if (a.categoria !== 'Urgente' && b.categoria === 'Urgente') return 1;
        // Then by date
        return new Date(b.data_publicacao).getTime() - new Date(a.data_publicacao).getTime();
      });
  }, [notices, activeCategory, searchTerm]);
  const activeNoticesCount = notices.filter((notice) => !notice.expiracao || new Date(notice.expiracao).getTime() >= Date.now()).length;
  const successfulLogs = broadcastLogs.filter((log) => {
    const status = String(log.status || '').toLowerCase();
    return !['failed', 'falha', 'error', 'erro'].includes(status);
  });
  const failedLogs = broadcastLogs.length - successfulLogs.length;

  if (loading && notices.length === 0) {
    return <AppPanelLoading />;
  }

  if (!isAdmin) {
    return (
      <AppPageShell fullWidth>
        <FilhoNoticeExperience
          notices={notices}
          filteredNotices={filteredNotices}
          activeCategory={activeCategory}
          searchTerm={searchTerm}
          selectedNotice={selectedNotice}
          categories={categories}
          houseName={tenantData?.nome || tenantData?.nome_terreiro || ''}
          onCategoryChange={setActiveCategory}
          onSearchChange={setSearchTerm}
          onSelectNotice={setSelectedNotice}
        />
      </AppPageShell>
    );
  }

  const searchBar = (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" aria-hidden />
      <input
        type="search"
        placeholder="Buscar avisos..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={cn(appInputClass, 'pl-9')}
      />
    </div>
  );

  return (
    <AppPageShell>
      <div className="space-y-5">
        {/* 1. Unified Header */}
        <AxePageHeader
          kicker="Comunicação Oficial da Casa"
          title="Mural de Comunicados"
          description="Mensagens oficiais, orientações litúrgicas e avisos para toda a corrente com transmissão simultânea por WhatsApp."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <div className="flex items-center gap-1 rounded-xl border border-[#E6DFD3] bg-white p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setActiveSection('published')}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all',
                      activeSection === 'published'
                        ? 'bg-[#1F5942] text-white shadow-xs'
                        : 'text-[#59655E] hover:text-[#17251D]',
                    )}
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Publicados
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('history')}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all',
                      activeSection === 'history'
                        ? 'bg-[#1F5942] text-white shadow-xs'
                        : 'text-[#59655E] hover:text-[#17251D]',
                    )}
                  >
                    <History className="h-3.5 w-3.5" />
                    Histórico
                  </button>
                </div>
              )}

              {isAdmin ? (
                <AxeButton
                  type="button"
                  variant="primary"
                  disabled={isSubmitting}
                  onClick={() => setComposerOpen((v) => !v)}
                  icon={Plus}
                >
                  Novo comunicado
                </AxeButton>
              ) : (
                searchBar
              )}
            </div>
          }
        />

        {/* 2. Unified Metric Rail (Admin only) */}
        {isAdmin && (
          <AxeMetricRail>
            <AxeMetricCard
              label="Avisos ativos"
              value={activeNoticesCount}
              icon={Megaphone}
              tone="emerald"
              subtext="visíveis no mural"
            />
            <AxeMetricCard
              label="Entregas WhatsApp"
              value={successfulLogs.length}
              icon={Send}
              tone="blue"
              subtext="histórico recente"
            />
            <AxeMetricCard
              label="Falhas de envio"
              value={failedLogs}
              icon={XCircle}
              tone={failedLogs > 0 ? 'rose' : 'neutral'}
              subtext={failedLogs === 0 ? 'nenhuma falha' : 'requer atenção'}
            />
            <AxeMetricCard
              label="Comunicados"
              value={notices.length}
              icon={Users}
              tone="purple"
              subtext="publicados pela casa"
            />
          </AxeMetricRail>
        )}

        {/* 3. Composer Form */}
        {composerOpen && isAdmin && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <AxeCard className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#F0EBE1] pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B88728]">
                    Novo comunicado
                  </p>
                  <h2 className="font-display text-lg font-black text-[#17251D]">
                    Escreva a mensagem da casa
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  aria-label="Fechar formulário de comunicado"
                  onClick={() => setComposerOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6DFD3] text-[#59655E] hover:border-[#D8CDBA] hover:text-[#17251D]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                <fieldset disabled={isSubmitting} className="contents">
                <div className="sm:col-span-2">
                  <label className={appLabelClass}>Título do comunicado</label>
                  <input
                    required
                    className={cn(appInputClass, 'bg-[#FAF7F2] border-[#D8CDBA] text-[#17251D]')}
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Ex: Orientações para a gira de sábado e firmeza"
                  />
                </div>

                <div>
                  <label className={appLabelClass}>Categoria</label>
                  <select
                    className={cn(appInputClass, 'bg-[#FAF7F2] border-[#D8CDBA] text-[#17251D]')}
                    value={formData.categoria}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        categoria: e.target.value as Notice['categoria'],
                      })
                    }
                  >
                    <option value="Geral">Geral</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Festas">Festas</option>
                    <option value="Doutrina">Doutrina</option>
                  </select>
                </div>

                <div>
                  <label className={appLabelClass}>Expiração (opcional)</label>
                  <input
                    type="date"
                    className={cn(appInputClass, 'bg-[#FAF7F2] border-[#D8CDBA] text-[#17251D]')}
                    value={formData.expiracao}
                    onChange={(e) => setFormData({ ...formData, expiracao: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={appLabelClass}>Mensagem oficial</label>
                  <textarea
                    required
                    rows={4}
                    className={cn(
                      appInputClass,
                      'min-h-28 resize-y bg-[#FAF7F2] border-[#D8CDBA] text-sm text-[#17251D]',
                    )}
                    value={formData.conteudo}
                    onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                    placeholder="Escreva o comunicado que será lido pelos filhos no aplicativo..."
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8A958E]">
                    Canais de publicação
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                      <Smartphone className="h-5 w-5 text-emerald-700" />
                      <div>
                        <p className="text-xs font-black text-[#17251D]">Mural do aplicativo</p>
                        <p className="text-[11px] text-[#59655E]">Publicação imediata</p>
                      </div>
                      <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 hover:bg-emerald-50 transition-colors">
                      <MessageSquareText className="h-5 w-5 text-emerald-700" />
                      <div>
                        <p className="text-xs font-black text-[#17251D]">WhatsApp da corrente</p>
                        <p className="text-[11px] text-[#59655E]">Disparo oficial com anti-spam</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifyWhatsApp}
                        onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                        className="ml-auto h-4 w-4 accent-[#1F5942]"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:col-span-2 pt-2">
                  <AxeButton
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    icon={Send}
                    loading={isSubmitting}
                  >
                    {isSubmitting ? (publicationProgress?.stage === 'whatsapp' ? 'Enviando avisos…' : 'Publicando…') : 'Publicar comunicado'}
                  </AxeButton>
                  <AxeButton
                    type="button"
                    variant="ghost"
                    disabled={isSubmitting}
                    onClick={() => setComposerOpen(false)}
                  >
                    Cancelar
                  </AxeButton>
                </div>
                </fieldset>
                {isSubmitting && publicationProgress && (
                  <div role="status" aria-live="polite" aria-atomic="true" className="rounded-xl border border-[#B7D7C5] bg-[#F0F8F3] p-4 text-[#1F5942] sm:col-span-2">
                    <div className="flex items-center gap-2 text-sm font-black">
                      <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />
                      {publicationProgress.stage === 'publishing' ? 'Publicando seu comunicado…' : publicationProgress.stage === 'published' ? 'Comunicado publicado! Notificando o aplicativo…' : 'Comunicado publicado! Enviando pelo WhatsApp…'}
                    </div>
                    <ol className="mt-3 space-y-1 text-xs font-semibold">
                      <li>{publicationProgress.stage === 'publishing' ? '1. Publicação no mural em andamento' : '✓ Publicado no mural'}</li>
                      {notifyWhatsApp && <li>{publicationProgress.stage === 'whatsapp' ? '2. Processando os avisos individuais no WhatsApp' : '2. WhatsApp aguardando publicação'}</li>}
                    </ol>
                    {publicationProgress.total !== undefined && (
                      <div className="mt-3">
                        <progress aria-label="Destinatários processados no WhatsApp" className="h-2 w-full accent-[#1F5942]" max={Math.max(1, publicationProgress.total)} value={(publicationProgress.sent || 0) + (publicationProgress.errors || 0)} />
                        <p className="mt-1 text-xs">{(publicationProgress.sent || 0) + (publicationProgress.errors || 0)} de {publicationProgress.total} destinatários processados · {publicationProgress.sent || 0} enviados · {publicationProgress.errors || 0} falhas</p>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-[#59655E]">{elapsedSeconds}s decorridos. Aguarde nesta tela; não é necessário clicar novamente.{elapsedSeconds >= 20 ? ' O envio individual pode levar alguns minutos.' : ''}</p>
                  </div>
                )}
                {publicationError && !isSubmitting && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2">{publicationError}</div>}
              </form>
            </AxeCard>

            {/* WhatsApp Preview Card */}
            <AxeCard className="p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B88728]">
                  Prévia no WhatsApp
                </p>
                <div className="mx-auto mt-4 max-w-sm rounded-2xl border-2 border-[#D8CDBA] bg-[#EFEAE2] p-3 shadow-md">
                  <div className="rounded-xl bg-[#DCF8C6] p-3.5 text-[#17130D] shadow-xs">
                    <p className="text-xs font-black text-[#075E54]">
                      AxéCloud · {tenantData?.nome || 'Sua casa'}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[#171A16]">
                      Olá, [nome do filho]. Registramos uma nova atualização oficial no mural do{' '}
                      {tenantData?.nome || 'seu terreiro'}. Acesse o portal do filho para ler os detalhes.
                    </p>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-[#59655E]">
                      Mensagem automática · Não responda.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs font-semibold leading-relaxed text-[#59655E]">
                O envio acontece de forma individual e personalizada para cada irmão que possui
                WhatsApp cadastrado.
              </p>
            </AxeCard>
          </section>
        )}

        {/* 4. Section: Published Feed */}
        {activeSection === 'published' || !isAdmin ? (
          <div className="space-y-4">
            {/* Filter Bar */}
            <AxeFilterBar
              search={{
                value: searchTerm,
                onChange: setSearchTerm,
                placeholder: 'Buscar comunicado por título ou conteúdo...',
              }}
              filterTabs={{
                current: activeCategory,
                options: categories.map((cat) => ({ id: cat, label: cat })),
                onChange: (id) => setActiveCategory(id as typeof activeCategory),
              }}
            />

            {/* Notices Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredNotices.map((notice) => {
                const config = categoryConfig[notice.categoria] || categoryConfig.Geral;
                const Icon = config.icon;
                const badgeVariant =
                  notice.categoria === 'Urgente'
                    ? 'rose'
                    : notice.categoria === 'Festas'
                    ? 'amber'
                    : notice.categoria === 'Doutrina'
                    ? 'blue'
                    : 'stone';

                return (
                  <article
                    key={notice.id}
                    onClick={() => setSelectedNotice(notice)}
                    className={cn(
                      'group cursor-pointer rounded-lg border bg-white p-4 sm:p-5 shadow-[0_2px_8px_rgba(28,37,31,0.03)] transition-all hover:border-[#D8CDBA] hover:shadow-[0_4px_16px_rgba(28,37,31,0.06)]',
                      notice.categoria === 'Urgente'
                        ? 'border-red-200/90 bg-[#FFFDFD]'
                        : 'border-[#E6DFD3]',
                    )}
                  >
                    <div className="flex items-start gap-3.5">
                      <span
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                          config.bg,
                          config.border,
                        )}
                      >
                        <Icon className={cn('h-5 w-5', config.color)} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <AxeBadge variant={badgeVariant}>{notice.categoria}</AxeBadge>
                          <span className="text-xs font-semibold text-[#8A958E]">
                            {format(new Date(notice.data_publicacao), 'dd MMM yyyy', {
                              locale: ptBR,
                            })}
                          </span>
                        </div>

                        <h3 className="mt-2 font-display text-base font-black text-[#17251D] group-hover:text-[#1F5942] transition-colors truncate">
                          {notice.titulo}
                        </h3>

                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#59655E]">
                          {notice.conteudo}
                        </p>
                      </div>

                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#8A958E] group-hover:text-[#1F5942] transition-colors" />
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredNotices.length === 0 && (
              !notices.length ? (
                <div className="space-y-5">
                  <div className="relative overflow-hidden rounded-lg border border-[#D4AF37]/35 bg-gradient-to-br from-white via-[#FCFAF5] to-[#F7EFE1] p-6 sm:p-8 shadow-[0_4px_24px_rgba(28,37,31,0.05)]">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#1F5942]/20 blur-2xl" />
                    
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5AE12]/15 border border-[#E5AE12]/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8F630E] mb-3">
                        <span>✦</span>
                        <span>Comunicação Oficial & Alinhamento</span>
                      </div>
                      <h3 className="font-display text-2xl font-black text-[#17251D] sm:text-3xl">
                        Mural de Avisos & Transmissão WhatsApp
                      </h3>
                      <p className="mt-2 max-w-2xl text-xs sm:text-sm font-medium text-[#59655E] leading-relaxed">
                        Mantenha toda a corrente conectada e avisada. Publique avisos litúrgicos importantes com transmissão oficial para o WhatsApp de cada médium cadastrado.
                      </p>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        {isAdmin && (
                          <AxeButton
                            onClick={() => setComposerOpen(true)}
                            icon={Plus}
                            variant="primary"
                            size="lg"
                          >
                            Escrever primeiro comunicado
                          </AxeButton>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="rounded-lg border border-[#A8DEC0] bg-gradient-to-br from-white to-[#F0FAF4] p-4 sm:p-5 shadow-xs">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EE] border border-[#B7E2CB] text-[#1F5942]">
                        <Megaphone className="h-5 w-5" />
                      </div>
                      <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                        1. Avisos de Giras & Festas
                      </strong>
                      <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                        Data, horário, linha de trabalho, roupas e oferendas do dia.
                      </p>
                    </div>

                    <div className="rounded-lg border border-[#F8DC9B] bg-gradient-to-br from-white to-[#FFF9EB] p-4 sm:p-5 shadow-xs">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF7E6] border border-[#FBE3B5] text-[#8F630E]">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                        2. Doutrina & Preceito
                      </strong>
                      <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                        Orientações de recolhimento, banhos de axé e fundamentos.
                      </p>
                    </div>

                    <div className="rounded-lg border border-[#BDD9EC] bg-gradient-to-br from-white to-[#F0F7FC] p-4 sm:p-5 shadow-xs">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5FA] border border-[#CDE3F1] text-[#1E567B]">
                        <Send className="h-5 w-5" />
                      </div>
                      <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                        3. Entrega no WhatsApp
                      </strong>
                      <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                        Disparo simultâneo garantido para todos os filhos de santo ativos.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <AxeEmptyState
                  icon={Megaphone}
                  title="Nenhum comunicado encontrado neste filtro"
                  description="Tente selecionar outra categoria ou limpar a busca acima."
                />
              )
            )}
          </div>
        ) : (
          /* 5. Section: Transmission History (WhatsApp) */
          <AxeCard className="p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E6DFD3] bg-[#FAF7F2]/60 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-black text-[#17251D]">
                  Histórico de transmissões WhatsApp
                </h2>
                <p className="text-xs font-semibold text-[#59655E]">
                  Entregas recentes processadas pelo canal oficial da casa.
                </p>
              </div>
              <AxeButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void fetchBroadcastLogs()}
                icon={RefreshCw}
              >
                Atualizar
              </AxeButton>
            </div>

            <div className="divide-y divide-[#F0EBE1]">
              {broadcastLogs.map((log) => {
                const failed = ['failed', 'falha', 'error', 'erro'].includes(
                  String(log.status).toLowerCase(),
                );
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[#FAF7F2]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                          failed
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {failed ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-[#17251D]">
                          {log.mensagem || 'Comunicado oficial enviado'}
                        </p>
                        <p className="text-[11px] font-semibold text-[#8A958E]">
                          {log.telefone === 'corrente_geral'
                            ? 'Corrente geral'
                            : log.telefone || 'Destinatário'}{' '}
                          ·{' '}
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>

                    <AxeBadge variant={failed ? 'rose' : 'emerald'}>
                      {failed ? 'Falhou' : 'Enviado'}
                    </AxeBadge>
                  </div>
                );
              })}

              {broadcastLogs.length === 0 && (
                <div className="py-12 text-center text-sm font-semibold text-[#8A958E]">
                  Nenhuma transmissão registrada ainda.
                </div>
              )}
            </div>
          </AxeCard>
        )}
      </div>



      <BodyPortal>
      <AnimatePresence>
        {selectedNotice ? (
          <>
            <motion.button type="button" aria-label="Fechar comunicado" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedNotice(null)} className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={MODAL_TW} className="fixed inset-y-0 right-0 z-[101] flex w-full max-w-md flex-col border-l border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl" role="dialog" aria-modal="true">
              <div className="flex items-center justify-between border-b border-[#DED8CB] p-5"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#8F7724]">{selectedNotice.categoria}</p><h2 className="mt-1 font-display text-lg font-black text-[#171A16]">Comunicado publicado</h2></div><button type="button" onClick={() => setSelectedNotice(null)} className="grid h-10 w-10 place-items-center rounded-full border border-[#DCD6CA] bg-white/70 text-[#171A16] hover:bg-white"><X className="h-5 w-5" /></button></div>
              <div className="flex-1 overflow-y-auto p-5"><p className="text-xs font-semibold text-[#6F675C]">{(() => { const d = new Date(selectedNotice.data_publicacao); return Number.isNaN(d.getTime()) ? 'Data indisponível' : format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }); })()}</p><h3 className="mt-3 text-2xl font-black text-[#171A16]">{selectedNotice.titulo}</h3><div className="prose mt-5 max-w-none text-sm leading-relaxed text-[#171A16]"><ReactMarkdown rehypePlugins={[rehypeSanitize]}>{selectedNotice.conteudo || ''}</ReactMarkdown></div>{(() => { const expiryLabel = selectedNotice.expiracao ? formatNoticeExpiry(selectedNotice.expiracao) : null; return expiryLabel ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Visível até {expiryLabel}</div> : null; })()}</div>
              {isAdmin ? <div className="grid grid-cols-2 gap-2 border-t border-[#DED8CB] p-5"><button type="button" onClick={() => void copyToClipboard(selectedNotice.titulo, selectedNotice.conteudo, selectedNotice.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D8D2C4] bg-white text-sm font-bold text-[#4A463E] hover:bg-[#F5F0E5]"><Copy className="h-4 w-4" />{copiedId === selectedNotice.id ? 'Copiado' : 'Copiar'}</button><button type="button" disabled={deletingNoticeId !== null} aria-busy={deletingNoticeId === selectedNotice.id} onClick={() => void deleteNotice(selectedNotice.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B04A32] text-sm font-bold text-white hover:bg-[#9C3F2A] disabled:cursor-wait disabled:opacity-55">{deletingNoticeId === selectedNotice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{deletingNoticeId === selectedNotice.id ? 'Excluindo…' : 'Excluir'}</button><button type="button" onClick={() => { setFormData({ titulo: selectedNotice.titulo, conteudo: selectedNotice.conteudo, categoria: selectedNotice.categoria, expiracao: '' }); setSelectedNotice(null); setComposerOpen(true); }} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17251D] text-sm font-black text-[#FFFAF0] hover:bg-[#20342A]"><Send className="h-4 w-4" />Reenviar comunicado</button></div> : null}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
      </BodyPortal>

      {/* Success Modal */}
      <BodyPortal>
      <AnimatePresence>
        {showSuccessModal && lastPostedNotice && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-[min(100%,20rem)] mx-3 sm:mx-4 sm:w-full max-h-[88dvh] flex-col overflow-hidden rounded-lg border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl sm:max-w-sm"
            >
              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 text-center space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#EAF2EC] rounded-full flex items-center justify-center mx-auto border border-[#CDE0D3]">
                  <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-[#3F7258]" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-display text-lg sm:text-xl font-black text-[#171A16] leading-tight">Aviso <span className="text-[#8F7724]">publicado!</span></h3>
                  {lastWhatsappResult ? (
                    <p className={cn('text-xs sm:text-sm font-medium', lastWhatsappResult.errors > 0 || lastWhatsappResult.status === 'offline' ? 'text-amber-800' : 'text-[#3F7258]')}>
                      {lastWhatsappResult.status === 'offline' ? 'O canal WhatsApp está indisponível. O comunicado está publicado no mural.' : <>
                      WhatsApp: {lastWhatsappResult.sent} enviado(s)
                      {lastWhatsappResult.errors > 0 ? `, ${lastWhatsappResult.errors} falha(s)` : ''}
                      {lastWhatsappResult.skipped > 0 ? `, ${lastWhatsappResult.skipped} não processado(s) neste lote` : ''}.
                      </>}
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm text-[#6F675C] font-medium">Publicado no app sem disparo WhatsApp.</p>
                  )}
                  <p className="text-xs sm:text-sm text-[#6F675C] font-medium">Compartilhe manualmente se precisar.</p>
                </div>

                <div className="flex flex-col gap-2 sm:gap-2.5">
                  <a href={generateWhatsAppLink(lastPostedNotice.titulo, lastPostedNotice.conteudo)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#17251D] px-3 py-2.5 font-black text-xs sm:text-sm text-[#FFFAF0] transition-all hover:bg-[#20342A] active:scale-95">
                    <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Compartilhar manualmente
                  </a>
                  <button onClick={() => copyToClipboard(lastPostedNotice.titulo, lastPostedNotice.conteudo)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 font-black text-xs sm:text-sm text-[#4A463E] transition-all hover:bg-[#F5F0E5] active:scale-95">
                    <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                    Copiar texto
                  </button>
                </div>

                <button 
                  onClick={() => setShowSuccessModal(false)}
                  className="text-[#6F675C] text-sm font-bold hover:text-[#171A16] transition-colors pt-1"
                >
                  Fechar e voltar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </BodyPortal>
    </AppPageShell>
  );
}
