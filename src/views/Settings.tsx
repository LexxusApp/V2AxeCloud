import React, { useState, useEffect } from 'react';
import { CreditCard, Globe2, Loader2, MessageCircleMore, UserRound } from 'lucide-react';
import { PortalConsulenteSettings } from '../components/settings/PortalConsulenteSettings';
import { SettingsProfilePanel } from '../components/settings/SettingsProfilePanel';
import { SettingsAccountCredentialsPanel } from '../components/settings/SettingsAccountCredentialsPanel';
import {
  SettingsDangerZone,
  SettingsSubNav,
  SettingsTabHeader,
  type SettingsSection,
} from '../components/settings/SettingsSubNav';
import { SettingsWhatsAppPanel } from '../components/settings/SettingsWhatsAppPanel';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { performFastLogout } from '../lib/logout';
import Subscription from './Subscription';
import { SettingsSubscriptionPanel } from '../components/settings/SettingsSubscriptionPanel';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';

const SECTION_COPY: Record<SettingsSection, { title: string; description: string }> = {
  profile: {
    title: 'Identidade e acesso',
    description: 'Dados do zelador, identidade da casa, foto, e-mail e senha de acesso.',
  },
  whatsapp: {
    title: 'WhatsApp e automações',
    description: 'Confira o canal oficial, escolha os avisos automáticos e acompanhe os envios recentes.',
  },
  subscription: {
    title: 'Plano e assinatura',
    description: 'Veja o plano atual, recursos disponíveis e opções para evoluir a conta.',
  },
  portal: {
    title: 'Portal público da casa',
    description: 'Defina como a casa aparece no diretório e recebe pedidos de reza.',
  },
};

const SECTION_ICON = {
  profile: UserRound,
  whatsapp: MessageCircleMore,
  subscription: CreditCard,
  portal: Globe2,
} satisfies Record<SettingsSection, typeof UserRound>;

interface SettingsProps {
  user: any;
  session?: any;
  tenantData?: any;
  onRefresh?: (newData?: { nome_terreiro?: string; foto_url?: string; cargo?: string | null }) => void | Promise<void>;
  setActiveTab: (tab: string) => void;
}

export default function Settings({ user, session, tenantData, onRefresh, setActiveTab }: SettingsProps) {
  const tenantId = tenantData?.tenant_id;
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteCurrentPassword, setDeleteCurrentPassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string>(String(user?.email || ''));
  const activeSectionCopy = SECTION_COPY[activeSection];
  const ActiveSectionIcon = SECTION_ICON[activeSection];

  useEffect(() => {
    const handleOpenSubscription = () => {
      setActiveSection('subscription');
    };

    window.addEventListener('open-subscription-tab', handleOpenSubscription);
    return () => window.removeEventListener('open-subscription-tab', handleOpenSubscription);
  }, []);

  useEffect(() => {
    setAccountEmail(String(user?.email || profile?.email || '').trim());
  }, [user?.email, profile?.email]);

  useEffect(() => {
    if (user) {
      fetchData();
      if (import.meta.env.DEV) {
        fetch('/api/ping')
          .then((res) => res.json())
          .then((data) => console.log('[DEBUG] API Ping result:', data))
          .catch((err) => console.error('[DEBUG] API Ping failed:', err));
      }
    }
    
    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [user, tenantId]);

  async function fetchData() {
    setLoading(true);
    try {
      if (!user) return;

      // Só `id` = usuário logado: `tenant_id` no estado pode ser líder/terreiro e não bater com a coluna
      // `tenant_id` da linha em `perfil_lider`, o que zerava o perfil ao voltar de outra aba.
      const { data: profileData, error: profileError } = await supabase
        .from('perfil_lider')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      } else {
        setProfile(null);
        setError('Perfil do terreiro não encontrado para esta conta.');
      }
    } catch (error: any) {
      console.error('[DEBUG] Settings fetchData error:', error);
      setError('Erro ao carregar dados: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePermanentDelete() {
    setDeleteError(null);
    const email = String(user?.email || '').trim().toLowerCase();
    const typed = deleteConfirmEmail.trim().toLowerCase();
    if (!email) {
      setDeleteError('E-mail da conta não disponível. Faça login novamente.');
      return;
    }
    if (typed !== email) {
      setDeleteError('Digite exatamente o e-mail da conta para confirmar.');
      return;
    }
    if (!deleteCurrentPassword) {
      setDeleteError('Digite sua senha atual para autorizar a exclusão.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await authFetch('/api/v1/account/permanent-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: typed, currentPassword: deleteCurrentPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Falha ao excluir (${res.status})`);
      }
      setDeleteModalOpen(false);
      await performFastLogout();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao excluir conta.';
      setDeleteError(msg);
    } finally {
      setIsDeletingAccount(false);
    }
  }

  if (loading && !profile) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <div className="settings-v5-page">
      <div className="settings-render-shell animate-fadeIn space-y-5">
        <SettingsTabHeader />

        <SettingsSubNav active={activeSection} onChange={setActiveSection} />

        <div className="flex items-start gap-3 border-b border-[#D8D0C4] pb-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#D8D0C4] bg-[#FFFDF8] text-[#2563EB] shadow-sm">
            <ActiveSectionIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9A7600]">
              Central de configuração
            </p>
            <h2 className="mt-0.5 text-lg font-black text-[#17130D]">{activeSectionCopy.title}</h2>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-[#665F55]">
              {activeSectionCopy.description}
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
        {activeSection === 'profile' ? (
          <>
            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">
                {error}
              </p>
            )}
            <SettingsProfilePanel
              user={user}
              tenantId={tenantId}
              profile={profile}
              onProfileChange={setProfile}
              onRefresh={onRefresh}
              onOpenPortal={() => setActiveSection('portal')}
            />
            <SettingsAccountCredentialsPanel
              userEmail={accountEmail}
              onEmailChanged={(email) => {
                setAccountEmail(email);
                if (profile) setProfile({ ...profile, email });
              }}
            />
            <SettingsDangerZone
              onDeleteAccount={() => {
                setDeleteConfirmEmail('');
                setDeleteError(null);
                setDeleteModalOpen(true);
              }}
            />
          </>
        ) : activeSection === 'whatsapp' ? (
          <SettingsWhatsAppPanel />
        ) : activeSection === 'subscription' ? (
          <div className="space-y-5">
            <SettingsSubscriptionPanel tenantData={tenantData} />
            <Subscription
              session={session}
              tenantData={tenantData}
              onPlanUpdated={onRefresh || (() => {})}
              onlyAvailablePlans={true}
              setActiveTab={setActiveTab}
            />
          </div>
        ) : activeSection === 'portal' ? (
          <PortalConsulenteSettings />
        ) : null}
        </div>
      </div>

      <Dialog.Root
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) {
            setDeleteConfirmEmail('');
            setDeleteCurrentPassword('');
            setDeleteError(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[201] w-[min(100vw-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-red-500/30 bg-background p-6 shadow-2xl outline-none">
            <Dialog.Title className="text-lg font-black text-red-500">
              Excluir conta e terreiro permanentemente?
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-gray-400 leading-relaxed">
              Todos os dados deste terreiro serão apagados no banco (financeiro, mural, calendário, filhos, galeria, loja, etc.),
              arquivos armazenados e as contas de acesso dos filhos. Esta ação não pode ser desfeita.
            </Dialog.Description>
            <p className="mt-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
              Digite seu e-mail para confirmar
            </p>
            <input
              type="email"
              autoComplete="off"
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              placeholder={user?.email || 'seu@email.com'}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-red-500/50"
            />
            <p className="mt-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
              Confirme sua senha atual
            </p>
            <input
              type="password"
              autoComplete="current-password"
              value={deleteCurrentPassword}
              onChange={(e) => setDeleteCurrentPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-red-500/50"
            />
            {deleteError && <p className="mt-2 text-xs font-bold text-red-400">{deleteError}</p>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-gray-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => void handlePermanentDelete()}
                className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isDeletingAccount ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Excluindo…
                  </span>
                ) : (
                  'Excluir definitivamente'
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      </div>
    </AppPageShell>
  );
}
