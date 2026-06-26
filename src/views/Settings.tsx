import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { PortalConsulenteSettings } from '../components/settings/PortalConsulenteSettings';
import { SettingsProfilePanel } from '../components/settings/SettingsProfilePanel';
import { SettingsSubNav, SettingsTabHeader, type SettingsSection } from '../components/settings/SettingsSubNav';
import { SettingsWhatsAppPanel } from '../components/settings/SettingsWhatsAppPanel';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { performFastLogout } from '../lib/logout';
import Subscription from './Subscription';
import { SettingsSubscriptionPanel } from '../components/settings/SettingsSubscriptionPanel';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import { AppDemoCard } from '../components/ui/appDemoUi';

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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenSubscription = () => {
      setActiveSection('subscription');
    };

    window.addEventListener('open-subscription-tab', handleOpenSubscription);
    return () => window.removeEventListener('open-subscription-tab', handleOpenSubscription);
  }, []);

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

    setIsDeletingAccount(true);
    try {
      const res = await authFetch('/api/v1/account/permanent-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: typed }),
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
      <div className="animate-fadeIn space-y-6 text-[#F1F5F9]">
        <SettingsTabHeader />

        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SettingsSubNav
              active={activeSection}
              onChange={setActiveSection}
              onDeleteAccount={() => {
                setDeleteConfirmEmail('');
                setDeleteError(null);
                setDeleteModalOpen(true);
              }}
            />
          </div>

          <div className="min-w-0 space-y-10 lg:col-span-9">
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
            </>
          ) : activeSection === 'whatsapp' ? (
            <SettingsWhatsAppPanel />
          ) : activeSection === 'subscription' ? (
            <SettingsSubscriptionPanel tenantData={tenantData} />
          ) : activeSection === 'portal' ? (
            <AppDemoCard>
              <PortalConsulenteSettings />
            </AppDemoCard>
          ) : null}
          </div>
        </div>
      </div>

      {activeSection === 'subscription' && (
        <div className="mt-12 w-full">
          <Subscription 
            session={session} 
            tenantData={tenantData} 
            onPlanUpdated={onRefresh || (() => {})} 
            onlyAvailablePlans={true} 
            setActiveTab={setActiveTab}
          />
        </div>
      )}

      <Dialog.Root
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) {
            setDeleteConfirmEmail('');
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
              ficheiros no armazenamento e as contas de autenticação dos filhos com login. Esta ação não pode ser desfeita.
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
    </AppPageShell>
  );
}
