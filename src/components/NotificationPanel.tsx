import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  CreditCard,
  Flame,
  HandHeart,
  Info,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { fetchMinhasParticipacoes } from '../lib/giraOperations';
import { resolveStoreTenantPk } from '../lib/resolveStoreTenantPk';
import { loadObrigacoesSeen } from '../hooks/useObrigacoesUnread';
import { isPaidMensalidadeFinanceRow } from '../lib/mensalidadeFinanceRow';
import {
  NOTIF_DISMISS_KEY,
  NOTIF_READ_KEY,
  loadNotifIdSetForUser,
  notifDismissStorageKey,
  notifReadStorageKey,
  saveNotifIdSet,
} from '../lib/notificationPrefs';
import {
  GIRA_REMINDER_FEATURE_NOTIF_ID,
  GiraReminderFeatureModal,
  requestOpenGiraReminderConfig,
} from './gira/GiraReminderFeatureModal';

export interface AppNotification {
  id: string;
  type: 'payment' | 'reza' | 'event' | 'obligation' | 'store' | 'wafail' | 'library' | 'system' | 'info';
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
  /** `inline` = preso no header mobile; `fixed` = flutuante (desktop). */
  placement?: 'fixed' | 'inline';
}

const TYPE_META: Record<
  AppNotification['type'],
  { icon: ReactNode; label: string; iconClass: string; surfaceClass: string }
> = {
  payment: {
    icon: <CreditCard className="h-4 w-4" />,
    label: 'Mensalidade',
    iconClass: 'text-emerald-300',
    surfaceClass: 'border-emerald-400/20 bg-emerald-400/10',
  },
  reza: {
    icon: <HandHeart className="h-4 w-4" />,
    label: 'Pedido de reza',
    iconClass: 'text-rose-300',
    surfaceClass: 'border-rose-400/20 bg-rose-400/10',
  },
  event: {
    icon: <CalendarDays className="h-4 w-4" />,
    label: 'Gira',
    iconClass: 'text-cyan-300',
    surfaceClass: 'border-cyan-400/20 bg-cyan-400/10',
  },
  obligation: {
    icon: <Flame className="h-4 w-4" />,
    label: 'Obrigação',
    iconClass: 'text-amber-300',
    surfaceClass: 'border-amber-400/20 bg-amber-400/10',
  },
  store: {
    icon: <ShoppingBag className="h-4 w-4" />,
    label: 'Loja',
    iconClass: 'text-violet-300',
    surfaceClass: 'border-violet-400/20 bg-violet-400/10',
  },
  wafail: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Falha de envio',
    iconClass: 'text-red-300',
    surfaceClass: 'border-red-400/20 bg-red-400/10',
  },
  library: {
    icon: <BookOpen className="h-4 w-4" />,
    label: 'Biblioteca',
    iconClass: 'text-sky-300',
    surfaceClass: 'border-sky-400/20 bg-sky-400/10',
  },
  system: {
    icon: <Sparkles className="h-4 w-4" />,
    label: 'Atualização',
    iconClass: 'text-amber-300',
    surfaceClass: 'border-amber-400/20 bg-amber-400/10',
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    label: 'Informação',
    iconClass: 'text-slate-300',
    surfaceClass: 'border-white/10 bg-white/[0.05]',
  },
};

const LIST_CAP = 30;
/** Avisos de nova função: não somem só de “ver o painel” — pedem clique ou “Ler todas”. */
const FEATURE_ANNOUNCEMENT_IDS = new Set([GIRA_REMINDER_FEATURE_NOTIF_ID]);

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

function formatBRL(value: unknown): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value) || 0,
  );
}

function formatDay(dateStr: string): string {
  const date = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function dateStrPlusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function isNotifRead(id: string, readIds: Set<string>): boolean {
  if (readIds.has(id)) return true;
  // Novo formato gira_<uuid>: também cobre IDs legados gira_<uuid>_<data>
  if (id.startsWith('gira_') && !id.slice(5).includes('_')) {
    for (const old of readIds) {
      if (old.startsWith(`${id}_`)) return true;
    }
  }
  // Legado gira_<uuid>_<data>: cobre se o estável gira_<uuid> já foi lido
  const legacy = id.match(/^gira_([0-9a-f-]{36})_/i);
  if (legacy && readIds.has(`gira_${legacy[1]}`)) return true;
  return false;
}

function stableDateKey(raw: unknown): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10);
}

function eventTimestamp(event: { data?: unknown; hora?: unknown; created_at?: unknown }): string {
  const created = String(event.created_at || '').trim();
  if (created) return created;
  const day = stableDateKey(event.data);
  const time = String(event.hora || '12:00:00').trim().slice(0, 8);
  return day ? `${day}T${time.length === 5 ? `${time}:00` : time}` : new Date().toISOString();
}

function notificationTarget(type: AppNotification['type'], isFilho: boolean): string {
  switch (type) {
    case 'payment':
      return 'financial';
    case 'reza':
      return 'atendimentos';
    case 'event':
      return 'calendar';
    case 'obligation':
      return isFilho ? 'obrigacoes' : 'children';
    case 'store':
      return 'store';
    case 'wafail':
      return 'settings';
    case 'library':
      return 'library';
    case 'system':
      return 'calendar';
    default:
      return isFilho ? 'profile' : 'dashboard';
  }
}

type RawNotification = Omit<AppNotification, 'read'>;

/** Fontes do sino do zelador: mensalidades pagas, pedidos de reza, lembretes de
 *  gira e obrigação, pedidos da loja e falhas de envio de WhatsApp. */
async function loadZeladorNotifications(
  tenantId: string,
  userId: string | null,
): Promise<RawNotification[]> {
  const today = new Date().toISOString().slice(0, 10);

  const [pagamentos, rezas, giras, obrigacoes, pedidosLoja, falhasEnvio] = await Promise.allSettled([
    supabase
      .from('financeiro')
      .select('id, descricao, valor, created_at, categoria, tipo, status')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'entrada')
      .eq('categoria', 'Mensalidade')
      .gte('created_at', isoDaysAgo(14))
      .order('created_at', { ascending: false })
      .limit(20),
    authFetch(`/api/v1/atendimentos/pedidos-reza?tenantId=${encodeURIComponent(tenantId)}`).then(
      async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Erro ao carregar pedidos de reza');
        return Array.isArray(json.data) ? json.data : [];
      },
    ),
    authFetch(
      `/api/events?tenantId=${encodeURIComponent(tenantId)}&start=${today}&end=${dateStrPlusDays(7)}&scope=calendar`,
    ).then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar giras');
      return Array.isArray(json.data) ? json.data : [];
    }),
    supabase
      .from('calendario_axe')
      .select('id, titulo, data')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'Obrigação')
      .gte('data', today)
      .lte('data', dateStrPlusDays(14))
      .order('data', { ascending: true })
      .limit(5),
    resolveStoreTenantPk({ tenantIdFromContext: tenantId, fallbackUserId: userId }).then(
      async (pk) => {
        if (!pk) return [];
        const { data } = await supabase
          .from('loja_pedidos')
          .select('id, created_at, filho_nome, tipo, valor_total')
          .eq('tenant_id', pk)
          .gte('created_at', isoDaysAgo(14))
          .order('created_at', { ascending: false })
          .limit(5);
        return data || [];
      },
    ),
    supabase
      .from('whatsapp_logs')
      .select('id, tipo, telefone, created_at')
      .eq('status', 'failed')
      .gte('created_at', isoDaysAgo(7))
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const items: RawNotification[] = [];
  const nowIso = new Date().toISOString();

  if (pagamentos.status === 'fulfilled') {
    (pagamentos.value.data || [])
      .filter((row) => {
        // Cobrança em aberto (vencimento) nunca vira "Mensalidade paga" no sino.
        if (/\(vencimento/i.test(String(row.descricao || ''))) return false;
        const st = String((row as { status?: string }).status || '').toLowerCase();
        if (st === 'pendente' || st === 'pending' || st === 'atrasado' || st === 'overdue') {
          return false;
        }
        return isPaidMensalidadeFinanceRow(row as Record<string, unknown>);
      })
      .slice(0, 5)
      .forEach((row) => {
        items.push({
          id: `pago_${String(row.id)}`,
          type: 'payment',
          title: 'Mensalidade paga',
          body: `${String(row.descricao || 'Mensalidade')} · ${formatBRL(row.valor)}`,
          created_at: String(row.created_at || nowIso),
        });
      });
  }

  if (rezas.status === 'fulfilled') {
    (rezas.value as any[])
      .filter((pedido) => String(pedido.status || '') === 'pendente')
      .slice(0, 5)
      .forEach((pedido) => {
        items.push({
          id: `reza_${String(pedido.id)}`,
          type: 'reza',
          title: 'Novo pedido de reza',
          body: `${String(pedido.nome || 'Consulente')} · ${String(pedido.mensagem || '').slice(0, 120)}`,
          created_at: String(pedido.created_at || nowIso),
        });
      });
  }

  if (giras.status === 'fulfilled') {
    (giras.value as any[])
      .filter((event) => String(event.tipo || '').toLowerCase() !== 'obrigação')
      .slice(0, 4)
      .forEach((event) => {
        const eventId = String(event.id || '').trim();
        if (!eventId) return;
        const hora = event.hora ? ` às ${String(event.hora).slice(0, 5)}` : '';
        items.push({
          // ID estável só pelo evento — não incluir data (formato varia e “deslê” o sino).
          id: `gira_${eventId}`,
          type: 'event',
          title: `Lembrete de gira: ${String(event.titulo || 'gira marcada')}`,
          body: `Marcada para ${formatDay(String(event.data))}${hora}.`,
          created_at: eventTimestamp(event),
        });
      });
  }

  if (obrigacoes.status === 'fulfilled') {
    (obrigacoes.value.data || []).forEach((row) => {
      const rowId = String(row.id || '').trim();
      if (!rowId) return;
      items.push({
        id: `obg_${rowId}`,
        type: 'obligation',
        title: `Lembrete de obrigação: ${String(row.titulo || 'obrigação agendada')}`,
        body: `Agendada para ${formatDay(String(row.data))}.`,
        created_at: eventTimestamp(row),
      });
    });
  }

  if (pedidosLoja.status === 'fulfilled') {
    (pedidosLoja.value as any[]).forEach((pedido) => {
      items.push({
        id: `loja_${String(pedido.id)}`,
        type: 'store',
        title: pedido.tipo === 'reserva' ? 'Nova reserva na loja' : 'Novo pedido na loja',
        body: `${String(pedido.filho_nome || 'Membro da casa')} · ${formatBRL(pedido.valor_total)}`,
        created_at: String(pedido.created_at || nowIso),
      });
    });
  }

  if (falhasEnvio.status === 'fulfilled') {
    (falhasEnvio.value.data || []).forEach((log) => {
      items.push({
        id: `wafail_${String(log.id)}`,
        type: 'wafail',
        title: 'Falha no envio de WhatsApp',
        body: `A mensagem${log.tipo ? ` (${String(log.tipo)})` : ''} para ${String(log.telefone || 'o destinatário')} não foi entregue.`,
        created_at: String(log.created_at || nowIso),
      });
    });
  }

  // Aviso de nova função (zelador): clique abre modal explicativo.
  // created_at = agora só para ordenação; o rótulo na UI é “Novidade”.
  items.push({
    id: GIRA_REMINDER_FEATURE_NOTIF_ID,
    type: 'system',
    title: 'Nova função: lembrete automático de gira',
    body: 'Configure o intervalo no WhatsApp (1–7 dias) e o aviso no dia da gira.',
    created_at: nowIso,
  });

  return items;
}

/** Fontes do sino do filho de santo: obrigação lançada no perfil, mensalidade,
 *  evento novo no calendário e PDF novo na biblioteca. */
async function loadFilhoNotifications(tenantId: string): Promise<RawNotification[]> {
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = dateStrPlusDays(120);
  const nowIso = today.toISOString();

  const [homeResult, participationResult, eventsResult, materialsResult] = await Promise.allSettled([
    authFetch(`/api/v1/filho/home?tenantId=${encodeURIComponent(tenantId)}`).then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar pendências');
      return json;
    }),
    fetchMinhasParticipacoes(tenantId, start, end),
    authFetch(
      `/api/events?tenantId=${encodeURIComponent(tenantId)}&start=${start}&end=${end}&scope=calendar`,
    ).then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar giras');
      return Array.isArray(json.data) ? json.data : [];
    }),
    authFetch(`/api/v1/library/materials?tenantId=${encodeURIComponent(tenantId)}`).then(
      async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Erro ao carregar biblioteca');
        return Array.isArray(json.data) ? json.data : [];
      },
    ),
  ]);

  const items: RawNotification[] = [];

  const home = homeResult.status === 'fulfilled' ? homeResult.value : null;
  const financialStatus = String(home?.financialStatus || 'pago').toLowerCase();
  if (!['pago', 'paid', 'quitado', 'em dia'].includes(financialStatus)) {
    items.push({
      id: `filho_payment_${tenantId}_${today.getFullYear()}-${today.getMonth() + 1}`,
      type: 'payment',
      title: financialStatus === 'vencido' ? 'Mensalidade vencida' : 'Mensalidade em aberto',
      body: 'Confira os detalhes e a chave Pix disponibilizada pela casa.',
      created_at: nowIso,
    });
  }

  const participations = participationResult.status === 'fulfilled' ? participationResult.value : [];
  const events = eventsResult.status === 'fulfilled' ? (eventsResult.value as any[]) : [];
  const upcoming = events
    .filter((item) => String(item.tipo || '').toLowerCase() !== 'obrigação')
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const nextEvent = upcoming[0];
  const nextParticipation = nextEvent
    ? participations.find((item) => item.event_id === String(nextEvent.id))
    : null;
  if (nextEvent && (!nextParticipation || nextParticipation.status === 'pendente')) {
    items.push({
      id: `event_${String(nextEvent.id)}`,
      type: 'event',
      title: `Nova gira no calendário: ${String(nextEvent.titulo || 'próxima gira')}`,
      body: `A casa aguarda sua confirmação para ${formatDay(String(nextEvent.data))}.`,
      created_at: eventTimestamp(nextEvent),
    });
  }

  if (materialsResult.status === 'fulfilled') {
    const recentLimit = new Date(isoDaysAgo(14)).getTime();
    (materialsResult.value as any[])
      .filter((material) => new Date(String(material.created_at || 0)).getTime() >= recentLimit)
      .slice(0, 3)
      .forEach((material) => {
        items.push({
          id: `pdf_${String(material.id)}`,
          type: 'library',
          title: 'Novo material na biblioteca',
          body: `${String(material.titulo || 'Material de estudo')}${material.categoria ? ` · ${String(material.categoria)}` : ''}`,
          created_at: String(material.created_at || nowIso),
        });
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
    const seen = loadObrigacoesSeen(childId);
    (obligations || [])
      .filter((item) => !seen.has(String(item.id)))
      .slice(0, 3)
      .forEach((item) => {
        items.push({
          id: `obligation_${String(item.id)}`,
          type: 'obligation',
          title: String(item.titulo || 'Nova obrigação registrada'),
          body: `Orientação registrada para ${formatDay(String(item.data))}.`,
          created_at: String(item.data || nowIso),
        });
      });
  }

  return items;
}

export default function NotificationPanel({
  tenantData,
  userRole,
  userId,
  onNavigate,
  placement = 'fixed',
}: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [rawItems, setRawItems] = useState<RawNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(
    () => loadNotifIdSetForUser(NOTIF_READ_KEY, userId),
  );
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => loadNotifIdSetForUser(NOTIF_DISMISS_KEY, userId),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLElement | null>(null);
  const isFilho = userRole === 'filho';
  const tenantId = tenantData?.tenant_id ? String(tenantData.tenant_id) : null;
  const readKey = notifReadStorageKey(userId);
  const dismissKey = notifDismissStorageKey(userId);
  const rawItemsRef = useRef(rawItems);
  rawItemsRef.current = rawItems;
  const readKeyRef = useRef(readKey);
  readKeyRef.current = readKey;
  const dismissKeyRef = useRef(dismissKey);
  dismissKeyRef.current = dismissKey;

  useEffect(() => {
    setReadIds(loadNotifIdSetForUser(NOTIF_READ_KEY, userId));
    setDismissedIds(loadNotifIdSetForUser(NOTIF_DISMISS_KEY, userId));
  }, [userId]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
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
    if (!tenantId) {
      setRawItems([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const items = isFilho
          ? await loadFilhoNotifications(tenantId)
          : await loadZeladorNotifications(tenantId, userId ?? null);
        if (!cancelled) setRawItems(items);
      } catch (error) {
        console.warn('[notifications] load:', error);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isFilho, tenantId, userId]);

  const allNotifications = useMemo<AppNotification[]>(
    () =>
      rawItems
        .filter((item) => !dismissedIds.has(item.id))
        .map((item) => ({ ...item, read: isNotifRead(item.id, readIds) }))
        .sort((a, b) => {
          // Atualizações de função não lidas ficam no topo (acima de lembretes rotineiros).
          const aPin = FEATURE_ANNOUNCEMENT_IDS.has(a.id) && !a.read ? 1 : 0;
          const bPin = FEATURE_ANNOUNCEMENT_IDS.has(b.id) && !b.read ? 1 : 0;
          if (aPin !== bPin) return bPin - aPin;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, LIST_CAP),
    [rawItems, readIds, dismissedIds],
  );
  const unread = allNotifications.filter((notification) => !notification.read).length;
  const visibleNotifications = useMemo(
    () =>
      filter === 'unread'
        ? allNotifications.filter((notification) => !notification.read)
        : allNotifications,
    [allNotifications, filter],
  );

  const persistReadIds = (updated: Set<string>) => {
    const scoped = readKeyRef.current;
    saveNotifIdSet(scoped, updated);
    // Espelho na chave legada — evita “desler” se o userId hidratar depois.
    if (scoped !== NOTIF_READ_KEY) saveNotifIdSet(NOTIF_READ_KEY, updated);
  };

  const markAllRead = (opts?: { includeFeatureAnnouncements?: boolean }) => {
    const includeFeatures = opts?.includeFeatureAnnouncements !== false;
    setReadIds((current) => {
      const updated = new Set(current);
      for (const item of rawItemsRef.current) {
        if (!includeFeatures && FEATURE_ANNOUNCEMENT_IDS.has(item.id)) continue;
        updated.add(item.id);
      }
      // Compat: IDs antigos `gira_<uuid>_<data>` → marca também `gira_<uuid>`.
      for (const item of rawItemsRef.current) {
        if (item.id.startsWith('gira_')) {
          const legacyPrefix = `${item.id}_`;
          for (const oldId of current) {
            if (oldId.startsWith(legacyPrefix) || oldId === item.id) updated.add(oldId);
          }
        }
      }
      persistReadIds(updated);
      return updated;
    });
  };

  const markRead = (id: string) => {
    setReadIds((current) => {
      const updated = new Set([...current, id]);
      if (id.startsWith('gira_') && id.includes('_', 5)) {
        // legado gira_uuid_data → também marca gira_uuid
        const parts = id.split('_');
        if (parts.length >= 2) updated.add(`gira_${parts[1]}`);
      } else if (id.startsWith('gira_')) {
        for (const oldId of current) {
          if (oldId.startsWith(`${id}_`)) updated.add(oldId);
        }
      }
      persistReadIds(updated);
      return updated;
    });
  };

  const dismiss = (id: string) => {
    markRead(id);
    setDismissedIds((current) => {
      const updated = new Set([...current, id]);
      const scoped = dismissKeyRef.current;
      saveNotifIdSet(scoped, updated);
      if (scoped !== NOTIF_DISMISS_KEY) saveNotifIdSet(NOTIF_DISMISS_KEY, updated);
      return updated;
    });
  };

  const openNotification = (notification: AppNotification) => {
    markRead(notification.id);
    setOpen(false);
    if (notification.id === GIRA_REMINDER_FEATURE_NOTIF_ID) {
      setFeatureModalOpen(true);
      return;
    }
    onNavigate?.(notificationTarget(notification.type, isFilho));
  };

  // Ver é ler: ao abrir (e quando a lista carrega com o painel aberto), persiste lidas.
  // Avisos de nova função ficam até clique ou “Ler todas”.
  const markPanelSeenRef = useRef(() => markAllRead({ includeFeatureAnnouncements: false }));
  markPanelSeenRef.current = () => markAllRead({ includeFeatureAnnouncements: false });
  useEffect(() => {
    if (!open) return;
    if (!rawItems.length) return;
    const timer = window.setTimeout(() => markPanelSeenRef.current(), 900);
    return () => {
      window.clearTimeout(timer);
      markPanelSeenRef.current();
    };
  }, [open, rawItems]);

  const popover = open ? (
    <motion.section
      ref={popoverRef}
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
          <button
            type="button"
            onClick={() => markAllRead({ includeFeatureAnnouncements: true })}
            className="axecloud-notification-read-all"
          >
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
                        {FEATURE_ANNOUNCEMENT_IDS.has(notification.id)
                          ? 'Novidade'
                          : timeAgo(notification.created_at)}
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
                  ? 'Os novos avisos da sua caminhada aparecerão aqui.'
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
  ) : null;

  return (
    <div
      ref={rootRef}
      className={cn(
        'axecloud-notification-root',
        placement === 'inline' ? 'is-inline' : 'is-fixed',
      )}
    >
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
        data-filho-tour="header-notificacoes"
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

      {placement === 'inline' && typeof document !== 'undefined'
        ? createPortal(<AnimatePresence>{popover}</AnimatePresence>, document.body)
        : (
          <AnimatePresence>{popover}</AnimatePresence>
        )}

      <GiraReminderFeatureModal
        open={featureModalOpen}
        onClose={() => setFeatureModalOpen(false)}
        onConfigure={() => {
          setFeatureModalOpen(false);
          requestOpenGiraReminderConfig();
          onNavigate?.('calendar');
        }}
      />
    </div>
  );
}
