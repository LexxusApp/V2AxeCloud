import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, CalendarDays, Clock, Moon, Star, Bell, Loader2, X, Ticket, User, Search, UserPlus, Lock, Smartphone, MessageSquare, ImagePlus, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { whatsappApiUrl, whatsappRailwayHeaders } from '../lib/whatsappApiUrl';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AppDemoCard,
  AppDemoPanelHeader,
  AppPrimaryButton,
  appInputClass,
  appLabelClass,
} from '../components/ui/appDemoUi';
import { SkeletonBlock, CalendarEventRowSkeleton } from '../components/Skeleton';
import { readStaleCache, writeStaleCache } from '../lib/staleCache';
import { authFetch } from '../lib/authenticatedFetch';
import { consumeCalendarFocusEventId } from '../lib/calendarFocus';
import { hasPlanAccess, hasPremiumTierFeatures } from '../constants/plans';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../lib/modalMotion';

interface Event {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  tipo: string;
  descricao: string;
  status_confirmacao: string;
  banner_url?: string | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const i = r.indexOf(',');
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

interface Guest {
  id: string;
  nome: string;
  telefone?: string | null;
  rsvp_token?: string | null;
  status: 'Confirmado' | 'Pendente' | 'Check-in' | 'Recusado';
}

type EventWhatsAppFeedback = {
  sent: number;
  errors: number;
  eligible: number;
  status: 'sent' | 'partial' | 'no_recipients' | 'channel_offline' | 'disabled' | 'failed';
};

function formatGiraWhatsAppFeedback(whatsapp?: EventWhatsAppFeedback): {
  message: string;
  type: 'success' | 'info' | 'error';
} {
  if (!whatsapp) {
    return { message: 'Gira criada com sucesso!', type: 'success' };
  }
  switch (whatsapp.status) {
    case 'sent':
      return {
        message: `Gira criada! WhatsApp enviado para ${whatsapp.sent} filho${whatsapp.sent === 1 ? '' : 's'}.`,
        type: 'success',
      };
    case 'partial':
      return {
        message: `Gira criada. WhatsApp: ${whatsapp.sent} enviado(s), ${whatsapp.errors} falha(s).`,
        type: 'info',
      };
    case 'no_recipients':
      return {
        message: 'Gira criada. Nenhum filho ativo com WhatsApp cadastrado.',
        type: 'info',
      };
    case 'channel_offline':
      return {
        message: 'Gira criada. Canal WhatsApp offline — avisos não enviados.',
        type: 'info',
      };
    case 'disabled':
      return {
        message: 'Gira criada. Avisos de gira desativados nas configurações do WhatsApp.',
        type: 'info',
      };
    case 'failed':
      return {
        message: `Gira criada, mas falhou o envio no WhatsApp (${whatsapp.errors} erro${whatsapp.errors === 1 ? '' : 's'}).`,
        type: 'error',
      };
    default:
      return { message: 'Gira criada com sucesso!', type: 'success' };
  }
}

function guestStatusMeta(status: Guest['status']) {
  switch (status) {
    case 'Confirmado':
      return { label: 'Confirmado', color: 'text-primary', badge: 'bg-primary/15 text-primary' };
    case 'Recusado':
      return { label: 'Não vai', color: 'text-red-400', badge: 'bg-red-500/15 text-red-400' };
    case 'Check-in':
      return { label: 'Check-in', color: 'text-emerald-500', badge: 'bg-emerald-500/20 text-emerald-500' };
    default:
      return { label: 'Pendente', color: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400' };
  }
}

function CalendarToast({ toast }: { toast: { message: string; type: 'success' | 'info' | 'error' } | null }) {
  if (!toast) return null;
  return (
    <div
      className={cn(
        'fixed right-4 top-20 z-[120] max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl',
        toast.type === 'success' && 'border-emerald-500/30 bg-emerald-950/95 text-emerald-100',
        toast.type === 'info' && 'border-sky-500/30 bg-sky-950/95 text-sky-100',
        toast.type === 'error' && 'border-rose-500/30 bg-rose-950/95 text-rose-100',
      )}
      role="status"
    >
      {toast.message}
    </div>
  );
}

function formatHoraEvento(hora?: string): string {
  const raw = (hora || '').trim();
  if (!raw) return '';
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return raw.slice(0, 5);
}

function EventDetailModalPanel({ event, onClose }: { event: Event; onClose: () => void }) {
  const hasBanner = Boolean(event.banner_url?.trim());
  const descricao = (event.descricao || '').trim();
  const horaFmt = formatHoraEvento(event.hora);

  const detailsBlock = (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-4">
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-4">
        <div className="flex items-center gap-2 text-white">
          <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-bold">
            {format(parseISO(event.data), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })}
          </span>
        </div>
        {horaFmt ? (
          <div className="flex items-center gap-2 text-white">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-bold">{horaFmt}</span>
          </div>
        ) : null}
      </div>
      {descricao ? (
        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">Descrição</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{descricao}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[101] overflow-y-auto overscroll-y-contain"
        onClick={onClose}
        role="presentation"
      >
        <div className="flex min-h-full items-center justify-center p-4 sm:p-6 pointer-events-none">
          <motion.div
            initial={MODAL_PANEL_IN}
            animate={MODAL_PANEL_DONE}
            exit={MODAL_PANEL_OUT}
            transition={MODAL_TW}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-detail-title"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'pointer-events-auto my-auto flex w-full max-h-[min(92dvh,calc(100dvh-2rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl',
              hasBanner ? 'max-w-[min(96vw,52rem)]' : 'max-w-sm',
            )}
          >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 id="event-detail-title" className="truncate text-base font-black text-white sm:text-lg">
                  {event.titulo}
                </h3>
                <p className="truncate text-xs font-medium uppercase tracking-widest text-gray-500">{event.tipo}</p>
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {hasBanner ? (
              <div className="flex min-h-0 flex-col sm:flex-row sm:items-stretch">
                <div className="flex shrink-0 items-center justify-center border-b border-white/5 bg-[#0a0c0f] p-3 sm:w-[min(44%,18rem)] sm:border-b-0 sm:border-r sm:p-4">
                  <img
                    src={event.banner_url!}
                    alt={event.titulo}
                    className="block max-h-[min(38dvh,360px)] w-auto max-w-full rounded-xl object-contain sm:max-h-[min(68dvh,520px)] sm:w-full"
                  />
                </div>
                <div className="min-w-0 flex-1 px-5 py-5 sm:px-6 sm:py-6">{detailsBlock}</div>
              </div>
            ) : (
              <>
                <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-primary/15 to-transparent">
                  <CalendarIcon className="h-12 w-12 text-white/15" />
                </div>
                <div className="px-5 py-5 sm:px-6">{detailsBlock}</div>
              </>
            )}
          </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}

type EventFormData = {
  titulo: string;
  data: string;
  hora: string;
  tipo: string;
  descricao: string;
  status_confirmacao: string;
  evento_publico: boolean;
};

type AddEventModalPanelProps = {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  isSubmitting: boolean;
  bannerInputRef: React.RefObject<HTMLInputElement | null>;
  bannerPreview: string | null;
  onBannerFile: (file: File) => void;
};

function AddEventModalPanel({
  onClose,
  onSubmit,
  formData,
  setFormData,
  isSubmitting,
  bannerInputRef,
  bannerPreview,
  onBannerFile,
}: AddEventModalPanelProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4 pt-20 sm:p-8 sm:pt-24">
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
        aria-labelledby="add-event-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[101] my-auto flex w-full max-h-[min(80dvh,calc(100dvh-7rem))] max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 id="add-event-title" className="text-base font-black text-white sm:text-lg">
                Nova gira / evento
              </h3>
              <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500">
                Agendar no calendário do terreiro
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

        <form onSubmit={onSubmit} className="overflow-y-auto overscroll-y-contain p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
            <div className="sm:col-span-2">
              <label className={appLabelClass}>Nome</label>
              <input
                required
                className={appInputClass}
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Gira Caboclos Penacho"
              />
            </div>
            <div>
              <label className={appLabelClass}>Tipo de trabalho</label>
              <select
                required
                className={appInputClass}
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              >
                <option value="Gira">Normal</option>
                <option value="Festa">Festa pública</option>
                <option value="Obrigação">Trabalho interno</option>
                <option value="Manutenção">Caridade</option>
                <option value="Reunião">Reunião</option>
              </select>
            </div>
            <div>
              <label className={appLabelClass}>Destaque</label>
              <select
                className={appInputClass}
                value={formData.status_confirmacao}
                onChange={(e) => setFormData({ ...formData, status_confirmacao: e.target.value })}
              >
                <option value="Confirmado">Confirmada</option>
                <option value="Especial">Especial / obrigação</option>
              </select>
            </div>
            <div>
              <label className={appLabelClass}>Data</label>
              <input
                required
                type="date"
                className={appInputClass}
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              />
            </div>
            <div>
              <label className={appLabelClass}>Horário</label>
              <input
                required
                type="time"
                className={appInputClass}
                value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={appLabelClass}>Descrição (opcional)</label>
              <textarea
                rows={2}
                className={cn(appInputClass, 'resize-none')}
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes do evento…"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2.5 sm:col-span-2">
              <input
                type="checkbox"
                checked={formData.evento_publico}
                onChange={(e) => setFormData({ ...formData, evento_publico: e.target.checked })}
                className="h-4 w-4 accent-[#FBBC00]"
              />
              <span className="text-xs font-semibold text-[#94A3B8]">
                Divulgar no portal público (/eventos)
              </span>
            </label>
            <div className="rounded-xl border border-[#1E242B] bg-[#12161A] p-3 sm:col-span-2">
              <label className={appLabelClass}>Banner (opcional)</label>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (!f.type.startsWith('image/')) {
                    alert('Selecione um arquivo de imagem.');
                    return;
                  }
                  if (f.size > 4.5 * 1024 * 1024) {
                    alert('Imagem muito grande (máx. 4,5 MB).');
                    return;
                  }
                  onBannerFile(f);
                  e.target.value = '';
                }}
              />
              {bannerPreview ? (
                <img
                  src={bannerPreview}
                  alt="Prévia do banner"
                  className="mt-2 max-h-28 w-full rounded-lg object-contain"
                />
              ) : null}
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[#94A3B8] hover:text-[#F1F5F9]"
              >
                <ImagePlus className="h-3.5 w-3.5 text-primary" />
                {bannerPreview ? 'Trocar imagem' : 'Adicionar imagem'}
              </button>
            </div>
          </div>
          <AppPrimaryButton
            type="submit"
            disabled={isSubmitting}
            className="mt-5 inline-flex w-full items-center justify-center sm:mt-6"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Marcar na agenda'}
          </AppPrimaryButton>
        </form>
      </motion.div>
    </div>
  );
}

interface CalendarProps {
  user?: any;
  userRole?: string;
  tenantData?: any;
  setActiveTab: (tab: string) => void;
}

export default function Calendar({ user, userRole, tenantData, setActiveTab }: CalendarProps) {
  const isFilho = userRole === 'filho';
  const isGlobalAdmin = tenantData?.is_admin_global === true;
  // Não-filhos são sempre gestores do terreiro independente do role exato no banco.
  const isAdmin = !isFilho;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEventForGuests, setSelectedEventForGuests] = useState<Event | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'event' | 'guest'; title?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNotifying, setIsNotifying] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [eventDetailModal, setEventDetailModal] = useState<Event | null>(null);
  const [addEventModalOpen, setAddEventModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const hasAccess = hasPlanAccess(tenantData?.plan, 'gestao_eventos', tenantData?.is_admin_global);
  const effectiveTenantId = tenantData?.tenant_id || (!isFilho ? user?.id : undefined);

  const handleNotifyAll = async (event: Event) => {
    try {
      setIsNotifying(event.id);
      const response = await authFetch('/api/push-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: effectiveTenantId,
          title: `🗓️ Novo Evento: ${event.titulo}`,
          body: `Marcado para ${new Date(event.data).toLocaleDateString('pt-BR')} às ${event.hora}. Contamos com sua presença!`,
          url: '/calendar'
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      alert(`Notificação enviada com sucesso para ${data.sentCount} dispositivos!`);
    } catch (error: any) {
      console.error('Error notifying all:', error);
      alert('Erro ao enviar notificação: ' + error.message);
    } finally {
      setIsNotifying(null);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    hora: '20:00',
    tipo: 'Gira',
    descricao: '',
    status_confirmacao: 'Confirmado',
    evento_publico: false,
  });

  useEffect(() => {
    if (!effectiveTenantId) {
      setLoading(true);
      return;
    }
    void fetchEvents();
  }, isFilho ? [currentMonth, effectiveTenantId, isFilho] : [effectiveTenantId, isFilho]);

  useEffect(() => {
    if (selectedEventForGuests) {
      fetchGuests(selectedEventForGuests.id);
    }
  }, [selectedEventForGuests]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (loading || events.length === 0) return;
    const focusId = consumeCalendarFocusEventId();
    if (!focusId) return;
    const ev = events.find((e) => e.id === focusId);
    if (ev) setEventDetailModal(ev);
  }, [loading, events]);

  async function fetchEvents() {
    if (!effectiveTenantId) return;

    // Gestor: traz todos os eventos do terreiro (gestão e “próximo evento” não dependem do mês visível)
    if (!isFilho) {
      const cacheKey = `cal_events_all_${effectiveTenantId}`;
      const cached = readStaleCache<Event[]>(cacheKey);
      if (cached != null) {
        setEvents(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const url = `/api/events?tenantId=${encodeURIComponent(effectiveTenantId)}`;
        const response = await authFetch(url);
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`Failed to fetch events (${response.status}): ${body}`);
        }
        const { data } = await response.json();
        const list = data || [];
        setEvents(list);
        writeStaleCache(cacheKey, list);
      } catch (error) {
        console.error('Error fetching events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    const monthStart = startOfMonth(currentMonth);
    const rangeEnd = addDays(endOfMonth(currentMonth), 7);
    const monthKey = format(monthStart, 'yyyy-MM');
    const cacheKey = `cal_events_${effectiveTenantId}_${monthKey}`;

    const cached = readStaleCache<Event[]>(cacheKey);
    if (cached != null) {
      setEvents(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const url = `/api/events?tenantId=${encodeURIComponent(effectiveTenantId)}&start=${format(monthStart, 'yyyy-MM-dd')}&end=${format(rangeEnd, 'yyyy-MM-dd')}`;
      const response = await authFetch(url);
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Failed to fetch events (${response.status}): ${body}`);
      }
      const { data } = await response.json();
      const list = data || [];
      setEvents(list);
      writeStaleCache(cacheKey, list);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGuests(eventId: string) {
    setLoadingGuests(true);
    try {
      const { data, error } = await supabase
        .from('convidados_eventos')
        .select('id, nome, telefone, status, rsvp_token')
        .eq('event_id', eventId)
        .order('nome');
      
      if (error) throw error;
      setGuests(data || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
    } finally {
      setLoadingGuests(false);
    }
  }

  async function addGuest() {
    if (!newGuestName.trim() || !selectedEventForGuests) return;
    
    try {
      const { data, error } = await supabase
        .from('convidados_eventos')
        .insert([{
          event_id: selectedEventForGuests.id,
          nome: newGuestName.trim(),
          telefone: newGuestPhone.trim() ? newGuestPhone.trim().replace(/\D/g, '') : null,
          status: 'Pendente' // Modifiquei de Confirmado para Pendente, para dar o sentido na confirmação
        }])
        .select()
        .single();

      if (error) throw error;
      setGuests([...guests, data]);

      // Disparar WhatsApp se for premium e e houver telefone
      const isPremium = tenantData?.is_admin_global || hasPremiumTierFeatures(tenantData?.plan);
      if (isPremium && newGuestPhone.trim()) {
         try {
           const { data: { session } } = await supabase.auth.getSession();
           const token = session?.access_token;
           const uid = session?.user?.id;
           if (!token || !uid) return;
           const rsvpToken = String(data?.rsvp_token || '').trim();
           const waRes = await fetch(whatsappApiUrl('/whatsapp/send'), {
              method: 'POST',
              headers: whatsappRailwayHeaders(token, uid),
              body: JSON.stringify({
                tipo: 'convite_evento',
                forcePhone: newGuestPhone.trim(),
                variables: {
                  event_id: selectedEventForGuests.id,
                  nome_convidado: newGuestName.trim(),
                  nome_terreiro: tenantData?.nome_terreiro || 'Nosso Terreiro',
                  nome_evento: selectedEventForGuests.titulo,
                  data_evento: format(parseISO(selectedEventForGuests.data), 'dd/MM/yyyy'),
                  hora_evento: selectedEventForGuests.hora,
                  local_evento: selectedEventForGuests.descricao || 'A confirmar',
                  banner_url: selectedEventForGuests.banner_url || '',
                  rsvp_token: rsvpToken,
                }
              })
           });
           if (!waRes.ok) {
             const waErr = await waRes.json().catch(() => ({}));
             console.warn('WhatsApp convite:', (waErr as { error?: string }).error || waRes.status);
           }
         } catch(e) {
            console.error('Erro ao enviar whatsapp para convidado', e);
         }
      }

      setNewGuestName('');
      setNewGuestPhone('');
    } catch (error) {
      console.error('Error adding guest:', error);
      alert('Erro ao adicionar convidado.');
    }
  }

  async function updateGuestStatus(guestId: string, status: Guest['status']) {
    try {
      const { error } = await supabase
        .from('convidados_eventos')
        .update({ status })
        .eq('id', guestId);

      if (error) throw error;
      setGuests(guests.map(g => g.id === guestId ? { ...g, status } : g));
    } catch (error) {
      console.error('Error updating guest status:', error);
    }
  }

  async function removeGuest(guestId: string) {
    try {
      const { error } = await supabase
        .from('convidados_eventos')
        .delete()
        .eq('id', guestId);

      if (error) throw error;
      setGuests(guests.filter(g => g.id !== guestId));
    } catch (error) {
      console.error('Error removing guest:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let banner_url: string | undefined;
      if (bannerFile && effectiveTenantId) {
        const fileData = await fileToBase64(bannerFile);
        const uploadRes = await authFetch('/api/v1/event-banner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData,
            fileName: bannerFile.name,
            contentType: bannerFile.type,
            tenantId: effectiveTenantId,
          }),
        });
        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          throw new Error(uploadJson.error || 'Falha ao enviar o banner');
        }
        if (uploadJson.publicUrl) banner_url = uploadJson.publicUrl;
      }

      const eventData = {
        ...formData,
        ...(banner_url ? { banner_url } : {}),
        lider_id: user?.id,
        tenant_id: effectiveTenantId || user?.id
      };

      const response = await authFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create event');
      }
      
      const result = await response.json();
      const feedback = formatGiraWhatsAppFeedback(result.whatsapp as EventWhatsAppFeedback | undefined);
      setToast(feedback);
      
      setBannerFile(null);
      setBannerPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setFormData({
        titulo: '',
        data: format(new Date(), 'yyyy-MM-dd'),
        hora: '20:00',
        tipo: 'Gira',
        descricao: '',
        status_confirmacao: 'Confirmado',
        evento_publico: false,
      });
      setAddEventModalOpen(false);
      fetchEvents();
    } catch (error: any) {
      console.error('Error adding event:', error);
      alert(error.message || 'Erro ao criar evento.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isEventPassed = (dateStr: string, timeStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      const eventDateTime = new Date(year, month - 1, day, hours, minutes);
      return eventDateTime < new Date();
    } catch (err) {
      return false;
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const getEventColor = (type: string) => {
    switch (type) {
      case 'Festa': return 'bg-green-500';
      case 'Obrigação': return 'bg-amber-500';
      case 'Manutenção': return 'bg-blue-500';
      case 'Gira': return 'bg-white';
      default: return 'bg-primary';
    }
  };

  const getEventStyles = (type: string) => {
    switch (type) {
      case 'Festa': return 'bg-green-500/10 text-green-500 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]';
      case 'Obrigação': return 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]';
      case 'Manutenção': return 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]';
      case 'Gira': return 'bg-white/5 text-white border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)]';
      default: return 'bg-[#FBBC00]/10 text-[#FBBC00] border-[#FBBC00]/20 shadow-[0_0_10px_rgba(251,188,0,0.1)]';
    }
  };

  const parseEventDateTime = (e: Event) => {
    const [y, m, d] = e.data.split('-').map(Number);
    const parts = (e.hora || '0:0:0').toString().split(':').map((p) => parseInt(p, 10) || 0);
    const h = parts[0] ?? 0;
    const min = parts[1] ?? 0;
    const s = parts[2] ?? 0;
    return new Date(y, m - 1, d, h, min, s);
  };

  /** Próximo evento futuro (qualquer data/mês) — requer lista completa no zelador. */
  const nextUpcomingEvent = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter((e) => {
        try {
          return parseEventDateTime(e).getTime() > now.getTime();
        } catch {
          return false;
        }
      })
      .sort((a, b) => parseEventDateTime(a).getTime() - parseEventDateTime(b).getTime())[0] ?? null;
  }, [events]);

  /** Todos os eventos em ordem cronológica (gestão: qualquer mês/ano). */
  const eventsSorted = useMemo(() => {
    return [...events].sort(
      (a, b) => parseEventDateTime(a).getTime() - parseEventDateTime(b).getTime()
    );
  }, [events]);

  const eventsNewestFirst = useMemo(() => [...eventsSorted].reverse(), [eventsSorted]);

  if (loading && events.length === 0) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  // Layout exclusivo para filhos de santo: calendário compacto + lista de eventos abaixo
  if (isFilho) {
    const upcomingEvents = [...events]
      .sort((a, b) => {
        const dateA = new Date(`${a.data}T${a.hora}`);
        const dateB = new Date(`${b.data}T${b.hora}`);
        return dateA.getTime() - dateB.getTime();
      });

    return (
      <AppPageShell>
        <CalendarToast toast={toast} />
        <AppDemoPanelHeader
          title="Giras e eventos"
          description="Calendário de obrigações do terreiro."
          action={
            <button
              type="button"
              onClick={() => void fetchEvents()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2 text-xs font-bold text-[#F1F5F9]"
              title="Atualizar"
            >
              <Loader2 className={cn('h-4 w-4', loading && 'animate-spin')} />
              Atualizar
            </button>
          }
        />

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

            {/* Calendário compacto — coluna esquerda */}
            <AppDemoCard className="p-5 lg:sticky lg:top-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-black text-white capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h3>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={nextMonth} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-[10px] font-black text-gray-600 uppercase tracking-widest py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const dayEvents = events.filter(e => isSameDay(parseISO(e.data), day));
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "aspect-square rounded-xl border transition-all flex flex-col items-center justify-center gap-0.5",
                        isSelected
                          ? "bg-primary/20 border-primary/50 shadow-[0_0_12px_rgba(251,188,0,0.15)]"
                          : isToday
                            ? "bg-white/10 border-white/20"
                            : "bg-card border-border hover:border-white/20 hover:bg-white/5",
                        !isCurrentMonth && "opacity-25"
                      )}
                    >
                      <span className={cn(
                        "text-xs font-black",
                        isSelected ? "text-primary" : isToday ? "text-white" : (dayEvents.length > 0 ? "text-primary" : "text-gray-500")
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 justify-center">
                          {dayEvents.slice(0, 3).map((e, i) => (
                            <div key={i} className={cn("w-1 h-1 rounded-full", getEventColor(e.tipo))} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/5">
                {[
                  { tipo: 'Gira', color: 'bg-white' },
                  { tipo: 'Festa', color: 'bg-green-500' },
                  { tipo: 'Obrigação', color: 'bg-amber-500' },
                  { tipo: 'Reunião', color: 'bg-primary' },
                ].map(item => (
                  <div key={item.tipo} className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", item.color)} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{item.tipo}</span>
                  </div>
                ))}
              </div>
            </AppDemoCard>

            {/* Lista de eventos — coluna direita */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Próximos Eventos
              </h3>

              {loading ? (
                <div className="space-y-3 py-4">
                  <CalendarEventRowSkeleton />
                  <CalendarEventRowSkeleton />
                  <CalendarEventRowSkeleton />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <AppDemoCard className="text-center text-[#94A3B8]">
                  Nenhum evento cadastrado.
                </AppDemoCard>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => {
                    const passed = isEventPassed(event.data, event.hora);
                    const horaFmt = formatHoraEvento(event.hora);
                    const dataCurta = format(parseISO(event.data), "dd/MM", { locale: ptBR });
                    const dataLonga = format(parseISO(event.data), "EEE, dd MMM", { locale: ptBR });
                    return (
                      <button
                        type="button"
                        key={event.id}
                        onClick={() => setEventDetailModal(event)}
                        className={cn(
                          'group flex w-full items-center gap-3 overflow-hidden rounded-xl border border-[#1E242B] bg-[#13171D] p-2.5 text-left transition-all hover:border-primary/25 sm:p-3',
                          passed && 'opacity-60',
                          !passed && 'border-l-2 border-l-primary pl-2 sm:pl-2.5',
                        )}
                      >
                        <div className="relative h-14 w-[3.75rem] shrink-0 overflow-hidden rounded-lg bg-[#0d0d0d] sm:h-16 sm:w-[4.25rem]">
                          {event.banner_url ? (
                            <img src={event.banner_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-transparent">
                              <CalendarIcon className="h-5 w-5 text-white/15" aria-hidden />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                                passed ? 'bg-[#12161A] text-[#64748B]' : 'bg-primary/15 text-primary',
                              )}
                            >
                              {event.tipo}
                            </span>
                            {passed ? (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-rose-400">
                                Encerrado
                              </span>
                            ) : null}
                          </div>
                          <h4 className="line-clamp-1 text-sm font-bold leading-tight text-[#F1F5F9]">
                            {event.titulo}
                          </h4>
                          {event.descricao ? (
                            <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-[#64748B]">
                              {event.descricao}
                            </p>
                          ) : null}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-[#94A3B8]">
                            <span className="inline-flex items-center gap-1 capitalize">
                              <CalendarIcon className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                              {dataLonga}
                            </span>
                            {horaFmt ? (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Clock className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                                {horaFmt}
                              </span>
                            ) : null}
                            <span className="text-[#64748B]">{dataCurta}</span>
                        </div>
                            </div>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-[#64748B] transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                          aria-hidden
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {eventDetailModal && (
            <EventDetailModalPanel event={eventDetailModal} onClose={() => setEventDetailModal(null)} />
          )}
        </AnimatePresence>
      </AppPageShell>
    );
  }

  return (
    <>
      <CalendarToast toast={toast} />
      <AppPageShell>
        <AppDemoPanelHeader
          title="Calendário de giras"
          description="Agende trabalhos espirituais, festas e giras — com lembretes automáticos no WhatsApp."
          action={
                <button 
              type="button"
              onClick={() => setAddEventModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/35 bg-[#12161A] px-3 py-2 text-xs font-bold text-primary transition-all hover:border-primary/50 hover:bg-primary/10"
                >
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Adicionar
                </button>
          }
        />

        <div className="space-y-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(17.5rem,20rem))] gap-3">
              {eventsNewestFirst.map((event) => {
                const passed = isEventPassed(event.data, event.hora);
                const isEspecial =
                  event.status_confirmacao === 'Especial' || event.tipo === 'Obrigação';
                return (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => setEventDetailModal(event)}
                    className={cn(
                      'group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] text-left transition-all hover:border-[#2F3643] hover:shadow-lg',
                      passed && 'opacity-70',
                    )}
                  >
                    <div className="relative h-36 w-full overflow-hidden bg-[#0d0d0d] sm:h-40">
                    {event.banner_url ? (
                        <img
                          src={event.banner_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-transparent">
                          <CalendarIcon className="h-10 w-10 text-white/15" />
                      </div>
                    )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                      <div
                        className="absolute right-2 top-2 flex gap-0.5 rounded-lg bg-black/50 p-0.5 backdrop-blur-sm"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        {!passed ? (
                            <button 
                              type="button"
                            onClick={() => void handleNotifyAll(event)}
                              disabled={isNotifying === event.id}
                            className="rounded p-1.5 text-primary hover:bg-white/10 disabled:opacity-50"
                            title="Notificar push no app"
                          >
                            {isNotifying === event.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Bell className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : null}
                          <button 
                            type="button"
                          onClick={() => setSelectedEventForGuests(event)}
                          className={cn(
                            'rounded p-1.5 hover:bg-white/10',
                            hasAccess ? 'text-primary' : 'text-zinc-600',
                          )}
                          title={hasAccess ? 'Convidados' : 'Plano Oirô'}
                          disabled={!hasAccess}
                        >
                          <Ticket className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            type="button"
                          onClick={() =>
                            setItemToDelete({ id: event.id, type: 'event', title: event.titulo })
                          }
                          className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-rose-400"
                          aria-label="Remover gira"
                        >
                          <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm',
                            isEspecial
                              ? 'bg-rose-500/90 text-white'
                              : passed
                                ? 'bg-black/50 text-gray-400'
                                : 'bg-primary/90 text-black',
                          )}
                        >
                          {event.tipo}
                        </span>
                        {passed ? (
                          <span className="rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-100 backdrop-blur-sm">
                            Encerrado
                          </span>
                        ) : null}
                    </div>
                      </div>
                    <div className="p-4">
                      <h4 className="text-base font-black leading-tight text-[#F1F5F9]">{event.titulo}</h4>
                      {event.descricao ? (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#94A3B8]">{event.descricao}</p>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between border-t border-[#1E242B] pt-3 text-xs text-[#94A3B8]">
                        <span className="flex items-center gap-1 font-bold">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden />
                          {format(parseISO(event.data), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <span className="flex items-center gap-1 font-bold">
                          <Clock className="h-3.5 w-3.5 text-primary" aria-hidden />
                        {event.hora}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary/70">
                        Toque para ver detalhes
                      </p>
                    </div>
                </button>
                );
              })}
              {eventsNewestFirst.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-[#2F3643] bg-[#12161A]/50 px-4 py-12 text-center text-sm text-[#94A3B8]">
                  Nenhuma gira cadastrada ainda.
              </div>
              ) : null}
                </div>
            <div className="flex items-start gap-3 rounded-xl border border-[#1E242B] bg-[#12161A] p-4">
              <div className="rounded-lg border border-[#1E242B] bg-[#13171D] p-2 text-primary">
                <MessageSquare className="h-5 w-5" aria-hidden />
                  </div>
              <div>
                <p className="text-xs font-bold text-[#F1F5F9]">Convites e lembretes no WhatsApp</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#94A3B8]">
                  Ao criar uma gira, filhos com WhatsApp cadastrado recebem o aviso automaticamente.
                  Convidados com telefone também recebem convite ao serem adicionados — e lembretes
                  automáticos antes da gira.
                </p>
                  </div>
                </div>
                </div>
      </AppPageShell>

      <AnimatePresence>
        {addEventModalOpen ? (
          <AddEventModalPanel
            onClose={() => setAddEventModalOpen(false)}
            onSubmit={handleSubmit}
            formData={formData}
            setFormData={setFormData}
            isSubmitting={isSubmitting}
            bannerInputRef={bannerInputRef}
            bannerPreview={bannerPreview}
            onBannerFile={(f) => {
                      setBannerFile(f);
                      setBannerPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return URL.createObjectURL(f);
                      });
            }}
          />
        ) : null}
        {eventDetailModal && (
          <EventDetailModalPanel event={eventDetailModal} onClose={() => setEventDetailModal(null)} />
        )}
      </AnimatePresence>

      {/* Modal de convidados */}
      <AnimatePresence>
        {selectedEventForGuests && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEventForGuests(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#1E242B] bg-[#13171D] shadow-2xl sm:max-w-lg sm:rounded-2xl"
            >
              {selectedEventForGuests.banner_url ? (
                <div className="relative h-28 w-full shrink-0 overflow-hidden sm:h-32">
                  <img
                    src={selectedEventForGuests.banner_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#13171D] via-[#13171D]/40 to-transparent" />
                    </div>
              ) : null}

              <div className="shrink-0 border-b border-[#1E242B] px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                      Lista de convidados
                    </p>
                    <h3 className="mt-1 truncate font-display text-lg font-bold text-[#F1F5F9]">
                      {selectedEventForGuests.titulo}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#94A3B8]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        {format(parseISO(selectedEventForGuests.data), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        {selectedEventForGuests.hora}
                      </span>
                      {selectedEventForGuests.descricao ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span className="max-w-[200px] truncate">{selectedEventForGuests.descricao}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEventForGuests(null)}
                    className="shrink-0 rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 no-scrollbar">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'Total', value: guests.length, tone: 'text-[#F1F5F9] border-[#1E242B] bg-[#12161A]' },
                    {
                      label: 'Confirmados',
                      value: guests.filter((g) => g.status === 'Confirmado' || g.status === 'Check-in').length,
                      tone: 'text-primary border-primary/25 bg-primary/10',
                    },
                    {
                      label: 'Não vão',
                      value: guests.filter((g) => g.status === 'Recusado').length,
                      tone: 'text-red-400 border-red-500/20 bg-red-500/10',
                    },
                    {
                      label: 'Pendentes',
                      value: guests.filter((g) => g.status === 'Pendente').length,
                      tone: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={cn('rounded-xl border px-3 py-3 text-center', stat.tone)}
                    >
                      <p className="text-xl font-bold tabular-nums">{stat.value}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">{stat.label}</p>
                  </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <input
                        type="text"
                        value={newGuestName}
                        onChange={(e) => setNewGuestName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addGuest()}
                        placeholder="Nome do convidado"
                        className={cn(appInputClass, 'pl-10')}
                      />
                    </div>
                    {hasPlanAccess(tenantData?.plan, 'whatsapp_invites', isGlobalAdmin) && (
                      <div className="relative flex-1">
                        <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                        <input
                          type="tel"
                          value={newGuestPhone}
                          onChange={(e) => setNewGuestPhone(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addGuest()}
                          placeholder="WhatsApp (ex: 11999999999)"
                          className={cn(
                            appInputClass,
                            'border-emerald-500/25 bg-emerald-500/5 pl-10 placeholder:text-emerald-500/40'
                          )}
                        />
                      </div>
                    )}
                    <AppPrimaryButton
                      type="button"
                      onClick={addGuest}
                      className="shrink-0 px-5 sm:self-stretch"
                    >
                      Adicionar
                    </AppPrimaryButton>
                  </div>
                  {hasPlanAccess(tenantData?.plan, 'whatsapp_invites', isGlobalAdmin) && (
                    <p className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                      Com WhatsApp preenchido, o convite Meta é enviado automaticamente.
                    </p>
                  )}
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar na lista…"
                    className={cn(appInputClass, 'pl-10')}
                  />
                </div>

                <div className="space-y-2">
                  {loadingGuests ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    </div>
                  ) : guests.filter((g) => g.nome.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
                    guests
                      .filter((g) => g.nome.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((guest) => {
                        const statusMeta = guestStatusMeta(guest.status);
                        return (
                          <div
                            key={guest.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-3 transition-colors hover:border-[#2F3643]"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={cn(
                                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                                  statusMeta.badge
                                )}
                              >
                                <User className="h-4 w-4" />
                          </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[#F1F5F9]">{guest.nome}</p>
                                <p className={cn('text-[10px] font-bold uppercase tracking-wider', statusMeta.color)}>
                                  {statusMeta.label}
                            </p>
                          </div>
                        </div>
                            {isAdmin ? (
                              <div className="flex shrink-0 items-center gap-1.5">
                              {guest.status !== 'Check-in' ? (
                                <button
                                    type="button"
                                  onClick={() => updateGuestStatus(guest.id, 'Check-in')}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white transition hover:bg-emerald-500"
                                >
                                  Check-in
                                </button>
                              ) : (
                                <button
                                    type="button"
                                  onClick={() => updateGuestStatus(guest.id, 'Confirmado')}
                                    className="rounded-lg border border-[#1E242B] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] transition hover:bg-white/5"
                                >
                                  Estornar
                                </button>
                              )}
                              <button
                                  type="button"
                                onClick={() => setItemToDelete({ id: guest.id, type: 'guest' })}
                                  className="rounded-lg p-2 text-[#64748B] transition hover:bg-red-500/10 hover:text-red-400"
                                  aria-label="Remover convidado"
                              >
                                  <X className="h-4 w-4" />
                              </button>
                        </div>
                            ) : null}
                      </div>
                        );
                      })
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#1E242B] py-12 text-center text-sm text-[#64748B]">
                      Nenhum convidado na lista.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setItemToDelete(null)}
              className="absolute inset-0 bg-background/[0.94] backdrop-blur-none"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 w-full space-y-5 rounded-3xl border border-white/10 bg-card px-6 py-8 text-center shadow-2xl sm:max-w-md"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <X className="h-8 w-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">Confirmar Exclusão</h3>
                <p className="text-sm font-medium text-[#94A3B8]">
                  {itemToDelete.type === 'event'
                    ? `Deseja realmente excluir o evento "${itemToDelete.title}"?`
                    : 'Deseja remover este convidado da lista?'}
                </p>
              </div>
              <div className="flex gap-3">
                <button disabled={isDeleting} onClick={() => setItemToDelete(null)}
                  className="flex-1 rounded-2xl py-3 font-black text-sm text-gray-400 transition-all hover:bg-white/5">
                  Cancelar
                </button>
                <button disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      if (itemToDelete.type === 'event') {
                        const response = await authFetch(`/api/events/${itemToDelete.id}`, {
                          method: 'DELETE',
                        });
                        if (response.ok) fetchEvents();
                      } else if (itemToDelete.type === 'guest') {
                        await removeGuest(itemToDelete.id);
                      }
                      setItemToDelete(null);
                    } catch (err) {
                      console.error('Error deleting item:', err);
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 font-black text-sm text-white shadow-lg shadow-red-500/20 transition-all hover:scale-105">
                  {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
