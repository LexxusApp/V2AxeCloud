import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, UserMinus, UsersRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showHouseToast } from '../../lib/houseToast';
import { confirmAction } from '../../lib/confirmAction';

type CoAdminItem = {
  filho_id: string;
  user_id: string | null;
  nome: string;
  email: string | null;
  cargo: string | null;
  ativo: boolean;
  cargo_delegado: string;
  updated_at: string;
};

export function SettingsPilotCoAdminPanel({
  tenantId,
  onNavigateChildren,
}: {
  tenantId?: string;
  onNavigateChildren: () => void;
}) {
  const [list, setList] = useState<CoAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function loadList() {
    if (tenantId !== 'fad75b91-d2eb-4805-b5a3-c19e8a073bed') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('piloto_listar_coadministradores', {
        p_tenant: tenantId,
      });
      if (error) throw error;
      setList(Array.isArray(data?.data) ? data.data : []);
    } catch (err: any) {
      console.error('Erro ao carregar co-administradores:', err);
      showHouseToast('Não foi possível carregar os responsáveis pelo sistema.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, [tenantId]);

  async function handleRevoke(item: CoAdminItem) {
    if (!tenantId || revokingId) return;
    const confirmed = await confirmAction({
      title: 'Revogar acesso de gestão?',
      description: `${item.nome} deixará de acessar o painel administrativo e voltará ao espaço comum de membro. Os dados da pessoa não serão apagados.`,
      confirmLabel: 'Revogar acesso',
      cancelLabel: 'Manter acesso',
      tone: 'danger',
    });
    if (!confirmed) return;

    setRevokingId(item.filho_id);
    try {
      const { error } = await supabase.rpc('piloto_definir_coadministrador', {
        p_tenant: tenantId,
        p_filho_id: item.filho_id,
        p_ativo: false,
      });
      if (error) throw error;
      showHouseToast(`Acesso de gestão revogado para ${item.nome}.`, 'success');
      await loadList();
    } catch (err: any) {
      showHouseToast(err?.message || 'Falha ao revogar o acesso. Tente novamente.', 'error');
    } finally {
      setRevokingId(null);
    }
  }

  const activeCoAdmins = list.filter((item) => item.ativo);

  return (
    <section className="settings-coadmin-card overflow-hidden rounded-2xl border border-[#D9D0C3] bg-[#FFFDF8] shadow-[0_16px_36px_-30px_rgba(53,42,25,.7)]">
      <div className="border-b border-[#E2DACE] bg-gradient-to-r from-[#173323] to-[#214B35] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#F4C430]/20 bg-[#F4C430]/10 text-[#F4C430]">
              <UsersRound className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">Responsáveis pelo sistema</h3>
                <span className="rounded-full border border-[#F4C430]/25 bg-[#F4C430]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-[#FFE58A]">
                  Piloto controlado
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-[#D5E2D8]">
                Delegue a operação diária a membros de confiança sem transferir a titularidade da casa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateChildren}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 text-xs font-black text-white transition hover:bg-white/15"
          >
            <UsersRound className="h-4 w-4" />
            Escolher membro
          </button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/10 px-3.5 py-3">
            <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#B9CCBE]">Acesso operacional</p>
            <p className="mt-1 text-xs font-bold text-white">Cadastros, rotina e módulos da casa</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/10 px-3.5 py-3">
            <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#B9CCBE]">Protegido</p>
            <p className="mt-1 text-xs font-bold text-white">Assinatura e exclusão ficam com o titular</p>
          </div>
          <div className="rounded-xl border border-[#F4C430]/20 bg-[#F4C430]/10 px-3.5 py-3">
            <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#FFE58A]">Ativos agora</p>
            <p className="mt-1 text-lg font-black text-white">{activeCoAdmins.length}</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#D8D0C4] bg-[#F8F3E9] py-8 text-xs font-bold text-[#6C6459]">
            <Loader2 className="h-4 w-4 animate-spin text-[#17633B]" />
            Carregando responsáveis…
          </div>
        ) : activeCoAdmins.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D8D0C4] bg-[#F8F3E9] px-5 py-7 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-[#17633B]" />
            <p className="mt-3 text-sm font-black text-[#252019]">Nenhum responsável delegado</p>
            <p className="mx-auto mt-1 max-w-lg text-xs font-semibold leading-relaxed text-[#706658]">
              Abra a ficha de um membro em <strong className="text-[#17633B]">Corrente</strong> e use a área
              <strong className="text-[#17633B]"> Acesso de gestão</strong> para conceder a permissão.
            </p>
            <button
              type="button"
              onClick={onNavigateChildren}
              className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#173323] px-4 text-xs font-black text-white transition hover:bg-[#22543A]"
            >
              <UsersRound className="h-4 w-4" />
              Abrir corrente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCoAdmins.map((item) => (
              <article
                key={item.filho_id}
                className="flex flex-col gap-4 rounded-xl border border-[#DED6CA] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E8F0E9] text-[#17633B]">
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-[#211C16]">{item.nome}</p>
                      <span className="rounded-full border border-[#C7DDCD] bg-[#EFF7F1] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#17633B]">
                        Acesso ativo
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-[#706658]">
                      {item.email || 'Sem e-mail cadastrado'} · {item.cargo || 'Membro da casa'}
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-[#9A7600]">{item.cargo_delegado || 'Responsável pelo sistema'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={revokingId === item.filho_id}
                  onClick={() => void handleRevoke(item)}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E6C9C3] bg-[#FFF6F4] px-3.5 text-xs font-black text-[#A54434] transition hover:bg-[#FCE9E5] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {revokingId === item.filho_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserMinus className="h-4 w-4" />
                  )}
                  Revogar acesso
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
