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
  Send,
  Loader2,
  Trash2,
  MessageCircle,
  Copy,
  CheckCircle2,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { whatsappApiUrl, whatsappRailwayHeaders } from '../lib/whatsappApiUrl';
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

interface Notice {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: 'Urgente' | 'Festas' | 'Doutrina' | 'Geral';
  data_publicacao: string;
  expiracao?: string;
  tenant_id: string;
}

const categories = ['Todos', 'Urgente', 'Festas', 'Doutrina'] as const;

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isNotifyingWA, setIsNotifyingWA] = useState(false);

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
  }, [tenantId]);

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
          autorNome: tenantData?.nome_zelador || 'Zelador'
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
      
      setLastPostedNotice({ titulo: formData.titulo, conteudo: formData.conteudo });

      setShowSuccessModal(true);
      setFormData({ titulo: '', conteudo: '', categoria: 'Geral', expiracao: '' });
      fetchNotices();
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

  async function handleMassWhatsAppNotification(titulo: string) {
    if (isNotifyingWA) return;
    setIsNotifyingWA(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const childrenRes = await authFetch(`/api/children?userId=${user.id}&tenantId=${tenantId || ''}`);
      if (!childrenRes.ok) throw new Error('Não foi possível buscar a lista de filhos');
      
      const { data: childrenData } = await childrenRes.json();
      
      if (childrenData && childrenData.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const uid = session?.user?.id ?? user.id;
        if (!token || !uid) throw new Error('Sessão inválida para envio de WhatsApp');

        let count = 0;
        for (const child of childrenData) {
          if (child.whatsapp_phone) {
            count++;
            fetch(whatsappApiUrl('/whatsapp/send'), {
              method: 'POST',
              headers: whatsappRailwayHeaders(token, uid),
              body: JSON.stringify({
                tipo: 'mural_aviso',
                filhoId: child.id,
                variables: {
                  nome_filho: child.nome,
                  nome_terreiro: tenantData?.nome || 'Nosso Terreiro',
                  titulo_aviso: titulo
                }
              })
            }).catch(e => console.error('Error sending individual WhatsApp:', e));
          }
        }
        
        if (count > 0) {
          alert(`✅ Sucesso! ${count} notificações estão sendo processadas.`);
          setShowSuccessModal(false);
        } else {
          alert('Nenhum filho de santo encontrado com WhatsApp cadastrado.');
        }
      }
    } catch (error: any) {
      console.error('Error in handleMassWhatsAppNotification:', error);
      alert('Erro ao enviar notificações: ' + error.message);
    } finally {
      setIsNotifyingWA(false);
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

  if (loading && notices.length === 0) {
    return <AppPanelLoading />;
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
      <AppDemoPanelHeader
        title="Mural de avisos"
        description="Comunicados para filhos de santo e diretoria — substitui grupos espalhados no WhatsApp."
        action={searchBar}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
              activeCategory === cat
                ? 'border-primary/35 bg-primary/10 text-primary'
                : 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:text-[#F1F5F9]',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={cn('grid grid-cols-1 gap-6', isAdmin && 'lg:grid-cols-3')}>
        {isAdmin ? (
          <AppDemoCard>
            <h4 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-[#F1F5F9]">
              <Bell className="h-4 w-4 text-amber-400" aria-hidden />
              Novo aviso
            </h4>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className={appLabelClass}>Título</label>
                <input
                  required
                  className={appInputClass}
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex: Escala da gira de sábado"
                />
              </div>
              <div>
                <label className={appLabelClass}>Categoria</label>
                <select
                  className={appInputClass}
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value as Notice['categoria'] })}
                >
                  <option value="Geral">Geral</option>
                  <option value="Urgente">Urgente</option>
                  <option value="Festas">Festas</option>
                  <option value="Doutrina">Doutrina</option>
                </select>
              </div>
              <div>
                <label className={appLabelClass}>Mensagem</label>
                <textarea
                  required
                  className={cn(appInputClass, 'min-h-[88px] resize-y')}
                  value={formData.conteudo}
                  onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                  placeholder="Texto visível para a comunidade da casa..."
                />
              </div>
              <AppPrimaryButton type="submit" disabled={isSubmitting} className="mt-2 w-full">
                {isSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Publicar aviso'}
              </AppPrimaryButton>
            </form>
          </AppDemoCard>
        ) : null}

        <ul className={cn('space-y-3', isAdmin ? 'lg:col-span-2' : '')} role="list">
          {filteredNotices.map((notice) => {
            const isUrgent = notice.categoria === 'Urgente';
            return (
              <li
                key={notice.id}
                className={cn(
                  'rounded-2xl border border-[#1E242B] bg-[#13171D] p-4 transition-colors hover:border-[#2F3643]',
                  isUrgent && 'border-rose-500/25',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {isUrgent ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                          Urgente
                        </span>
                      ) : null}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        {notice.categoria}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {format(new Date(notice.data_publicacao), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-[#F1F5F9]">{notice.titulo}</h4>
                    <div className="prose prose-invert prose-sm mt-1.5 max-w-none text-xs leading-relaxed text-[#94A3B8] [&_p]:my-1">
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{notice.conteudo}</ReactMarkdown>
                    </div>
                  </div>
                  {isAdmin ? (
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => void deleteNotice(notice.id)}
                        className="rounded p-1 text-zinc-500 hover:text-rose-400"
                        aria-label="Remover aviso"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {isAdmin ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#1E242B] pt-3">
                    <button
                      type="button"
                      disabled={isNotifyingWA}
                      onClick={() => void handleMassWhatsAppNotification(notice.titulo)}
                      className="rounded-lg border border-emerald-500/25 bg-emerald-950/40 px-2 py-1 text-[10px] font-bold text-emerald-300"
                    >
                      WhatsApp em massa
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(notice.titulo, notice.conteudo, notice.id)}
                      className="rounded-lg border border-[#1E242B] px-2 py-1 text-[10px] font-bold text-[#94A3B8]"
                    >
                      {copiedId === notice.id ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
          {filteredNotices.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-[#2F3643] bg-[#12161A]/50 px-4 py-12 text-center text-sm text-[#94A3B8]">
              Nenhum aviso publicado ainda.
            </li>
          ) : null}
        </ul>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && lastPostedNotice && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-black/[0.94] backdrop-blur-none"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 w-[min(100%,20rem)] mx-3 sm:mx-4 sm:w-full overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[0_0_32px_rgba(251,188,0,0.08)] sm:max-w-sm"
            >
              <div className="overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 text-center space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-h-[88dvh] sm:max-h-[90dvh]">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-black text-white leading-tight">Aviso <span className="text-primary">Publicado!</span></h3>
                  <p className="text-xs sm:text-sm text-gray-400 font-medium">O que deseja fazer agora?</p>
                </div>

                <div className="flex flex-col gap-2 sm:gap-2.5">
                  <button disabled={isNotifyingWA}
                    onClick={() => handleMassWhatsAppNotification(lastPostedNotice.titulo)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-500 bg-emerald-600 px-3 py-2.5 font-black text-xs sm:text-sm text-white shadow-[0_0_16px_rgba(16,185,129,0.1)] transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50">
                    <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    {isNotifyingWA ? 'Enviando...' : 'Notificar Todos via WhatsApp'}
                  </button>
                  <a href={generateWhatsAppLink(lastPostedNotice.titulo, lastPostedNotice.conteudo)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-primary bg-black px-3 py-2.5 font-black text-xs sm:text-sm text-primary shadow-[0_0_16px_rgba(251,188,0,0.08)] transition-all hover:bg-primary/5 active:scale-95">
                    <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Compartilhar Manualmente
                  </a>
                  <button onClick={() => copyToClipboard(lastPostedNotice.titulo, lastPostedNotice.conteudo)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/5 px-3 py-2.5 font-black text-xs sm:text-sm text-white transition-all hover:bg-white/10 active:scale-95">
                    <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                    Copiar Texto para WhatsApp
                  </button>
                </div>

                <button 
                  onClick={() => setShowSuccessModal(false)}
                  className="text-gray-500 text-sm font-bold hover:text-white transition-colors pt-1"
                >
                  Fechar e voltar ao mural
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppPageShell>
  );
}
