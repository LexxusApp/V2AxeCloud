import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  CreditCard,
  Flame,
  Info,
  Megaphone,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { fetchMinhasParticipacoes } from '../lib/giraOperations';
import { loadObrigacoesSeen } from '../hooks/useObrigacoesUnread';

export interface AppNotification {
  id: string;
  type: 'payment' | 'plan' | 'system' | 'info' | 'mural' | 'event' | 'obligation' | 'preceito';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

interface NotificationPanelProps {
  tenantData?: {
    tenant_id?: string | null;
  } | null;
  userRole?: string | null;
  userId?: string | null;
  onNavigate?: (tab: string) => void;
}

const TYPE_META: Record<
  AppNotification['type'],
  { icon: ReactNode; label: string; iconClass: string; surfaceClass: string }
> = {
  payment: {
    icon: <CreditCard className="h-4 w-4" />,
    label: 'Financeiro',
    iconClass: 'text-emerald-300',
    surfaceClass: 'border-emerald-400/20 bg-emerald-400/10',
  },
  plan: {
    icon: <RefreshCw className="h-4 w-4" />,
    label: 'Plano',
    iconClass: 'text-amber-300',
    surfaceClass: 'border-amber-400/20 bg-amber-400/10',
  },
  system: {
    icon: <Zap className="h-4 w-4" />,
    label: 'Sistema',
    iconClass: 'text-sky-300',
    surfaceClass: 'border-sky-400/20 bg-sky-400/10',
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    label: 'Informação',
    iconClass: 'text-slate-300',
    surfaceClass: 'border-white/10 bg-white/[0.05]',
  },
  mural: {
    icon: <Megaphone className="h-4 w-4" />,
    label: 'Comunicado',
    iconClass: 'text-violet-300',
    surfaceClass: 'border-violet-400/20 bg-violet-400/10',
  },
  event: {
    icon: <CalendarDays className="h-4 w-4" />,
    label: 'Próxima gira',
    iconClass: 'text-cyan-300',
    surfaceClass: 'border-cyan-400/20 bg-cyan-400/10',
  },
  obligation: {
    icon: <Flame className="h-4 w-4" />,
    label: 'Obrigação',
    iconClass: 'text-amber-300',
    surfaceClass: 'border-amber-400/20 bg-amber-400/10',
  },
  preceito: {
    icon: <Flame className="h-4 w-4" />,
    label: 'Preceito',
    iconClass: 'text-yellow-300',
    surfaceClass: 'border-yellow-400/20 bg-yellow-400/10',
  },
};

const STORAGE_KEY = 'axecloud_notifications';
const MURAL_READ_KEY = 'axecloud_mural_read';
const PAYMENT_ACK_KEY = 'axecloud_payment_notifs_ack';

function timeAgo(dateStr: string): string {
  const timestamp = new Date(dateStr).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ontem' : `Há ${days} dias`;
}

function loadNotifications(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as AppNotification[];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

function loadStoredSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveStoredSet(key: string, values: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...values]));
}

function acknowledgePayments(ids: string[]) {
  const paymentIds = ids.filter((id) => id.startsWith('payment_'));
  if (!paymentIds.length) return;
  const acknowledged = loadStoredSet(PAYMENT_ACK_KEY);
  paymentIds.forEach((id) => acknowledged.add(id));
  saveStoredSet(PAYMENT_ACK_KEY, acknowledged);
}

function notificationTarget(type: AppNotification['type']) {
  if (type === 'payment') return 'financial';
  if (type === 'mural') return 'mural';
  if (type === 'event') return 'calendar';
  if (type === 'obligation') return 'obrigacoes';
  if (type === 'preceito') return 'profile';
  return 'dashboard';
}

export default function NotificationPanel({
  tenantData,
  userRole,
  userId,
  onNavigate,
}: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [muralNotifications, setMuralNotifications] = useState<AppNotification[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<AppNotification[]>([]);
  const [muralRead, setMuralRead] = useState<Set<string>>(() => loadStoredSet(MURAL_READ_KEY));
  const rootRef = useRef<HTMLDivElement>(null);
  const paymentFetchRef = useRef<string | null>(null);
  const isFilho = userRole === 'filho';
  const tenantId = tenantData?.tenant_id ? String(tenantData.tenant_id) : null;

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (isFilho) return;
    const acknowledged = loadStoredSet(PAYMENT_ACK_KEY);
    // Pagamentos reconhecidos permanecem na lista como lidos (não são recriados
    // como novos pelo efeito de busca, que respeita o PAYMENT_ACK_KEY).
    const saved = loadNotifications()
      .filter(
        (notification) =>
          !(notification.type === 'system' && notification.id.startsWith('sys_')) &&
          !(notification.type === 'plan' && notification.id.startsWith('plan_')),
      )
      .map((notification) =>
        notification.type === 'payment' && acknowledged.has(notification.id)
          ? { ...notification, read: true }
          : notification,
      );
    saveNotifications(saved);
    setNotifications(saved);
  }, [isFilho, tenantId, userId]);

  useEffect(() => {
    if (isFilho || !tenantId) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const notificationId = `payment_${tenantId}_${month}`;
    const fetchKey = `${tenantId}:${month}`;
    if (paymentFetchRef.current === fetchKey) return;
    paymentFetchRef.current = fetchKey;
    if (loadStoredSet(PAYMENT_ACK_KEY).has(notificationId)) return;

    let cancelled = false;
    void supabase
      .from('financeiro')
      .select('id, descricao, valor, created_at')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'entrada')
      .gte('created_at', `${month}-01`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data || loadStoredSet(PAYMENT_ACK_KEY).has(notificationId)) return;
        setNotifications((current) => {
          if (current.some((notification) => notification.id === notificationId)) return current;
          const updated: AppNotification[] = [
            {
              id: notificationId,
              type: 'payment',
              title: 'Nova entrada registrada',
              body: `${data.descricao || 'Movimentação financeira'} · ${new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(Number(data.valor) || 0)}`,
              read: false,
              created_at: data.created_at,
            },
            ...current,
          ];
          saveNotifications(updated);
          return updated;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isFilho, tenantId]);

  useEffect(() => {
    if (isFilho || !tenantId) return;
    let cancelled = false;
    void authFetch(`/api/notifications?tenantId=${encodeURIComponent(tenantId)}&tipo=preceito_orientacao&limit=20`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error);
        if (cancelled) return;
        setNotifications((current) => {
          const currentMap = new Map(current.map((item) => [item.id, item]));
          const incoming: AppNotification[] = (json.data || []).map((item: any) => {
            const id = `db_preceito_${String(item.id)}`;
            return {
              id,
              type: 'preceito',
              title: 'Pedido de orientação',
              body: String(item.mensagem || 'Um membro pediu orientação sobre o ciclo de preceito.'),
              read: currentMap.get(id)?.read ?? Boolean(item.lida),
              created_at: String(item.created_at || new Date().toISOString()),
            };
          });
          const incomingIds = new Set(incoming.map((item) => item.id));
          const merged = [...incoming, ...current.filter((item) => !incomingIds.has(item.id))]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 40);
          saveNotifications(merged);
          return merged;
        });
      })
      .catch((error) => console.warn('[notifications] preceito:', error));
    return () => {
      cancelled = true;
    };
  }, [isFilho, tenantId]);

  useEffect(() => {
    if (!isFilho || !tenantId) return;
    let cancelled = false;

    void supabase
      .from('mural_avisos')
      .select('id, titulo, conteudo, data_publicacao')
      .eq('tenant_id', tenantId)
      .order('data_publicacao', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const readIds = loadStoredSet(MURAL_READ_KEY);
        setMuralRead(readIds);
        setMuralNotifications(
          data.map((item) => ({
            id: `mural_${item.id}`,
            type: 'mural' as const,
            title: item.titulo,
            body: String(item.conteudo || '').slice(0, 140),
            read: readIds.has(`mural_${item.id}`),
            created_at: item.data_publicacao,
          })),
        );
      });

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`notification_panel_mural_${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mural_avisos',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const item = payload.new;
            setMuralNotifications((current) => [
              {
                id: `mural_${String(item.id)}`,
                type: 'mural',
                title: String(item.titulo || 'Novo comunicado'),
                body: String(item.conteudo || '').slice(0, 140),
                read: false,
                created_at: String(item.data_publicacao || new Date().toISOString()),
              },
              ...current,
            ]);
          },
        )
        .subscribe();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [isFilho, tenantId]);

  useEffect(() => {
    if (!isFilho || !tenantId || !userId) {
      setPendingNotifications([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const today = new Date();
      const start = today.toISOString().slice(0, 10);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 120);
      const end = endDate.toISOString().slice(0, 10);
      const readIds = loadStoredSet(MURAL_READ_KEY);

      const [homeResult, participationResult, eventsResult, preceitoResult] = await Promise.allSettled([
        authFetch(`/api/v1/filho/home?tenantId=${encodeURIComponent(tenantId)}`).then(async (response) => {
          const json = await response.json();
          if (!response.ok) throw new Error(json.error || 'Erro ao carregar pendências');
          return json;
        }),
        fetchMinhasParticipacoes(tenantId, start, end),
        authFetch(`/api/events?tenantId=${encodeURIComponent(tenantId)}&start=${start}&end=${end}&scope=calendar`).then(async (response) => {
          const json = await response.json();
          if (!response.ok) throw new Error(json.error || 'Erro ao carregar giras');
          return Array.isArray(json.data) ? json.data : [];
        }),
        authFetch(`/api/v1/preceitos/current?tenantId=${encodeURIComponent(tenantId)}`).then(async (response) => {
          const json = await response.json();
          if (!response.ok) throw new Error(json.error || 'Erro ao carregar preceitos');
          return Array.isArray(json.data) ? json.data : [];
        }),
      ]);
      if (cancelled) return;

      const next: AppNotification[] = [];
      const home = homeResult.status === 'fulfilled' ? homeResult.value : null;
      const financialStatus = String(home?.financialStatus || 'pago').toLowerCase();
      if (!['pago', 'paid', 'quitado', 'em dia'].includes(financialStatus)) {
        const id = `filho_payment_${tenantId}_${today.getFullYear()}-${today.getMonth() + 1}`;
        next.push({
          id,
          type: 'payment',
          title: financialStatus === 'vencido' ? 'Mensalidade vencida' : 'Mensalidade em aberto',
          body: 'Confira os detalhes e a chave Pix disponibilizada pela casa.',
          read: readIds.has(id),
          created_at: new Date().toISOString(),
        });
      }

      const participations = participationResult.status === 'fulfilled' ? participationResult.value : [];
      const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
      const activePreceitos = preceitoResult.status === 'fulfilled' ? preceitoResult.value : [];
      activePreceitos.slice(0, 2).forEach((cycle: any) => {
        const id = `preceito_${String(cycle.id)}`;
        next.push({
          id,
          type: 'preceito',
          title: String(cycle.titulo || 'Ciclo de preceito ativo'),
          body: cycle.participacao?.status === 'ciente'
            ? 'Sua leitura foi confirmada. Consulte novamente sempre que precisar.'
            : 'A zeladoria publicou uma orientação protegida para você.',
          read: readIds.has(id),
          created_at: String(cycle.ativado_em || cycle.inicio_em || new Date().toISOString()),
        });
      });
      const nextEvent = [...events]
        .filter((item: any) => String(item.tipo || '').toLowerCase() !== 'obrigação')
        .sort((a: any, b: any) => String(a.data).localeCompare(String(b.data)))[0];
      const nextParticipation = nextEvent
        ? participations.find((item) => item.event_id === String(nextEvent.id))
        : null;
      if (nextEvent && (!nextParticipation || nextParticipation.status === 'pendente')) {
        const id = `event_${String(nextEvent.id)}`;
        const eventDate = new Date(`${nextEvent.data}T12:00:00`);
        next.push({
          id,
          type: 'event',
          title: `Confirme: ${String(nextEvent.titulo || 'próxima gira')}`,
          body: `A casa aguarda sua resposta para ${eventDate.toLocaleDateString('pt-BR')}.`,
          read: readIds.has(id),
          created_at: new Date().toISOString(),
        });
      }

      const childId = String(home?.child?.id || '');
      if (childId) {
        const { data: obligations } = await supabase
          .from('calendario_axe')
          .select('id, titulo, data')
          .eq('tipo', 'Obrigação')
          .eq('tenant_id', tenantId)
          .like('descricao', `%FILHO_ID:${childId}%`)
          .order('data', { ascending: false })
          .limit(10);
        if (cancelled) return;
        const seen = loadObrigacoesSeen(childId);
        (obligations || []).filter((item) => !seen.has(String(item.id))).slice(0, 3).forEach((item) => {
          const id = `obligation_${String(item.id)}`;
          next.push({
            id,
            type: 'obligation',
            title: String(item.titulo || 'Nova obrigação registrada'),
            body: `Orientação registrada para ${new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')}.`,
            read: readIds.has(id),
            created_at: String(item.data || new Date().toISOString()),
          });
        });
      }

      if (!cancelled) setPendingNotifications(next);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isFilho, tenantId, userId]);

  const allNotifications = isFilho
    ? [...pendingNotifications, ...muralNotifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    : notifications;
  const unread = allNotifications.filter((notification) => !notification.read).length;
  const visibleNotifications = useMemo(
    () =>
      filter === 'unread'
        ? allNotifications.filter((notification) => !notification.read)
        : allNotifications,
    [allNotifications, filter],
  );

  const markAllRead = () => {
    if (isFilho) {
      const updatedRead = new Set([...muralRead, ...allNotifications.map(({ id }) => id)]);
      saveStoredSet(MURAL_READ_KEY, updatedRead);
      setMuralRead(updatedRead);
      setMuralNotifications((current) =>
        current.map((notification) => ({ ...notification, read: true })),
      );
      setPendingNotifications((current) =>
        current.map((notification) => ({ ...notification, read: true })),
      );
      return;
    }
    acknowledgePayments(notifications.map(({ id }) => id));
    const updated = notifications.map((notification) => ({ ...notification, read: true }));
    saveNotifications(updated);
    setNotifications(updated);
  };

  const markRead = (id: string) => {
    if (isFilho) {
      const updatedRead = new Set([...muralRead, id]);
      saveStoredSet(MURAL_READ_KEY, updatedRead);
      setMuralRead(updatedRead);
      setMuralNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        ),
      );
      setPendingNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        ),
      );
      return;
    }
    acknowledgePayments([id]);
    const updated = notifications.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification,
    );
    saveNotifications(updated);
    setNotifications(updated);
  };

  const dismiss = (id: string) => {
    if (isFilho) {
      const updatedRead = new Set([...muralRead, id]);
      saveStoredSet(MURAL_READ_KEY, updatedRead);
      setMuralRead(updatedRead);
      setMuralNotifications((current) => current.filter((notification) => notification.id !== id));
      setPendingNotifications((current) => current.filter((notification) => notification.id !== id));
      return;
    }
    acknowledgePayments([id]);
    const updated = notifications.filter((notification) => notification.id !== id);
    saveNotifications(updated);
    setNotifications(updated);
  };

  const openNotification = (notification: AppNotification) => {
    markRead(notification.id);
    setOpen(false);
    onNavigate?.(notificationTarget(notification.type));
  };

  // Ver é ler: abrir o painel marca tudo como lido (persistido), para as
  // notificações não voltarem como "não lidas" após recarregar a página.
  // O pequeno atraso deixa o usuário perceber o que era novidade; fechar o
  // painel antes do atraso também marca (cleanup).
  const markAllReadRef = useRef(markAllRead);
  markAllReadRef.current = markAllRead;
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => markAllReadRef.current(), 1200);
    return () => {
      window.clearTimeout(timer);
      markAllReadRef.current();
    };
  }, [open]);

  return (
    <div ref={rootRef} className="axecloud-notification-root">
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        aria-label={
          unread ? `Abrir notificações, ${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Abrir notificações'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn('axecloud-notification-trigger', open && 'is-open')}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
        {unread > 0 ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="axecloud-notification-badge"
            aria-hidden
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.section
            role="dialog"
            aria-label="Central de notificações"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="axecloud-notification-popover"
          >
            <div className="axecloud-notification-header">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="axecloud-notification-heading-icon">
                    <Sparkles className="h-4 w-4" aria-hidden />
                  </span>
                  <h2 className="font-display text-base font-extrabold text-white">
                    {isFilho ? 'Avisos da casa' : 'Notificações'}
                  </h2>
                </div>
                <p className="mt-1 text-[11px] text-[#8B96A8]">
                  {unread
                    ? `${unread} ${unread === 1 ? 'novidade precisa' : 'novidades precisam'} da sua atenção`
                    : 'Você está em dia com tudo'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="axecloud-notification-close"
                aria-label="Fechar notificações"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="axecloud-notification-toolbar">
              <div className="axecloud-notification-filter" role="tablist" aria-label="Filtrar notificações">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'all'}
                  onClick={() => setFilter('all')}
                  className={cn(filter === 'all' && 'is-active')}
                >
                  Todas
                  <span>{allNotifications.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'unread'}
                  onClick={() => setFilter('unread')}
                  className={cn(filter === 'unread' && 'is-active')}
                >
                  Não lidas
                  <span>{unread}</span>
                </button>
              </div>
              {unread > 0 ? (
                <button type="button" onClick={markAllRead} className="axecloud-notification-read-all">
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                  Ler todas
                </button>
              ) : null}
            </div>

            <div className="axecloud-notification-list">
              <AnimatePresence initial={false} mode="popLayout">
                {visibleNotifications.length ? (
                  visibleNotifications.map((notification) => {
                    const meta = TYPE_META[notification.type];
                    return (
                      <motion.article
                        layout
                        key={notification.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12, height: 0 }}
                        className={cn(
                          'axecloud-notification-item',
                          !notification.read && 'is-unread',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => openNotification(notification)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border',
                              meta.surfaceClass,
                              meta.iconClass,
                            )}
                          >
                            {meta.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#748094]">
                                {meta.label}
                              </span>
                              {!notification.read ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(255,199,0,.8)]" />
                              ) : null}
                            </span>
                            <span
                              className={cn(
                                'mt-1 block text-[13px] font-bold leading-snug',
                                notification.read ? 'text-[#B5BECC]' : 'text-white',
                              )}
                            >
                              {notification.title}
                            </span>
                            <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-[#7E899A]">
                              {notification.body}
                            </span>
                            <span className="mt-2 block text-[10px] font-semibold text-[#596578]">
                              {timeAgo(notification.created_at)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss(notification.id)}
                          className="axecloud-notification-dismiss"
                          aria-label={`Remover ${notification.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </motion.article>
                    );
                  })
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="axecloud-notification-empty"
                  >
                    <span className="axecloud-notification-empty-icon">
                      <Check className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="font-display text-sm font-bold text-white">
                      {filter === 'unread' ? 'Tudo foi lido' : 'Tudo em ordem'}
                    </p>
                    <p className="mt-1 max-w-[220px] text-center text-[11px] leading-relaxed text-[#738095]">
                      {isFilho
                        ? 'Os novos comunicados do terreiro aparecerão aqui.'
                        : 'As novidades importantes da gestão aparecerão aqui.'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="axecloud-notification-footer">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Atualizações em tempo real
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
