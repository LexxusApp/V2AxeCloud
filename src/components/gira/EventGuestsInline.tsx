import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Smartphone, UserPlus, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { authFetch } from '../../lib/authenticatedFetch';
import { hasPlanAccess, hasPremiumTierFeatures } from '../../constants/plans';
import { AppPrimaryButton, appInputClass } from '../ui/appDemoUi';

type GuestStatus = 'Confirmado' | 'Pendente' | 'Check-in' | 'Recusado';

type Guest = {
  id: string;
  nome: string;
  telefone?: string | null;
  status: GuestStatus;
  rsvp_token?: string | null;
  rsvp_responded_at?: string | null;
};

type Props = {
  eventId: string;
  eventTitle: string;
  eventData: string;
  eventHora: string;
  eventDescricao?: string;
  bannerUrl?: string | null;
  tenantId: string;
  tenantPlan?: string;
  isGlobalAdmin?: boolean;
};

function normalizeGuestStatus(raw: string | null | undefined): GuestStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'confirmado' || s === 'confirmed') return 'Confirmado';
  if (s === 'recusado' || s === 'declined' || s === 'recusada') return 'Recusado';
  if (s === 'check-in' || s === 'checkin' || s === 'presente') return 'Check-in';
  return 'Pendente';
}

function statusBadgeClass(status: GuestStatus): string {
  if (status === 'Confirmado') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
  if (status === 'Recusado') return 'bg-red-500/15 text-red-400 border-red-500/25';
  if (status === 'Check-in') return 'bg-sky-500/15 text-sky-300 border-sky-500/25';
  return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
}

export function EventGuestsInline({
  eventId,
  eventTitle,
  eventData,
  eventHora,
  eventDescricao,
  tenantId,
  tenantPlan,
  isGlobalAdmin,
}: Props) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const isPremium = hasPremiumTierFeatures(tenantPlan);
  const hasWhatsApp = hasPlanAccess(tenantPlan, 'whatsapp_invites', isGlobalAdmin);

  const fetchGuests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('convidados_eventos')
        .select('id, nome, telefone, status, rsvp_token, rsvp_responded_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setGuests(
        (data || []).map((row) => ({
          ...row,
          status: normalizeGuestStatus(row.status),
        })) as Guest[],
      );
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void fetchGuests();
  }, [fetchGuests]);

  // Atualiza quando o zelador deixa a aba aberta e o convidado confirma pelo link.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchGuests(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void fetchGuests(true), 15000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [fetchGuests]);

  async function addGuest() {
    if (!newGuestName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('convidados_eventos')
        .insert({
          event_id: eventId,
          nome: newGuestName.trim(),
          telefone: newGuestPhone.trim() ? newGuestPhone.trim().replace(/\D/g, '') : null,
          status: 'Pendente',
        })
        .select('id, nome, telefone, status, rsvp_token, rsvp_responded_at')
        .single();
      if (error) throw error;
      setGuests([
        ...guests,
        { ...data, status: normalizeGuestStatus(data.status) } as Guest,
      ]);
      if (isPremium && newGuestPhone.trim()) {
        try {
          const waRes = await authFetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantId,
              tipo: 'convite_evento',
              forcePhone: newGuestPhone.trim(),
              variables: {
                event_id: eventId,
                nome_convidado: newGuestName.trim(),
                nome_evento: eventTitle,
                data_evento: eventData,
                hora_evento: eventHora,
                local_evento: eventDescricao || 'A confirmar',
                rsvp_token: String(data?.rsvp_token || ''),
              },
            }),
          });
          if (!waRes.ok) console.warn('WhatsApp convite falhou');
        } catch {
          /* opcional */
        }
      }
      setNewGuestName('');
      setNewGuestPhone('');
    } catch {
      alert('Erro ao adicionar convidado.');
    }
  }

  async function updateGuestStatus(guestId: string, status: GuestStatus) {
    try {
      await supabase.from('convidados_eventos').update({ status }).eq('id', guestId);
      setGuests(guests.map((g) => (g.id === guestId ? { ...g, status } : g)));
    } catch {
      alert('Erro ao atualizar status.');
    }
  }

  async function removeGuest(guestId: string) {
    const guest = guests.find((g) => g.id === guestId);
    const warn =
      guest?.telefone && guest?.rsvp_token
        ? `Remover ${guest.nome}? O link de confirmação já enviado no WhatsApp deixa de funcionar.`
        : `Remover ${guest?.nome || 'este convidado'}?`;
    if (!window.confirm(warn)) return;
    try {
      await supabase.from('convidados_eventos').delete().eq('id', guestId);
      setGuests(guests.filter((g) => g.id !== guestId));
    } catch {
      alert('Erro ao remover.');
    }
  }

  const counts = useMemo(() => {
    let confirmados = 0;
    let pendentes = 0;
    let recusados = 0;
    let checkin = 0;
    for (const g of guests) {
      if (g.status === 'Confirmado') confirmados += 1;
      else if (g.status === 'Recusado') recusados += 1;
      else if (g.status === 'Check-in') checkin += 1;
      else pendentes += 1;
    }
    return { confirmados, pendentes, recusados, checkin };
  }, [guests]);

  const filtered = guests
    .filter((g) => g.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const rank = (s: GuestStatus) =>
        s === 'Check-in' ? 0 : s === 'Confirmado' ? 1 : s === 'Pendente' ? 2 : 3;
      return rank(a.status) - rank(b.status) || a.nome.localeCompare(b.nome, 'pt-BR');
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#94A3B8]">
          Convidados externos
        </p>
        <button
          type="button"
          onClick={() => void fetchGuests()}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-[#94A3B8] hover:text-white"
          title="Atualizar respostas RSVP"
        >
          <RefreshCw className="h-3 w-3" />
          Atualizar
        </button>
      </div>

      {guests.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
            {counts.confirmados} confirmado{counts.confirmados === 1 ? '' : 's'}
          </span>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-300">
            {counts.pendentes} pendente{counts.pendentes === 1 ? '' : 's'}
          </span>
          {counts.recusados > 0 ? (
            <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-red-400">
              {counts.recusados} recusado{counts.recusados === 1 ? '' : 's'}
            </span>
          ) : null}
          {counts.checkin > 0 ? (
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-sky-300">
              {counts.checkin} check-in
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 sm:flex-row">
        <input
          type="text"
          value={newGuestName}
          onChange={(e) => setNewGuestName(e.target.value)}
          placeholder="Nome do convidado"
          className={cn(appInputClass, 'flex-1 py-2 text-sm')}
        />
        {hasWhatsApp ? (
          <input
            type="tel"
            value={newGuestPhone}
            onChange={(e) => setNewGuestPhone(e.target.value)}
            placeholder="WhatsApp"
            className={cn(appInputClass, 'flex-1 py-2 text-sm')}
          />
        ) : null}
        <AppPrimaryButton type="button" className="shrink-0" onClick={() => void addGuest()}>
          <UserPlus className="h-4 w-4" />
        </AppPrimaryButton>
      </div>
      {guests.length > 3 ? (
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar convidado…"
          className={cn(appInputClass, 'py-2 text-sm')}
        />
      ) : null}
      {loading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Nenhum convidado externo.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((guest) => (
            <div
              key={guest.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#1E242B] bg-[#0D0F12] px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-bold text-white">{guest.nome}</p>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide',
                      statusBadgeClass(guest.status),
                    )}
                  >
                    {guest.status === 'Confirmado' ? <CheckCircle2 className="h-3 w-3" /> : null}
                    {guest.status === 'Recusado' ? <XCircle className="h-3 w-3" /> : null}
                    {guest.status}
                  </span>
                </div>
                {guest.telefone ? (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                    <Smartphone className="h-3 w-3" />
                    {guest.telefone}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {guest.status !== 'Check-in' ? (
                  <button
                    type="button"
                    onClick={() => void updateGuestStatus(guest.id, 'Check-in')}
                    className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary"
                  >
                    Check-in
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void removeGuest(guest.id)}
                  className="rounded p-1 text-gray-500 hover:text-red-400"
                  aria-label="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
