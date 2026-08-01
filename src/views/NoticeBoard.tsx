import React, { useState, useEffect, useMemo } from 'react';
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
  MessageSquareText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
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

export default function NoticeBoard({ isAdmin, tenantData, setActiveTab }: { isAdmin?: boolean, tenantData?: any, setActiveTab: (tab: string) => void }) {
  const tenantId = tenantData?.tenant_id;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastPostedNotice, setLastPostedNotice] = useState<{titulo: string, conteudo: string} | null>(null);
  const [lastWhatsappResult, setLastWhatsappResult] = useState<{ sent: number; errors: number; skipped: number; status?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [activeSection, setActiveSection] = useState<'published' | 'history'>('published');
  const [composerOpen, setComposerOpen] = useState(false);
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLog[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

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
        alert('Texto copiado para o WhatsApp!');
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
    setIsSubmitting(true);
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
      
      const payload = await response.json().catch(() => ({}));
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
      if (error.code === 'PGRST205') {
        alert('Erro: Tabela mural_avisos não encontrada. Por favor, execute o script de migração no Supabase.');
      } else {
        alert('Erro ao publicar aviso: ' + (error.message || 'Erro desconhecido'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteNotice(id: string) {
    if (!confirm('Deseja realmente excluir este aviso?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Sessão expirada. Faça login novamente.');
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
    } catch (error: unknown) {
      console.error('Error deleting notice:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao excluir aviso.';
      alert(msg);
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
      <div className="notice-v5-page">
      <header className="comms-page-header">
        <div className="comms-page-header__identity">
          <span><Megaphone className="h-6 w-6" /></span>
          <div>
            <p>Comunicação da casa</p>
            <h1>Comunicados</h1>
            <small>Mensagens oficiais, orientações e avisos para toda a corrente.</small>
          </div>
        </div>
        {isAdmin ? (
          <button type="button" onClick={() => setComposerOpen(true)}>
            <Plus className="h-4 w-4" /> Novo comunicado
          </button>
        ) : searchBar}
      </header>

      <div className="hidden" aria-hidden="true">
      <AppDemoPanelHeader
        title="Central de Comunicados"
        description="Publique no mural da casa e acompanhe as transmissões enviadas pelo WhatsApp."
        action={isAdmin ? (
          <button type="button" onClick={() => setComposerOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-[#17130D] hover:bg-[#FFD34E]">
            <Plus className="h-4 w-4" />
            Novo comunicado
          </button>
        ) : searchBar}
      />
      </div>

      {isAdmin ? (
        <section className="comms-old-metrics hidden" aria-label="Resumo dos comunicados">
          {[
            { label: 'Avisos ativos', value: activeNoticesCount, detail: 'visíveis no mural', icon: Megaphone, color: 'text-sky-300', bg: 'border-sky-400/20 bg-sky-400/10' },
            { label: 'Entregas registradas', value: successfulLogs.length, detail: 'no histórico recente', icon: Send, color: 'text-emerald-300', bg: 'border-emerald-400/20 bg-emerald-400/10' },
            { label: 'Falhas de envio', value: failedLogs, detail: failedLogs === 0 ? 'nenhuma falha recente' : 'precisam de atenção', icon: XCircle, color: 'text-rose-300', bg: 'border-rose-400/20 bg-rose-400/10' },
            { label: 'Comunicados', value: notices.length, detail: 'publicados pela casa', icon: Users, color: 'text-violet-300', bg: 'border-violet-400/20 bg-violet-400/10' },
          ].map((item) => {
            const Icon = item.icon;
            return <div key={item.label} className="rounded-2xl border border-[#252C35] bg-[#11151A] p-4 text-[#F8FAFC]"><div className={cn('grid h-9 w-9 place-items-center rounded-xl border', item.bg)}><Icon className={cn('h-4 w-4', item.color)} /></div><p className="mt-3 text-xs font-black uppercase tracking-[0.1em] text-[#8E9AAA]">{item.label}</p><p className="mt-1 text-xl font-black">{item.value}</p><p className="mt-1 text-xs font-semibold text-[#64748B]">{item.detail}</p></div>;
          })}
        </section>
      ) : null}

      {isAdmin ? (
        <div className="mb-4 flex w-fit rounded-xl border border-[#252C35] bg-[#11151A] p-1">
          <button type="button" onClick={() => setActiveSection('published')} className={cn('inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold', activeSection === 'published' ? 'bg-primary text-[#17130D]' : 'text-[#94A3B8] hover:text-white')}><MessageSquareText className="h-4 w-4" />Publicados</button>
          <button type="button" onClick={() => setActiveSection('history')} className={cn('inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold', activeSection === 'history' ? 'bg-primary text-[#17130D]' : 'text-[#94A3B8] hover:text-white')}><History className="h-4 w-4" />Histórico de envios</button>
        </div>
      ) : null}

      {composerOpen && isAdmin ? (
        <section className="comms-composer mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
          <AppDemoCard className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Novo comunicado</p><h2 className="mt-1 text-lg font-black text-white">Escreva a mensagem da casa</h2></div><button type="button" onClick={() => setComposerOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl text-[#94A3B8] hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={appLabelClass}>Título</label><input required className={appInputClass} value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} placeholder="Ex: Orientações para a gira de sábado" /></div>
              <div><label className={appLabelClass}>Categoria</label><select className={appInputClass} value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value as Notice['categoria'] })}><option value="Geral">Geral</option><option value="Urgente">Urgente</option><option value="Festas">Festas</option><option value="Doutrina">Doutrina</option></select></div>
              <div><label className={appLabelClass}>Expiração</label><input type="date" className={appInputClass} value={formData.expiracao} onChange={(e) => setFormData({ ...formData, expiracao: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={appLabelClass}>Mensagem</label><textarea required className={cn(appInputClass, 'min-h-32 resize-y text-sm')} value={formData.conteudo} onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })} placeholder="Escreva o comunicado que será visto pela corrente..." /></div>
              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8E9AAA]">Canais de publicação</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3"><Smartphone className="h-5 w-5 text-sky-300" /><div><p className="text-sm font-black text-white">Mural do aplicativo</p><p className="text-xs font-semibold text-[#64748B]">Sempre publicado</p></div><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" /></div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><MessageSquareText className="h-5 w-5 text-emerald-300" /><div><p className="text-sm font-black text-white">WhatsApp</p><p className="text-xs font-semibold text-[#64748B]">Com proteção anti-spam</p></div><input type="checkbox" checked={notifyWhatsApp} onChange={(e) => setNotifyWhatsApp(e.target.checked)} className="ml-auto h-4 w-4 accent-[#10B981]" /></label>
                </div>
              </div>
              <AppPrimaryButton type="submit" disabled={isSubmitting} className="sm:col-span-2 inline-flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" />Publicar comunicado</>}</AppPrimaryButton>
            </form>
          </AppDemoCard>
          <AppDemoCard className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">Prévia para o filho</p>
            <div className="mx-auto mt-4 max-w-sm rounded-[2rem] border-4 border-[#292F38] bg-[#E9E5DC] p-3 shadow-xl">
              <div className="rounded-2xl bg-[#DCF8C6] p-3 text-[#17130D] shadow-sm">
                <p className="text-xs font-black text-[#075E54]">AxéCloud · {tenantData?.nome || 'Sua casa'}</p>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">
                  Olá, [nome do filho]. Registramos uma atualização administrativa na sua conta de membro do {tenantData?.nome || 'seu terreiro'}. Os detalhes estão disponíveis na sua área do portal do filho de santo.
                </p>
                <p className="mt-2 text-right text-[10px] text-[#66756F]">agora ✓✓</p>
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold leading-relaxed text-[#64748B]">
              O WhatsApp envia só este aviso padrão (texto fixo aprovado pela Meta). O comunicado completo que você escreveu fica publicado no mural do aplicativo — o filho lê lá no portal.
            </p>
          </AppDemoCard>
        </section>
      ) : null}

      {activeSection === 'published' || !isAdmin ? (
        <div className="comms-workspace">
          <div className="comms-feed">
          <section className="mb-4 rounded-2xl border border-[#252C35] bg-[#11151A] p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#7F8B9C]" /><input type="search" placeholder="Buscar por título ou conteúdo" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={cn(appInputClass, 'min-h-11 pl-10 text-sm')} /></div>
              <div className="flex flex-wrap gap-2">{categories.map((cat) => <button key={cat} type="button" onClick={() => setActiveCategory(cat)} className={cn('rounded-lg border px-3 py-2 text-xs font-bold', activeCategory === cat ? 'border-primary bg-primary text-[#17130D]' : 'border-[#252C35] bg-[#151A21] text-[#94A3B8] hover:text-white')}>{cat}</button>)}</div>
            </div>
          </section>
          <ul className="grid gap-3 lg:grid-cols-2" role="list">
            {filteredNotices.map((notice) => {
              const config = categoryConfig[notice.categoria] || categoryConfig.Geral;
              const Icon = config.icon;
              return (
                <li key={notice.id}>
                  <button type="button" onClick={() => setSelectedNotice(notice)} className={cn('flex h-full w-full items-start gap-4 rounded-2xl border bg-[#11151A] p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/25', notice.categoria === 'Urgente' ? 'border-rose-500/25' : 'border-[#252C35]')}>
                    <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl border', config.bg, config.border)}><Icon className={cn('h-5 w-5', config.color)} /></span>
                    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-primary">{notice.categoria}</span><span className="text-xs font-semibold text-[#64748B]">{format(new Date(notice.data_publicacao), 'dd MMM yyyy', { locale: ptBR })}</span></span><span className="mt-2 block truncate text-base font-black text-white">{notice.titulo}</span><span className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-[#8E9AAA]">{notice.conteudo}</span></span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[#64748B]" />
                  </button>
                </li>
              );
            })}
            {filteredNotices.length === 0 ? <li className="col-span-full rounded-2xl border border-dashed border-[#BFB5A6] bg-white/55 px-4 py-12 text-center text-sm font-bold text-[#665F55]">Nenhum comunicado encontrado.</li> : null}
          </ul>
          </div>
          {isAdmin ? (
            <aside className="comms-control">
              <div className="comms-control__heading">
                <span><Send className="h-5 w-5" /></span>
                <div><p>Central de envio</p><h2>Alcance da comunicação</h2></div>
              </div>
              <div className="comms-control__numbers">
                <div><strong>{activeNoticesCount}</strong><span>ativos no mural</span></div>
                <div><strong>{successfulLogs.length}</strong><span>entregas recentes</span></div>
                <div className={failedLogs > 0 ? 'has-alert' : ''}><strong>{failedLogs}</strong><span>falhas de envio</span></div>
              </div>
              <button type="button" onClick={() => setComposerOpen(true)} className="comms-control__create">
                <Plus className="h-4 w-4" /> Escrever comunicado
              </button>
              <div className="comms-control__recent">
                <p>Atividade recente</p>
                {broadcastLogs.slice(0, 3).map((log) => {
                  const failed = ['failed', 'falha', 'error', 'erro'].includes(String(log.status).toLowerCase());
                  return (
                    <div key={log.id}>
                      <span className={failed ? 'is-failed' : 'is-sent'}>{failed ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}</span>
                      <div><strong>{failed ? 'Falha no envio' : 'Mensagem entregue'}</strong><small>{format(new Date(log.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</small></div>
                    </div>
                  );
                })}
                {broadcastLogs.length === 0 ? <small className="comms-control__empty">Os próximos envios aparecerão aqui.</small> : null}
              </div>
              <button type="button" onClick={() => setActiveSection('history')} className="comms-control__history">
                Ver histórico completo <ArrowUpRight className="h-4 w-4" />
              </button>
            </aside>
          ) : null}
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#252C35] bg-[#11151A] text-[#F8FAFC]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="text-lg font-black">Histórico de transmissões</h2><p className="text-xs font-semibold text-[#64748B]">Resultados recentes informados pelo canal oficial.</p></div><button type="button" onClick={() => void fetchBroadcastLogs()} className="grid h-10 w-10 place-items-center rounded-xl text-[#94A3B8] hover:bg-white/5 hover:text-white"><RefreshCw className="h-4 w-4" /></button></div>
          <div className="divide-y divide-white/10">
            {broadcastLogs.map((log) => {
              const failed = ['failed', 'falha', 'error', 'erro'].includes(String(log.status).toLowerCase());
              return <div key={log.id} className="flex items-start gap-3 px-5 py-4"><span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', failed ? 'bg-rose-400/10 text-rose-300' : 'bg-emerald-400/10 text-emerald-300')}>{failed ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{log.mensagem || 'Comunicado enviado'}</p><p className="mt-1 text-xs font-semibold text-[#64748B]">{log.telefone === 'corrente_geral' ? 'Corrente geral' : log.telefone || 'Destinatário'} · {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p></div><span className={cn('rounded-full px-2.5 py-1 text-xs font-black', failed ? 'bg-rose-400/10 text-rose-300' : 'bg-emerald-400/10 text-emerald-300')}>{failed ? 'Falhou' : 'Enviado'}</span></div>;
            })}
            {broadcastLogs.length === 0 ? <div className="px-5 py-12 text-center text-sm font-semibold text-[#64748B]">Nenhuma transmissão registrada ainda.</div> : null}
          </div>
        </section>
      )}

      <BodyPortal>
      <AnimatePresence>
        {selectedNotice ? (
          <>
            <motion.button type="button" aria-label="Fechar comunicado" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedNotice(null)} className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={MODAL_TW} className="fixed inset-y-0 right-0 z-[101] flex w-full max-w-md flex-col border-l border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl" role="dialog" aria-modal="true">
              <div className="flex items-center justify-between border-b border-[#DED8CB] p-5"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#8F7724]">{selectedNotice.categoria}</p><h2 className="mt-1 font-display text-lg font-black text-[#171A16]">Comunicado publicado</h2></div><button type="button" onClick={() => setSelectedNotice(null)} className="grid h-10 w-10 place-items-center rounded-full border border-[#DCD6CA] bg-white/70 text-[#171A16] hover:bg-white"><X className="h-5 w-5" /></button></div>
              <div className="flex-1 overflow-y-auto p-5"><p className="text-xs font-semibold text-[#6F675C]">{format(new Date(selectedNotice.data_publicacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p><h3 className="mt-3 text-2xl font-black text-[#171A16]">{selectedNotice.titulo}</h3><div className="prose mt-5 max-w-none text-sm leading-relaxed text-[#171A16]"><ReactMarkdown rehypePlugins={[rehypeSanitize]}>{selectedNotice.conteudo}</ReactMarkdown></div>{selectedNotice.expiracao ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Visível até {format(new Date(`${selectedNotice.expiracao}T12:00:00`), 'dd/MM/yyyy')}</div> : null}</div>
              {isAdmin ? <div className="grid grid-cols-2 gap-2 border-t border-[#DED8CB] p-5"><button type="button" onClick={() => void copyToClipboard(selectedNotice.titulo, selectedNotice.conteudo, selectedNotice.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D8D2C4] bg-white text-sm font-bold text-[#4A463E] hover:bg-[#F5F0E5]"><Copy className="h-4 w-4" />{copiedId === selectedNotice.id ? 'Copiado' : 'Copiar'}</button><button type="button" onClick={() => void deleteNotice(selectedNotice.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B04A32] text-sm font-bold text-white hover:bg-[#9C3F2A]"><Trash2 className="h-4 w-4" />Excluir</button><button type="button" onClick={() => { setFormData({ titulo: selectedNotice.titulo, conteudo: selectedNotice.conteudo, categoria: selectedNotice.categoria, expiracao: '' }); setSelectedNotice(null); setComposerOpen(true); }} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17251D] text-sm font-black text-[#FFFAF0] hover:bg-[#20342A]"><Send className="h-4 w-4" />Reenviar comunicado</button></div> : null}
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
              className="relative z-10 flex w-[min(100%,20rem)] mx-3 sm:mx-4 sm:w-full max-h-[88dvh] flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl sm:max-w-sm"
            >
              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 text-center space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#EAF2EC] rounded-full flex items-center justify-center mx-auto border border-[#CDE0D3]">
                  <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-[#3F7258]" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-display text-lg sm:text-xl font-black text-[#171A16] leading-tight">Aviso <span className="text-[#8F7724]">publicado!</span></h3>
                  {lastWhatsappResult ? (
                    <p className="text-xs sm:text-sm text-[#3F7258] font-medium">
                      WhatsApp: {lastWhatsappResult.sent} enviado(s)
                      {lastWhatsappResult.errors > 0 ? `, ${lastWhatsappResult.errors} falha(s)` : ''}
                      {lastWhatsappResult.skipped > 0 ? `, ${lastWhatsappResult.skipped} fora do lote` : ''}.
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
      </div>
    </AppPageShell>
  );
}
