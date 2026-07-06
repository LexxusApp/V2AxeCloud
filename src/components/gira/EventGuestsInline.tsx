import { useEffect, useState } from 'react';
import { Loader2, Smartphone, UserPlus, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { authFetch } from '../../lib/authenticatedFetch';
import { hasPlanAccess, hasPremiumTierFeatures } from '../../constants/plans';
import { AppPrimaryButton, appInputClass } from '../ui/appDemoUi';

type Guest = {
  id: string;
  nome: string;
  telefone?: string | null;
  status: 'Confirmado' | 'Pendente' | 'Check-in' | 'Recusado';
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

  async function fetchGuests() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('convidados_eventos')
        .select('id, nome, telefone, status, rsvp_token')
        .eq('event_id', eventId);
      if (error) throw error;
      setGuests(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchGuests();
  }, [eventId]);

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
        .select()
        .single();
      if (error) throw error;
      setGuests([...guests, data]);
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

  async function updateGuestStatus(guestId: string, status: Guest['status']) {
    try {
      await supabase.from('convidados_eventos').update({ status }).eq('id', guestId);
      setGuests(guests.map((g) => (g.id === guestId ? { ...g, status } : g)));
    } catch {
      alert('Erro ao atualizar status.');
    }
  }

  async function removeGuest(guestId: string) {
    try {
      await supabase.from('convidados_eventos').delete().eq('id', guestId);
      setGuests(guests.filter((g) => g.id !== guestId));
    } catch {
      alert('Erro ao remover.');
    }
  }

  const filtered = guests.filter((g) => g.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#94A3B8]">Convidados externos</p>
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
              <p className="truncate text-sm font-bold text-white">{guest.nome}</p>
              {guest.telefone ? (
                <p className="flex items-center gap-1 text-[10px] text-gray-500">
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
