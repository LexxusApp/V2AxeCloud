import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, CalendarDays, Clock, Bell, Loader2, X, Check, Ticket, MessageSquare, ImagePlus, Pencil, Trash2, LayoutList, CalendarRange, Users, UserRoundX, RefreshCw, Share2, ArrowUpRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AppDemoCard,
  AppDemoPanelHeader,
} from '../components/ui/appDemoUi';
import { SkeletonBlock, CalendarEventRowSkeleton } from '../components/Skeleton';
import { readStaleCache, writeStaleCache } from '../lib/staleCache';
import { authFetch } from '../lib/authenticatedFetch';
import { consumeCalendarFocusEventId } from '../lib/calendarFocus';
import { excludeObrigacaoEvents } from '../lib/calendarEventFilters';
import { hasPlanAccess } from '../constants/plans';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../lib/modalMotion';
import { EventGiraOperationsPanel } from '../components/gira/EventGiraOperationsPanel';
import { EventConfirmedAvatars } from '../components/gira/EventConfirmedAvatars';
import { EventGuestsInline } from '../components/gira/EventGuestsInline';
import {
  fetchConfirmadosResumo as fetchConfirmadosResumoApi,
  fetchMinhasParticipacoes,
  respondParticipacao,
  type EventoConfirmadoResumo,
  type ParticipanteStatus,
} from '../lib/giraOperations';
import GiraRitualCommand from '../components/gira/GiraRitualCommand';
import BodyPortal from '../components/BodyPortal';
import FilhoGirasExperience from '../components/filho/FilhoGirasExperience';

const paperLabelClass =
  'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]';

const paperInputClass =
  'min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15';

export interface CalendarEvent {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  tipo: string;
  descricao: string;
  status_confirmacao: string;
  banner_url?: string | null;
  evento_publico?: boolean;
  vagas_maximas?: number | null;
  senhas_ativas?: boolean;
  senhas_maximas?: number | null;
  /** 1–7 = lembrete WhatsApp a cada N dias (+ dia da gira). null/undefined = off */
  wa_reminder_interval_days?: number | null;
}

const WA_REMINDER_INTERVAL_OPTIONS = [1, 2, 3, 5, 7] as const;

function formatWaReminderBadge(interval: number | null | undefined): string | null {
  const n = Math.floor(Number(interval));
  if (!Number.isFinite(n) || n < 1) return null;
  return n === 1 ? 'Lembrete diário' : `Lembrete a cada ${n} dias`;
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
    return { message: 'Gira marcada na agenda', type: 'success' };
  }
  switch (whatsapp.status) {
    case 'sent':
      return {
        message: `Gira marcada. Aviso enviado para ${whatsapp.sent} pessoa${whatsapp.sent === 1 ? '' : 's'} da corrente`,
        type: 'success',
      };
    case 'partial':
      return {
        message: `Gira marcada. Aviso parcial: ${whatsapp.sent} ok, ${whatsapp.errors} falha(s)`,
        type: 'info',
      };
    case 'no_recipients':
      return {
        message:
          'Gira marcada. Para avisar a corrente, cadastre WhatsApp nos filhos ativos — ou convide avulsos no evento.',
        type: 'info',
      };
    case 'channel_offline':
      return {
        message: 'Gira marcada. WhatsApp offline — o aviso não saiu agora.',
        type: 'info',
      };
    case 'disabled':
      return {
        message: 'Gira marcada. Avisos de gira estão desligados no WhatsApp.',
        type: 'info',
      };
    case 'failed':
      return {
        message: `Gira marcada, mas o WhatsApp falhou (${whatsapp.errors} erro${whatsapp.errors === 1 ? '' : 's'})`,
        type: 'error',
      };
    default:
      return { message: 'Gira marcada na agenda', type: 'success' };
  }
}

function formatAvisoWhatsAppFeedback(whatsapp?: EventWhatsAppFeedback): {
  message: string;
  type: 'success' | 'info' | 'error';
} {
  if (!whatsapp) {
    return { message: 'Aviso enviado.', type: 'success' };
  }
  switch (whatsapp.status) {
    case 'sent':
      return {
        message: `WhatsApp enviado para ${whatsapp.sent} filho${whatsapp.sent === 1 ? '' : 's'}.`,
        type: 'success',
      };
    case 'partial':
      return {
        message: `WhatsApp: ${whatsapp.sent} enviado(s), ${whatsapp.errors} falha(s).`,
        type: 'info',
      };
    case 'no_recipients':
      return {
        message:
          'Nenhum aviso enviado: não há filhos ativos com WhatsApp na corrente. Cadastre a corrente ou use convite avulso no evento.',
        type: 'info',
      };
    case 'channel_offline':
      return {
        message: 'Canal WhatsApp offline — avisos não enviados.',
        type: 'error',
      };
    case 'disabled':
      return {
        message: 'Avisos de gira desativados nas configurações do WhatsApp.',
        type: 'info',
      };
    case 'failed':
      return {
        message: `Falha no envio WhatsApp (${whatsapp.errors} erro${whatsapp.errors === 1 ? '' : 's'}).`,
        type: 'error',
      };
    default:
      return { message: 'Aviso enviado.', type: 'success' };
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

function horaToInput(hora?: string | null): string {
  return formatHoraEvento(hora) || '20:00';
}

function EventDetailModalPanel({
  event,
  onClose,
  onEdit,
}: {
  event: Event;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const hasBanner = Boolean(event.banner_url?.trim());
  const descricao = (event.descricao || '').trim();
  const horaFmt = formatHoraEvento(event.hora);

  const detailsBlock = (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-4">
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-4">
        <div className="flex items-center gap-2 text-[#171A16]">
          <CalendarIcon className="h-4 w-4 shrink-0 text-[#8F7724]" />
          <span className="font-bold">
            {format(parseISO(event.data), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })}
          </span>
        </div>
        {horaFmt ? (
          <div className="flex items-center gap-2 text-[#171A16]">
            <Clock className="h-4 w-4 shrink-0 text-[#8F7724]" />
            <span className="font-bold">{horaFmt}</span>
          </div>
        ) : null}
      </div>
      {descricao ? (
        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#6F675C]">Descrição</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#171A16]">{descricao}</p>
        </div>
      ) : null}
      {formatWaReminderBadge(event.wa_reminder_interval_days) ? (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#3F7258]/30 bg-[#3F7258]/10 px-2.5 py-1 text-[10px] font-bold text-[#3F7258]">
          <Bell className="h-3 w-3" aria-hidden />
          {formatWaReminderBadge(event.wa_reminder_interval_days)}
        </p>
      ) : null}
    </div>
  );

  return (
    <BodyPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[101] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4"
        onClick={onClose}
        role="presentation"
      >
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
              'relative my-auto flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl',
              hasBanner ? 'max-w-[min(96vw,52rem)]' : 'max-w-sm',
            )}
          >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#DED8CB] px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F1E8D2]">
                <CalendarIcon className="h-5 w-5 text-[#8F7724]" />
              </div>
              <div className="min-w-0">
                <h3 id="event-detail-title" className="truncate font-display text-base font-black text-[#171A16] sm:text-lg">
                  {event.titulo}
                </h3>
                <p className="truncate text-[9px] font-black uppercase tracking-[.22em] text-[#8F7724]">{event.tipo}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8D2C4] bg-white px-3 py-2 text-xs font-bold text-[#4A463E] transition-colors hover:bg-[#F5F0E5]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Editar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition-colors hover:bg-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {hasBanner ? (
              <div className="flex min-h-0 flex-col sm:flex-row sm:items-stretch">
                <div className="flex shrink-0 items-center justify-center border-b border-[#E3DCCE] bg-[#141C17] p-3 sm:w-[min(44%,18rem)] sm:border-b-0 sm:border-r sm:p-4">
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
                <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-[#F1E8D2] to-transparent">
                  <CalendarIcon className="h-12 w-12 text-[#8F7724]/40" />
                </div>
                <div className="px-5 py-5 sm:px-6">{detailsBlock}</div>
              </>
            )}
          </div>
          </motion.div>
      </div>
    </BodyPortal>
  );
}

type Event = CalendarEvent;

function AdminEventDrawer({
  event,
  confirmed,
  onClose,
  onEdit,
  onNotify,
  onOperations,
}: {
  event: Event;
  confirmed: EventoConfirmadoResumo[];
  onClose: () => void;
  onEdit: () => void;
  onNotify: () => void;
  onOperations: () => void;
}) {
  const passed = new Date(`${event.data}T${formatHoraEvento(event.hora) || '00:00'}`).getTime() < Date.now();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <BodyPortal>
      <motion.button type="button" aria-label="Fechar detalhes da gira" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={MODAL_TW}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-event-title"
        className="fixed right-3 top-20 z-[101] flex max-h-[calc(100dvh-6rem)] w-[calc(100%-1.5rem)] max-w-sm flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl sm:right-5"
      >
        <div className={cn('relative shrink-0 overflow-hidden bg-[#141C17]', event.banner_url ? 'h-36' : 'h-24')}>
          {event.banner_url ? <img src={event.banner_url} alt="" className="h-full w-full object-cover" /> : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-[#F1E8D2] to-transparent"><CalendarDays className="h-10 w-10 text-[#8F7724]/40" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#F9F6EE] via-transparent to-black/25" />
          <button type="button" onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-[#DCD6CA] bg-white/70 text-[#171A16] backdrop-blur hover:bg-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
          <span className={cn('absolute bottom-3 left-4 rounded-full px-2.5 py-1 text-[10px] font-black', passed ? 'bg-[#E3DCCE] text-[#4A463E]' : 'bg-[#17251D] text-[#FFFAF0]')}>{passed ? 'Concluído' : event.tipo || 'Gira'}</span>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#8F7724]">{event.tipo || 'Evento da casa'}</p>
          <h2 id="admin-event-title" className="mt-1 font-display text-xl font-black text-[#171A16]">{event.titulo}</h2>
          {formatWaReminderBadge(event.wa_reminder_interval_days) ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#3F7258]/30 bg-[#3F7258]/10 px-2.5 py-1 text-[10px] font-bold text-[#3F7258]">
              <Bell className="h-3 w-3" aria-hidden />
              {formatWaReminderBadge(event.wa_reminder_interval_days)}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#E3DCCE] bg-white px-3 py-2.5"><p className="text-[10px] font-bold text-[#6F675C]">Data</p><p className="mt-0.5 text-sm font-black">{format(parseISO(event.data), 'dd/MM/yyyy', { locale: ptBR })}</p></div>
            <div className="rounded-xl border border-[#E3DCCE] bg-white px-3 py-2.5"><p className="text-[10px] font-bold text-[#6F675C]">Horário</p><p className="mt-0.5 text-sm font-black">{formatHoraEvento(event.hora) || 'Não informado'}</p></div>
          </div>
          {event.descricao ? <div className="mt-3 rounded-xl border border-[#E3DCCE] bg-white p-3"><p className="text-[10px] font-bold text-[#6F675C]">Informações</p><p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-xs font-medium leading-relaxed text-[#171A16]">{event.descricao}</p></div> : null}

          <div className="mt-3 rounded-xl border border-[#3F7258]/25 bg-[#3F7258]/[0.06] p-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-black">{confirmed.length} confirmado{confirmed.length === 1 ? '' : 's'}</p><p className="text-xs font-semibold text-[#6F675C]">Filhos e convidados externos</p></div>
              <Users className="h-4 w-4 text-[#3F7258]" />
            </div>
            {confirmed.length ? <div className="mt-2"><EventConfirmedAvatars members={confirmed} /></div> : null}
          </div>

          <button type="button" onClick={onOperations} className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#E3D9BC] bg-[#F1E8D2] px-3 py-2.5 text-left hover:bg-[#EDE2C4]">
            <span><span className="block text-sm font-black text-[#8F7724]">Convites, QR Code e presença</span><span className="block text-xs font-semibold text-[#6F675C]">Gerenciar a operação completa da gira</span></span>
            <ArrowUpRight className="h-4 w-4 text-[#8F7724]" />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#DED8CB] p-3">
          {!passed ? <button type="button" onClick={onNotify} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#3F7258]/30 bg-[#3F7258]/10 text-xs font-bold text-[#3F7258]"><Bell className="h-3.5 w-3.5" />Lembrar</button> : null}
          <button type="button" onClick={onEdit} className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#17251D] px-3 text-xs font-black text-[#FFFAF0] hover:bg-[#20342A]', passed && 'col-span-2')}><Pencil className="h-3.5 w-3.5" />Editar gira</button>
        </div>
      </motion.aside>
    </BodyPortal>
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
  vagas_maximas: string;
  senhas_ativas: boolean;
  senhas_maximas: string;
  wa_reminder_enabled: boolean;
  wa_reminder_interval_days: string;
};

type AddEventModalPanelProps = {
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  isSubmitting: boolean;
  bannerInputRef: React.RefObject<HTMLInputElement | null>;
  bannerPreview: string | null;
  onBannerFile: (file: File) => void;
  onRemoveBanner?: () => void;
  hasExistingBanner?: boolean;
};

function AddEventModalPanel({
  mode,
  onClose,
  onSubmit,
  formData,
  setFormData,
  isSubmitting,
  bannerInputRef,
  bannerPreview,
  onBannerFile,
  onRemoveBanner,
  hasExistingBanner,
}: AddEventModalPanelProps) {
  return (
    <BodyPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={MODAL_TW}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
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
        className="relative z-[101] my-auto flex w-full max-h-[88dvh] max-w-3xl flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#DED8CB] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F1E8D2]">
              <CalendarDays className="h-5 w-5 text-[#8F7724]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 id="add-event-title" className="font-display text-base font-black text-[#171A16] sm:text-lg">
                {mode === 'edit' ? 'Editar gira / evento' : 'Nova gira / evento'}
              </h3>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#8F7724]">
                {mode === 'edit' ? 'Atualizar dados no calendário' : 'Agendar no calendário do terreiro'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition-colors hover:bg-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto overscroll-y-contain p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
            <div className="sm:col-span-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8F7724]">1. Informações da gira</p>
              <p className="mt-1 text-xs font-semibold text-[#6F675C]">Nome, tipo e destaque do evento.</p>
            </div>
            <div className="sm:col-span-2">
              <label className={paperLabelClass}>Nome</label>
              <input
                required
                className={paperInputClass}
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Gira Caboclos Penacho"
              />
            </div>
            <div>
              <label className={paperLabelClass}>Tipo de trabalho</label>
              <select
                required
                className={paperInputClass}
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              >
                <option value="Gira">Normal</option>
                <option value="Festa">Festa pública</option>
                <option value="Manutenção">Caridade</option>
                <option value="Reunião">Reunião</option>
              </select>
            </div>
            <div>
              <label className={paperLabelClass}>Destaque</label>
              <select
                className={paperInputClass}
                value={formData.status_confirmacao}
                onChange={(e) => setFormData({ ...formData, status_confirmacao: e.target.value })}
              >
                <option value="Confirmado">Confirmada</option>
                <option value="Especial">Especial / obrigação</option>
              </select>
            </div>
            <div className="mt-2 border-t border-[#E3DCCE] pt-4 sm:col-span-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8F7724]">2. Data e detalhes</p>
              <p className="mt-1 text-xs font-semibold text-[#6F675C]">Defina quando acontecerá e inclua as orientações.</p>
            </div>
            <div>
              <label className={paperLabelClass}>Data</label>
              <input
                required
                type="date"
                className={paperInputClass}
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              />
            </div>
            <div>
              <label className={paperLabelClass}>Horário</label>
              <input
                required
                type="time"
                className={paperInputClass}
                value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={paperLabelClass}>Descrição (opcional)</label>
              <textarea
                rows={2}
                className={cn(paperInputClass, 'resize-none')}
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes do evento…"
              />
            </div>
            <div className="mt-2 border-t border-[#E3DCCE] pt-4 sm:col-span-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8F7724]">3. Convites e publicação</p>
              <p className="mt-1 text-xs font-semibold text-[#6F675C]">Configure divulgação, vagas, senhas e imagem.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E3DCCE] bg-[#F1ECE0] px-3 py-2.5 sm:col-span-2">
              <input
                type="checkbox"
                checked={formData.evento_publico}
                onChange={(e) => setFormData({ ...formData, evento_publico: e.target.checked })}
                className="h-4 w-4 accent-[#8F7724]"
              />
              <span className="text-xs font-semibold text-[#6F675C]">
                Divulgar no portal público (/eventos)
              </span>
            </label>
            <div>
              <label className={paperLabelClass}>Vagas máximas (opcional)</label>
              <input
                type="number"
                min={0}
                className={paperInputClass}
                placeholder="Sem limite"
                value={formData.vagas_maximas}
                onChange={(e) => setFormData({ ...formData, vagas_maximas: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={formData.senhas_ativas}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    senhas_ativas: e.target.checked,
                    ...(e.target.checked ? { evento_publico: true } : {}),
                  })
                }
                className="h-4 w-4 accent-[#8F7724]"
              />
              <span className="text-xs text-[#6F675C]">Senhas online para visitantes</span>
            </label>
            {formData.senhas_ativas ? (
              <div>
                <label className={paperLabelClass}>Senhas disponíveis (visitantes)</label>
                <input
                  type="number"
                  min={1}
                  className={paperInputClass}
                  placeholder="Ex: 50"
                  value={formData.senhas_maximas}
                  onChange={(e) => setFormData({ ...formData, senhas_maximas: e.target.value })}
                />
              </div>
            ) : null}
            <div className="rounded-xl border border-[#E3DCCE] bg-[#F1ECE0] p-3 sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={formData.wa_reminder_enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      wa_reminder_enabled: e.target.checked,
                      wa_reminder_interval_days: e.target.checked
                        ? formData.wa_reminder_interval_days || '2'
                        : formData.wa_reminder_interval_days,
                    })
                  }
                  className="mt-0.5 h-4 w-4 accent-[#8F7724]"
                />
                <span>
                  <span className="block text-xs font-bold text-[#171A16]">Lembrete WhatsApp automático</span>
                  <span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-[#6F675C]">
                    Envia aviso à corrente a cada X dias e também no dia da gira. O aviso na criação continua
                    imediato.
                  </span>
                </span>
              </label>
              {formData.wa_reminder_enabled ? (
                <div className="mt-3">
                  <label className={paperLabelClass}>Intervalo</label>
                  <select
                    className={paperInputClass}
                    value={formData.wa_reminder_interval_days}
                    onChange={(e) =>
                      setFormData({ ...formData, wa_reminder_interval_days: e.target.value })
                    }
                  >
                    {WA_REMINDER_INTERVAL_OPTIONS.map((n) => (
                      <option key={n} value={String(n)}>
                        {n === 1 ? 'Todo dia' : `A cada ${n} dias`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-[#E3DCCE] bg-[#F1ECE0] p-3 sm:col-span-2">
              <label className={paperLabelClass}>Banner (opcional)</label>
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
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#6F675C] hover:text-[#171A16]"
                >
                  <ImagePlus className="h-3.5 w-3.5 text-[#8F7724]" />
                  {bannerPreview ? 'Trocar imagem' : 'Adicionar imagem'}
                </button>
                {bannerPreview && onRemoveBanner ? (
                  <button
                    type="button"
                    onClick={onRemoveBanner}
                    className="text-xs font-bold text-[#B04A32] hover:text-[#9C3F2A]"
                  >
                    Remover banner
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#17251D] px-4 py-2.5 text-sm font-black text-[#FFFAF0] shadow-sm transition hover:bg-[#20342A] disabled:opacity-50 sm:mt-6"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === 'edit' ? (
              'Salvar alterações'
            ) : (
              'Marcar na agenda'
            )}
          </button>
        </form>
      </motion.div>
    </div>
    </BodyPortal>
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
  const [eventsFetchError, setEventsFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEventForOps, setSelectedEventForOps] = useState<Event | null>(null);
  const [participacoes, setParticipacoes] = useState<
    Record<string, { status: ParticipanteStatus; id: string }>
  >({});
  const [partBusy, setPartBusy] = useState<string | null>(null);
  const [confirmadosByEvent, setConfirmadosByEvent] = useState<Record<string, EventoConfirmadoResumo[]>>({});

  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'event'; title?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNotifying, setIsNotifying] = useState<string | null>(null);
  const [notifyChannelEvent, setNotifyChannelEvent] = useState<Event | null>(null);
  const [notifyChannel, setNotifyChannel] = useState<'push' | 'whatsapp' | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [eventDetailModal, setEventDetailModal] = useState<Event | null>(null);
  const [addEventModalOpen, setAddEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [removeBannerOnSave, setRemoveBannerOnSave] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [adminView, setAdminView] = useState<'agenda' | 'calendar'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 880 ? 'agenda' : 'calendar',
  );
  const [totalActiveChildren, setTotalActiveChildren] = useState(0);

  const hasAccess = hasPlanAccess(tenantData?.plan, 'gestao_eventos', tenantData?.is_admin_global);
  const effectiveTenantId = tenantData?.tenant_id || (!isFilho ? user?.id : undefined);

  useEffect(() => {
    if (isFilho || !effectiveTenantId || !user?.id) return;
    authFetch(`/api/children?userId=${encodeURIComponent(user.id)}&tenantId=${encodeURIComponent(effectiveTenantId)}`)
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((payload) => {
        const active = (payload.data || []).filter((child: any) => {
          const status = String(child?.status || 'Ativo').toLowerCase();
          return status === 'ativo' || status === 'active';
        });
        setTotalActiveChildren(active.length);
      })
      .catch(() => setTotalActiveChildren(0));
  }, [effectiveTenantId, isFilho, user?.id]);

  const closeNotifyChannelModal = () => {
    if (isNotifying) return;
    setNotifyChannelEvent(null);
    setNotifyChannel(null);
  };

  const handleNotifyPush = async (event: Event) => {
    try {
      setIsNotifying(event.id);
      setNotifyChannel('push');
      const response = await authFetch('/api/push-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: effectiveTenantId,
          title: `🗓️ Novo Evento: ${event.titulo}`,
          body: `Marcado para ${new Date(event.data).toLocaleDateString('pt-BR')} às ${event.hora}. Contamos com sua presença!`,
          url: '/calendar',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha ao enviar push');
      setToast({
        message: `Push enviado para ${data.sentCount ?? 0} dispositivo${data.sentCount === 1 ? '' : 's'}.`,
        type: 'success',
      });
      setNotifyChannelEvent(null);
      setNotifyChannel(null);
    } catch (error: any) {
      console.error('Error notifying push:', error);
      setToast({
        message: error?.message || 'Erro ao enviar notificação push.',
        type: 'error',
      });
    } finally {
      setIsNotifying(null);
      setNotifyChannel(null);
    }
  };

  const handleNotifyWhatsApp = async (event: Event) => {
    try {
      setIsNotifying(event.id);
      setNotifyChannel('whatsapp');
      const response = await authFetch(`/api/events/${event.id}/notify-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha ao enviar WhatsApp');
      setToast(formatAvisoWhatsAppFeedback(data.whatsapp as EventWhatsAppFeedback | undefined));
      setNotifyChannelEvent(null);
      setNotifyChannel(null);
    } catch (error: any) {
      console.error('Error notifying whatsapp:', error);
      setToast({
        message: error?.message || 'Erro ao enviar aviso no WhatsApp.',
        type: 'error',
      });
    } finally {
      setIsNotifying(null);
      setNotifyChannel(null);
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
    vagas_maximas: '',
    senhas_ativas: false,
    senhas_maximas: '',
    wa_reminder_enabled: false,
    wa_reminder_interval_days: '2',
  });

  const resetEventForm = () => {
    setFormData({
      titulo: '',
      data: format(new Date(), 'yyyy-MM-dd'),
      hora: '20:00',
      tipo: 'Gira',
      descricao: '',
      status_confirmacao: 'Confirmado',
      evento_publico: false,
      vagas_maximas: '',
      senhas_ativas: false,
      senhas_maximas: '',
      wa_reminder_enabled: false,
      wa_reminder_interval_days: '2',
    });
    setBannerFile(null);
    setRemoveBannerOnSave(false);
    setBannerPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setEditingEvent(null);
  };

  const openCreateEventModal = () => {
    resetEventForm();
    setAddEventModalOpen(true);
  };

  const openEditEventModal = (event: Event) => {
    setEditingEvent(event);
    const reminderInterval = Math.floor(Number(event.wa_reminder_interval_days));
    const reminderOn = Number.isFinite(reminderInterval) && reminderInterval >= 1;
    setFormData({
      titulo: event.titulo,
      data: event.data,
      hora: horaToInput(event.hora),
      tipo: event.tipo || 'Gira',
      descricao: event.descricao || '',
      status_confirmacao: event.status_confirmacao || 'Confirmado',
      evento_publico: Boolean(event.evento_publico),
      vagas_maximas:
        event.vagas_maximas != null && event.vagas_maximas > 0 ? String(event.vagas_maximas) : '',
      senhas_ativas: Boolean(event.senhas_ativas),
      senhas_maximas:
        event.senhas_maximas != null && event.senhas_maximas > 0 ? String(event.senhas_maximas) : '',
      wa_reminder_enabled: reminderOn,
      wa_reminder_interval_days: reminderOn ? String(reminderInterval) : '2',
    });
    setBannerFile(null);
    setRemoveBannerOnSave(false);
    setBannerPreview(event.banner_url?.trim() || null);
    setEventDetailModal(null);
    setAddEventModalOpen(true);
  };

  const closeEventFormModal = () => {
    setAddEventModalOpen(false);
    resetEventForm();
  };

  useEffect(() => {
    if (!effectiveTenantId) {
      setLoading(true);
      return;
    }
    void fetchEvents();
  }, isFilho ? [currentMonth, effectiveTenantId, isFilho] : [effectiveTenantId, isFilho]);

  useEffect(() => {
    if (!eventsFetchError || !effectiveTenantId) return;
    const retryIfReady = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void fetchEvents();
      }
    };
    document.addEventListener('visibilitychange', retryIfReady);
    window.addEventListener('online', retryIfReady);
    return () => {
      document.removeEventListener('visibilitychange', retryIfReady);
      window.removeEventListener('online', retryIfReady);
    };
  }, [eventsFetchError, effectiveTenantId]);

  useEffect(() => {
    if (!isFilho || !effectiveTenantId) return;
    const monthStart = startOfMonth(currentMonth);
    const rangeEnd = addDays(endOfMonth(currentMonth), 7);
    void fetchMinhasParticipacoes(
      effectiveTenantId,
      format(monthStart, 'yyyy-MM-dd'),
      format(rangeEnd, 'yyyy-MM-dd'),
    )
      .then((rows) => {
        const map: Record<string, { status: ParticipanteStatus; id: string }> = {};
        for (const r of rows) {
          map[r.event_id] = { status: r.status, id: r.id };
        }
        setParticipacoes(map);
      })
      .catch(() => setParticipacoes({}));
  }, [isFilho, effectiveTenantId, currentMonth, events.length]);

  async function handleFilhoParticipacao(eventId: string, action: 'confirmar' | 'declinar') {
    if (!effectiveTenantId) return;
    setPartBusy(eventId);
    try {
      await respondParticipacao(eventId, effectiveTenantId, action);
      const monthStart = startOfMonth(currentMonth);
      const rangeEnd = addDays(endOfMonth(currentMonth), 7);
      const rows = await fetchMinhasParticipacoes(
        effectiveTenantId,
        format(monthStart, 'yyyy-MM-dd'),
        format(rangeEnd, 'yyyy-MM-dd'),
      );
      const map: Record<string, { status: ParticipanteStatus; id: string }> = {};
      for (const r of rows) map[r.event_id] = { status: r.status, id: r.id };
      setParticipacoes(map);
      setToast({
        type: 'success',
        message: action === 'confirmar' ? 'Participação confirmada!' : 'Resposta registrada.',
      });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setPartBusy(null);
    }
  }

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

  async function loadConfirmadosResumo() {
    if (!effectiveTenantId || isFilho) return;
    try {
      const data = await fetchConfirmadosResumoApi(effectiveTenantId);
      setConfirmadosByEvent(data || {});
    } catch {
      /* badge opcional — falha silenciosa */
    }
  }

  async function fetchEvents() {
    if (!effectiveTenantId) return;

    // Gestor: traz todos os eventos do terreiro (gestão e “próximo evento” não dependem do mês visível)
    if (!isFilho) {
      const cacheKey = `cal_events_all_${effectiveTenantId}`;
      const cached = readStaleCache<Event[]>(cacheKey);
      if (cached != null) {
        setEvents(excludeObrigacaoEvents(cached));
        setLoading(false);
        void loadConfirmadosResumo();
      } else {
        setLoading(true);
      }
      try {
        const url = `/api/events?tenantId=${encodeURIComponent(effectiveTenantId)}&scope=calendar`;
        const response = await authFetch(url);
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`Failed to fetch events (${response.status}): ${body}`);
        }
        const { data } = (await response.json()) as { data?: Event[] };
        const list = excludeObrigacaoEvents(data || []);
        setEvents(list);
        setEventsFetchError(null);
        writeStaleCache(cacheKey, list);
        void loadConfirmadosResumo();
      } catch (error) {
        console.error('Error fetching events:', error);
        if (cached == null) setEvents([]);
        setEventsFetchError('Não foi possível carregar as giras. O servidor pode estar atualizando — tente novamente.');
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
      setEvents(excludeObrigacaoEvents(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const url = `/api/events?tenantId=${encodeURIComponent(effectiveTenantId)}&start=${format(monthStart, 'yyyy-MM-dd')}&end=${format(rangeEnd, 'yyyy-MM-dd')}&scope=calendar`;
      const response = await authFetch(url);
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Failed to fetch events (${response.status}): ${body}`);
      }
      const { data } = (await response.json()) as { data?: Event[] };
      const list = excludeObrigacaoEvents(data || []);
      setEvents(list);
      setEventsFetchError(null);
      writeStaleCache(cacheKey, list);
    } catch (error) {
      console.error('Error fetching events:', error);
      if (cached == null) setEvents([]);
      setEventsFetchError('Não foi possível carregar as giras. O servidor pode estar atualizando — tente novamente.');
    } finally {
      setLoading(false);
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

      const {
        wa_reminder_enabled,
        wa_reminder_interval_days: reminderIntervalRaw,
        ...formFields
      } = formData;
      const payload = {
        ...formFields,
        wa_reminder_interval_days: wa_reminder_enabled
          ? Number(reminderIntervalRaw) || 2
          : null,
        ...(banner_url ? { banner_url } : {}),
        ...(editingEvent && removeBannerOnSave && !banner_url ? { remove_banner: true } : {}),
        lider_id: user?.id,
        tenant_id: effectiveTenantId || user?.id,
      };

      const response = editingEvent
        ? await authFetch(`/api/events/${editingEvent.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await authFetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || (editingEvent ? 'Failed to update event' : 'Failed to create event'));
      }

      const result = await response.json();
      if (editingEvent) {
        const { showHouseToast } = await import('../lib/houseToast');
        showHouseToast('Gira atualizada na agenda');
      } else {
        const feedback = formatGiraWhatsAppFeedback(result.whatsapp as EventWhatsAppFeedback | undefined);
        const { showHouseToast } = await import('../lib/houseToast');
        showHouseToast(feedback.message, feedback.type);
      }

      closeEventFormModal();
      fetchEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      alert(error.message || (editingEvent ? 'Erro ao atualizar evento.' : 'Erro ao criar evento.'));
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
      case 'Festa': return 'bg-violet-400';
      case 'Obrigação': return 'bg-amber-500';
      case 'Gira': return 'bg-sky-400';
      case 'Manutenção':
      case 'Reunião': return 'bg-zinc-400';
      default: return 'bg-primary';
    }
  };

  const getEventStyles = (type: string) => {
    switch (type) {
      case 'Festa': return 'bg-violet-500/10 text-violet-300 border-violet-500/20';
      case 'Obrigação': return 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]';
      case 'Gira': return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
      case 'Manutenção':
      case 'Reunião': return 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20';
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
  const adminAgendaEvents = useMemo(() => {
    const now = Date.now();
    const future = eventsSorted.filter((event) => parseEventDateTime(event).getTime() >= now);
    const past = eventsSorted.filter((event) => parseEventDateTime(event).getTime() < now).reverse();
    return [...future, ...past];
  }, [eventsSorted]);
  const eventsThisMonth = events.filter((event) => isSameMonth(parseISO(event.data), new Date()));
  const nextConfirmedCount = nextUpcomingEvent ? (confirmadosByEvent[nextUpcomingEvent.id] ?? []).length : 0;
  const nextUnconfirmedCount = nextUpcomingEvent ? Math.max(0, totalActiveChildren - nextConfirmedCount) : 0;

  if (loading && events.length === 0) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  // Layout exclusivo para filhos de santo: calendário compacto + lista de eventos abaixo
  const filhoGirasExperience = true;
  if (isFilho && filhoGirasExperience) {
    return (
      <AppPageShell fullWidth>
        <CalendarToast toast={toast} />
        <FilhoGirasExperience
          events={events}
          currentMonth={currentMonth}
          loading={loading}
          error={eventsFetchError}
          participations={participacoes}
          busyEventId={partBusy}
          onPreviousMonth={prevMonth}
          onNextMonth={nextMonth}
          onRefresh={() => void fetchEvents()}
          onOpenEvent={setEventDetailModal}
          onRespond={(eventId, action) => void handleFilhoParticipacao(eventId, action)}
        />
        <AnimatePresence>
          {eventDetailModal && (
            <EventDetailModalPanel event={eventDetailModal} onClose={() => setEventDetailModal(null)} />
          )}
        </AnimatePresence>
      </AppPageShell>
    );
  }

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

        {eventsFetchError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            <p>{eventsFetchError}</p>
            <button
              type="button"
              onClick={() => void fetchEvents()}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

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
                    const part = participacoes[event.id];
                    const partStatus = part?.status;
                    return (
                      <div key={event.id} className="space-y-2">
                      <button
                        type="button"
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
                      {!passed ? (
                        <div className="flex flex-wrap gap-2 px-1">
                          {partStatus === 'confirmado' ? (
                            <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400">
                              Confirmado
                            </span>
                          ) : partStatus === 'recusado' ? (
                            <span className="rounded-lg bg-red-500/15 px-2 py-1 text-[10px] font-bold text-red-400">
                              Não vou
                            </span>
                          ) : (
                            <div className="flex gap-2 px-1">
                              <button
                                type="button"
                                disabled={partBusy === event.id}
                                onClick={() => void handleFilhoParticipacao(event.id, 'confirmar')}
                                aria-label="Confirmar presença"
                                title="Confirmar presença"
                                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/15 text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                {partBusy === event.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={partBusy === event.id}
                                onClick={() => void handleFilhoParticipacao(event.id, 'declinar')}
                                aria-label="Não vou"
                                title="Não vou"
                                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-red-500/35 bg-red-500/15 text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
                      </div>
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
        <div className="calendar-v5-page">
        <GiraRitualCommand
          events={events}
          agendaEvents={adminAgendaEvents}
          nextEvent={nextUpcomingEvent}
          eventsThisMonth={eventsThisMonth}
          calendarDays={calendarDays}
          currentMonth={currentMonth}
          monthStart={monthStart}
          view={adminView}
          nextConfirmedCount={nextConfirmedCount}
          nextUnconfirmedCount={nextUnconfirmedCount}
          confirmationsByEvent={confirmadosByEvent}
          loading={loading}
          isNotifying={isNotifying}
          hasAccess={hasAccess}
          fetchError={eventsFetchError}
          tenantId={effectiveTenantId}
          onNavigate={setActiveTab}
          onViewChange={setAdminView}
          onCreate={openCreateEventModal}
          onRefresh={() => void fetchEvents()}
          onShare={() => {
            const url = `${window.location.origin}/eventos`;
            void navigator.clipboard?.writeText(url);
            setToast({ type: 'success', message: 'Link do calendário público copiado.' });
          }}
          onOpen={setEventDetailModal}
          onNotify={setNotifyChannelEvent}
          onEdit={openEditEventModal}
          onOperations={setSelectedEventForOps}
          onDelete={(event) => setItemToDelete({ id: event.id, type: 'event', title: event.titulo })}
          onPreviousMonth={prevMonth}
          onNextMonth={nextMonth}
          onToday={() => setCurrentMonth(new Date())}
        />

        <div className="hidden" aria-hidden="true">
        <AppDemoPanelHeader
          title="Giras e eventos"
          description={`${eventsThisMonth.length} ${eventsThisMonth.length === 1 ? 'evento programado' : 'eventos programados'} neste mês.`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchEvents()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#252C35] bg-[#151A21] px-3 text-sm font-bold text-[#CBD5E1]"
                title="Atualizar"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/eventos`;
                  void navigator.clipboard?.writeText(url);
                  setToast({ type: 'success', message: 'Link do calendário público copiado.' });
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#252C35] bg-[#151A21] px-3 text-sm font-bold text-[#CBD5E1]"
              >
                <Share2 className="h-4 w-4 text-sky-300" />
                <span className="hidden sm:inline">Compartilhar</span>
              </button>
              <button type="button" onClick={() => openCreateEventModal()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-[#17130D] hover:bg-[#FFD34E]">
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Criar gira
              </button>
            </div>
          }
        />

        <section className="app-metric-rail mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo das giras">
          {[
            { label: 'Próxima gira', value: nextUpcomingEvent ? format(parseISO(nextUpcomingEvent.data), 'dd/MM') : '—', detail: nextUpcomingEvent?.titulo || 'nenhuma agendada', icon: CalendarDays, color: 'text-sky-300', bg: 'border-sky-400/20 bg-sky-400/10' },
            { label: 'Eventos no mês', value: String(eventsThisMonth.length), detail: format(new Date(), 'MMMM', { locale: ptBR }), icon: CalendarRange, color: 'text-violet-300', bg: 'border-violet-400/20 bg-violet-400/10' },
            { label: 'Confirmações', value: String(nextConfirmedCount), detail: nextUpcomingEvent ? 'na próxima gira' : 'aguardando agenda', icon: Users, color: 'text-emerald-300', bg: 'border-emerald-400/20 bg-emerald-400/10' },
            { label: 'Sem confirmar', value: String(nextUnconfirmedCount), detail: nextUpcomingEvent ? 'pessoas da corrente' : 'aguardando agenda', icon: UserRoundX, color: 'text-amber-300', bg: 'border-amber-400/20 bg-amber-400/10' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-[#252C35] bg-[#11151A] p-4 text-[#F8FAFC]">
                <div className={cn('grid h-9 w-9 place-items-center rounded-xl border', item.bg)}><Icon className={cn('h-4 w-4', item.color)} /></div>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.1em] text-[#8E9AAA]">{item.label}</p>
                <p className="mt-1 text-xl font-black">{item.value}</p>
                <p className="mt-1 truncate text-xs font-semibold text-[#64748B]">{item.detail}</p>
              </div>
            );
          })}
        </section>

        <div className="mb-4 flex w-fit rounded-xl border border-[#252C35] bg-[#11151A] p-1">
          <button type="button" onClick={() => setAdminView('agenda')} className={cn('inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold', adminView === 'agenda' ? 'bg-primary text-[#17130D]' : 'text-[#94A3B8] hover:text-white')}><LayoutList className="h-4 w-4" />Agenda</button>
          <button type="button" onClick={() => setAdminView('calendar')} className={cn('inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold', adminView === 'calendar' ? 'bg-primary text-[#17130D]' : 'text-[#94A3B8] hover:text-white')}><CalendarRange className="h-4 w-4" />Calendário</button>
        </div>

        <div className="space-y-3">
          {eventsFetchError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
              <p>{eventsFetchError}</p>
              <button
                type="button"
                onClick={() => void fetchEvents()}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200"
              >
                Tentar novamente
              </button>
            </div>
          ) : null}
          {adminView === 'agenda' ? (
            <>
          <div className="app-agenda-stream space-y-3">
              {adminAgendaEvents.map((event) => {
                const passed = isEventPassed(event.data, event.hora);
                const isEspecial =
                  event.status_confirmacao === 'Especial' || event.tipo === 'Obrigação';
                return (
                  <article
                    key={event.id}
                    className={cn(
                      'group flex w-full flex-col overflow-hidden rounded-2xl border border-[#252C35] bg-[#11151A] transition-all hover:border-primary/25 hover:shadow-lg lg:flex-row',
                      passed && 'opacity-70',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setEventDetailModal(event)}
                      className="relative w-full min-w-0 flex-1 cursor-pointer text-left sm:grid sm:grid-cols-[9rem_1fr]"
                    >
                    <div className="relative h-32 w-full overflow-hidden bg-[#0d0d0d] sm:h-full sm:min-h-32">
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
                        {formatWaReminderBadge(event.wa_reminder_interval_days) && !passed ? (
                          <span className="rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-50 backdrop-blur-sm">
                            {formatWaReminderBadge(event.wa_reminder_interval_days)}
                          </span>
                        ) : null}
                    </div>
                      </div>
                    <div className="p-4 sm:self-center">
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
                      <p className="mt-2 text-xs font-bold text-primary/80">
                        Abrir detalhes e confirmações
                      </p>
                    </div>
                    </button>
                    <div className="grid grid-cols-2 gap-2 border-t border-[#1E242B] p-3 lg:w-48 lg:shrink-0 lg:border-l lg:border-t-0">
                      {!passed ? (
                        <button
                          type="button"
                          onClick={() => setNotifyChannelEvent(event)}
                          disabled={isNotifying === event.id}
                          className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-[#1E242B] bg-[#12161A] px-2 text-[11px] font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/10 disabled:opacity-50"
                        >
                          {isNotifying === event.id ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                          ) : (
                            <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          )}
                          <span>Avisar</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openEditEventModal(event)}
                        className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-[#1E242B] bg-[#12161A] px-2 text-[11px] font-bold text-sky-400 transition-colors hover:border-sky-500/30 hover:bg-sky-500/10"
                      >
                        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedEventForOps(event)}
                        className={cn(
                          'inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-[#1E242B] bg-[#12161A] px-2 text-[11px] font-bold transition-colors',
                          hasAccess
                            ? 'text-primary hover:border-primary/30 hover:bg-primary/10'
                            : 'cursor-not-allowed text-zinc-600 opacity-60',
                        )}
                        title={hasAccess ? 'Frequência, senhas, velas e QR' : 'Plano Oirô'}
                        disabled={!hasAccess}
                      >
                        <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>Convite</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setItemToDelete({ id: event.id, type: 'event', title: event.titulo })
                        }
                        className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/5 px-2 text-[11px] font-bold text-rose-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10"
                        aria-label="Excluir gira"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>Excluir</span>
                      </button>
                    </div>
                    <EventConfirmedAvatars members={confirmadosByEvent[event.id] ?? []} />
                  </article>
                );
              })}
              {adminAgendaEvents.length === 0 && !eventsFetchError ? (
                <div className="col-span-full w-full rounded-2xl border border-dashed border-[#2F3643] bg-[#12161A]/50 px-4 py-12 text-center text-sm text-[#94A3B8]">
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
                  Ao criar uma gira, filhos com WhatsApp recebem o aviso na hora. No formulário você pode
                  ligar lembrete automático (a cada X dias e no dia da gira). Convidados com telefone
                  recebem convite ao serem adicionados.
                </p>
                  </div>
                </div>
            </>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
              <AppDemoCard className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-primary">Calendário mensal</p>
                    <h3 className="mt-1 text-lg font-black capitalize text-white">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setCurrentMonth(new Date())} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-[#CBD5E1] hover:bg-white/5">Hoje</button>
                    <button type="button" onClick={prevMonth} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" onClick={nextMonth} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[680px] p-4">
                    <div className="grid grid-cols-7">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <div key={day} className="px-2 py-2 text-center text-xs font-black text-[#64748B]">{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-white/10">
                      {calendarDays.map((day) => {
                        const dayEvents = events.filter((event) => isSameDay(parseISO(event.data), day));
                        const today = isSameDay(day, new Date());
                        const current = isSameMonth(day, monthStart);
                        return (
                          <div key={day.toISOString()} className={cn('min-h-24 border-b border-r border-white/10 p-2', !current && 'bg-black/20 opacity-45', today && 'bg-primary/[0.06]')}>
                            <button type="button" onClick={() => setSelectedDate(day)} className={cn('grid h-7 w-7 place-items-center rounded-full text-xs font-black', today ? 'bg-primary text-[#17130D]' : 'text-[#CBD5E1]')}>{format(day, 'd')}</button>
                            <div className="mt-1.5 space-y-1">
                              {dayEvents.slice(0, 2).map((event) => (
                                <button key={event.id} type="button" onClick={() => setEventDetailModal(event)} className={cn('block w-full truncate rounded-md border px-1.5 py-1 text-left text-[10px] font-bold', getEventStyles(event.tipo))}>{formatHoraEvento(event.hora)} {event.titulo}</button>
                              ))}
                              {dayEvents.length > 2 ? <button type="button" onClick={() => { setSelectedDate(day); setAdminView('agenda'); }} className="px-1 text-[10px] font-black text-primary">+{dayEvents.length - 2} eventos</button> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4">
                      {[{ tipo: 'Gira', color: 'bg-sky-400' }, { tipo: 'Festa', color: 'bg-violet-400' }, { tipo: 'Obrigação', color: 'bg-amber-400' }, { tipo: 'Interno', color: 'bg-zinc-400' }].map((item) => <span key={item.tipo} className="flex items-center gap-2 text-xs font-bold text-[#7F8B9C]"><span className={cn('h-2 w-2 rounded-full', item.color)} />{item.tipo}</span>)}
                    </div>
                  </div>
                </div>
              </AppDemoCard>

              <div className="space-y-4">
                <AppDemoCard className="p-5">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs font-black uppercase tracking-[0.12em] text-primary">Próxima gira</p><h3 className="mt-1 text-lg font-black text-white">{nextUpcomingEvent?.titulo || 'Nenhuma agendada'}</h3></div>
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  {nextUpcomingEvent ? (
                    <>
                      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><span className="text-lg font-black">{format(parseISO(nextUpcomingEvent.data), 'dd')}</span></div>
                        <div><p className="text-sm font-black text-white">{format(parseISO(nextUpcomingEvent.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p><p className="text-xs font-semibold text-[#7F8B9C]">{formatHoraEvento(nextUpcomingEvent.hora)} · {nextUpcomingEvent.tipo}</p></div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-emerald-400/[0.06] p-3"><p className="text-xl font-black text-emerald-300">{nextConfirmedCount}</p><p className="text-xs font-bold text-[#7F8B9C]">confirmados</p></div>
                        <div className="rounded-xl bg-amber-400/[0.06] p-3"><p className="text-xl font-black text-amber-300">{nextUnconfirmedCount}</p><p className="text-xs font-bold text-[#7F8B9C]">sem resposta</p></div>
                      </div>
                      <button type="button" onClick={() => setEventDetailModal(nextUpcomingEvent)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-black text-[#17130D]">Ver detalhes <ArrowUpRight className="h-4 w-4" /></button>
                    </>
                  ) : <button type="button" onClick={openCreateEventModal} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 text-sm font-black text-primary"><Plus className="h-4 w-4" />Criar primeira gira</button>}
                </AppDemoCard>

                <AppDemoCard className="p-5">
                  <h3 className="text-sm font-black text-white">Próximos eventos</h3>
                  <div className="mt-3 space-y-2">
                    {eventsSorted.filter((event) => !isEventPassed(event.data, event.hora)).slice(0, 3).map((event) => (
                      <button key={event.id} type="button" onClick={() => setEventDetailModal(event)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left hover:border-primary/25">
                        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', getEventColor(event.tipo))} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">{event.titulo}</span><span className="block text-xs font-semibold text-[#64748B]">{format(parseISO(event.data), 'dd/MM')} · {formatHoraEvento(event.hora)}</span></span>
                        <ChevronRight className="h-4 w-4 text-[#64748B]" />
                      </button>
                    ))}
                  </div>
                </AppDemoCard>
              </div>
            </div>
          )}
                </div>
        </div>
        </div>
      </AppPageShell>

      <AnimatePresence>
        {addEventModalOpen ? (
          <AddEventModalPanel
            mode={editingEvent ? 'edit' : 'create'}
            onClose={closeEventFormModal}
            onSubmit={handleSubmit}
            formData={formData}
            setFormData={setFormData}
            isSubmitting={isSubmitting}
            bannerInputRef={bannerInputRef}
            bannerPreview={bannerPreview}
            hasExistingBanner={Boolean(editingEvent?.banner_url?.trim())}
            onRemoveBanner={() => {
              setRemoveBannerOnSave(true);
              setBannerFile(null);
              setBannerPreview((prev) => {
                if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                return null;
              });
            }}
            onBannerFile={(f) => {
              setRemoveBannerOnSave(false);
              setBannerFile(f);
              setBannerPreview((prev) => {
                if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                return URL.createObjectURL(f);
              });
            }}
          />
        ) : null}
        {eventDetailModal && (
          <AdminEventDrawer
            event={eventDetailModal}
            confirmed={confirmadosByEvent[eventDetailModal.id] ?? []}
            onClose={() => setEventDetailModal(null)}
            onEdit={() => openEditEventModal(eventDetailModal)}
            onNotify={() => {
              setNotifyChannelEvent(eventDetailModal);
              setEventDetailModal(null);
            }}
            onOperations={() => {
              setSelectedEventForOps(eventDetailModal);
              setEventDetailModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {selectedEventForOps && effectiveTenantId ? (
        <EventGiraOperationsPanel
          event={selectedEventForOps}
          tenantId={effectiveTenantId}
          onClose={() => {
            setSelectedEventForOps(null);
            void loadConfirmadosResumo();
          }}
          setActiveTab={setActiveTab}
          guestsSlot={
            <EventGuestsInline
              eventId={selectedEventForOps.id}
              eventTitle={selectedEventForOps.titulo}
              eventData={format(parseISO(selectedEventForOps.data), 'dd/MM/yyyy', { locale: ptBR })}
              eventHora={selectedEventForOps.hora}
              eventDescricao={selectedEventForOps.descricao}
              bannerUrl={selectedEventForOps.banner_url}
              tenantId={effectiveTenantId}
              tenantPlan={tenantData?.plan}
              isGlobalAdmin={isGlobalAdmin}
            />
          }
        />
      ) : null}

      {/* Delete Confirmation Modal */}
      <BodyPortal>
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setItemToDelete(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 w-full space-y-5 rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] px-6 py-8 text-center text-[#171A16] shadow-2xl sm:max-w-md"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#B04A32]/10">
                <X className="h-8 w-8 text-[#B04A32]" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-xl font-black text-[#171A16]">Confirmar Exclusão</h3>
                <p className="text-sm font-medium text-[#6F675C]">
                  Deseja realmente excluir o evento &quot;{itemToDelete.title}&quot;?
                </p>
              </div>
              <div className="flex gap-3">
                <button disabled={isDeleting} onClick={() => setItemToDelete(null)}
                  className="flex-1 rounded-2xl border border-[#D8D2C4] bg-white py-3 font-black text-sm text-[#4A463E] transition-all hover:bg-[#F5F0E5]">
                  Cancelar
                </button>
                <button disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      const response = await authFetch(`/api/events/${itemToDelete.id}`, {
                        method: 'DELETE',
                      });
                      if (response.ok) fetchEvents();
                      setItemToDelete(null);
                    } catch (err) {
                      console.error('Error deleting item:', err);
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#B04A32] py-3 font-black text-sm text-white shadow-lg shadow-[#B04A32]/20 transition-all hover:scale-105 hover:bg-[#9C3F2A]">
                  {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </BodyPortal>

      {/* Escolher canal do aviso (Push ou WhatsApp) */}
      <BodyPortal>
      <AnimatePresence>
        {notifyChannelEvent ? (
          <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeNotifyChannelModal}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              role="dialog"
              aria-modal="true"
              aria-labelledby="notify-channel-title"
              className="relative z-10 w-full space-y-5 rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] px-6 py-8 text-[#171A16] shadow-2xl sm:max-w-md"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F1E8D2]">
                <Bell className="h-8 w-8 text-[#8F7724]" />
              </div>
              <div className="space-y-2 text-center">
                <h3 id="notify-channel-title" className="font-display text-xl font-black text-[#171A16]">
                  Enviar aviso
                </h3>
                <p className="text-sm font-medium text-[#6F675C]">
                  Como deseja avisar a corrente sobre &quot;{notifyChannelEvent.titulo}&quot;?
                </p>
              </div>
              <div className="grid gap-3">
                <button
                  type="button"
                  disabled={Boolean(isNotifying)}
                  onClick={() => void handleNotifyPush(notifyChannelEvent)}
                  className="flex items-center gap-3 rounded-2xl border border-[#E3DCCE] bg-white px-4 py-3.5 text-left transition-colors hover:border-[#8F7724]/40 hover:bg-[#F1E8D2]/60 disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1E8D2] text-[#8F7724]">
                    {isNotifying && notifyChannel === 'push' ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <Bell className="h-5 w-5" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[#171A16]">Notificação push</span>
                    <span className="mt-0.5 block text-xs font-medium text-[#6F675C]">
                      Envia para o app/navegador dos filhos inscritos.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(isNotifying)}
                  onClick={() => void handleNotifyWhatsApp(notifyChannelEvent)}
                  className="flex items-center gap-3 rounded-2xl border border-[#E3DCCE] bg-white px-4 py-3.5 text-left transition-colors hover:border-[#3F7258]/40 hover:bg-[#3F7258]/10 disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3F7258]/10 text-[#3F7258]">
                    {isNotifying && notifyChannel === 'whatsapp' ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <MessageSquare className="h-5 w-5" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[#171A16]">WhatsApp</span>
                    <span className="mt-0.5 block text-xs font-medium text-[#6F675C]">
                      Envia o template de aviso para filhos com telefone cadastrado.
                    </span>
                  </span>
                </button>
              </div>
              <button
                type="button"
                disabled={Boolean(isNotifying)}
                onClick={closeNotifyChannelModal}
                className="w-full rounded-2xl border border-[#D8D2C4] bg-white py-3 text-sm font-black text-[#4A463E] transition-all hover:bg-[#F5F0E5] disabled:opacity-50"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
      </BodyPortal>
    </>
  );
}
