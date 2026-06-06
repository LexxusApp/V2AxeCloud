import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';

import Sidebar from './components/Sidebar';
import FilhoSidebar from './components/FilhoSidebar';
import SubscriptionLock from './components/SubscriptionLock';
import { supabase } from './lib/supabase';
import { authFetch } from './lib/authenticatedFetch';
import { Session } from '@supabase/supabase-js';
import { Loader2, Menu, ShieldAlert, Bell } from 'lucide-react';
import NotificationPanel from './components/NotificationPanel';
import { cn } from './lib/utils';
import { hasPlanAccess, isLifetimePlan } from './constants/plans';
import Paywall from './components/Paywall';

// === Fase 2: Code splitting ===
// Views pesadas viram chunks separados, carregados sob demanda.
// Reduz o bundle inicial em ~40-60% e acelera o primeiro paint.
const Dashboard = lazy(() => import('./views/Dashboard'));
const Children = lazy(() => import('./views/Children'));
const Calendar = lazy(() => import('./views/Calendar'));
const Financial = lazy(() => import('./views/Financial'));
const Inventory = lazy(() => import('./views/Inventory'));
const Gallery = lazy(() => import('./views/Gallery.tsx'));
const NoticeBoard = lazy(() => import('./views/NoticeBoard'));
const Settings = lazy(() => import('./views/Settings'));
const ChildProfile = lazy(() => import('./views/ChildProfile'));
const PerfilFilho = lazy(() => import('./views/PerfilFilho'));
const Library = lazy(() => import('./views/Library'));
const MensalidadeFilho = lazy(() => import('./views/MensalidadeFilho'));
const Store = lazy(() => import('./views/Store'));
const Subscription = lazy(() => import('./views/Subscription'));
const Atendimentos = lazy(() => import('./views/Atendimentos'));
const Camarinha = lazy(() => import('./views/Camarinha'));
import { useWebPush } from './hooks/useWebPush';
import { SYSTEM_VERSION as BASE_SYSTEM_VERSION } from './config/version';
import {
  clearCachedTenantIdForUser,
  peekCachedTenantId,
  readCachedTenantIdForUser,
  writeCachedTenantIdForUser,
} from './lib/tenantCache';
import { resolveTenantFromSupabase } from './lib/resolveTenantFromSupabase';
import { PwaInstallTopbarButton } from './components/PwaInstallTopbarButton';
import LegalTermsModal from './components/LegalTermsModal';
import AppFooter from './components/AppFooter';
import { AuthScreenBackground } from './components/AuthScreenBackground';
import { CURRENT_LEGAL_TERMS_VERSION } from './config/legal';
import {
  hasAcceptedLegalTerms,
  writeLocalLegalAcceptance,
} from './lib/legalTerms';
import {
  performFastLogout,
  performVersionBumpLogout,
  emergencyAuthCircuitBreaker,
  performEmergencyClientReset,
} from './lib/logout';
import { goToLogin } from './lib/navigation';

const FILHO_ALLOWED_TABS = new Set(['profile', 'perfil', 'financial', 'calendar', 'library', 'store', 'mural']);
const FILHO_FLAG_KEY = 'axecloud_is_filho';
const FILHO_FLAG_USER_KEY = 'axecloud_is_filho_user_id';
const TENANT_ANCHOR_KEY = 'tenant_id';
const USER_ROLE_KEY = 'axecloud_user_role';
let isSessionReadyGlobal = false;
export function getIsSessionReady() {
  return isSessionReadyGlobal;
}

// Versionamento centralizado em src/config/version.ts (formato numérico contínuo).
const SYSTEM_VERSION = BASE_SYSTEM_VERSION + 77;

function readTenantAnchorFromStorage() {
  try {
    const raw = localStorage.getItem(TENANT_ANCHOR_KEY);
    const value = String(raw || '').trim();
    return value || null;
  } catch {
    return null;
  }
}

function writeTenantAnchorToStorage(tenantId?: string | null) {
  const value = String(tenantId || '').trim();
  try {
    if (value) {
      localStorage.setItem(TENANT_ANCHOR_KEY, value);
    } else {
      localStorage.removeItem(TENANT_ANCHOR_KEY);
    }
  } catch {
    // no-op
  }
}

function readUserRoleAnchor() {
  try {
    const raw = String(localStorage.getItem(USER_ROLE_KEY) || '').toLowerCase().trim();
    if (raw === 'filho' || raw === 'admin') return raw;
    return null;
  } catch {
    return null;
  }
}

function writeUserRoleAnchor(role?: 'admin' | 'filho' | null) {
  try {
    if (!role) {
      localStorage.removeItem(USER_ROLE_KEY);
      return;
    }
    localStorage.setItem(USER_ROLE_KEY, role);
  } catch {
    // no-op
  }
}

function readPersistedFilhoFlag(userId?: string | null) {
  try {
    const isFilho = localStorage.getItem(FILHO_FLAG_KEY) === 'true';
    if (!isFilho) return false;
    if (!userId) return true;
    const flaggedUserId = localStorage.getItem(FILHO_FLAG_USER_KEY);
    return !flaggedUserId || flaggedUserId === userId;
  } catch {
    return false;
  }
}

function persistFilhoFlag(isFilho: boolean, userId?: string | null) {
  try {
    if (isFilho) {
      localStorage.setItem(FILHO_FLAG_KEY, 'true');
      if (userId) localStorage.setItem(FILHO_FLAG_USER_KEY, userId);
      return;
    }
    localStorage.removeItem(FILHO_FLAG_KEY);
    localStorage.removeItem(FILHO_FLAG_USER_KEY);
  } catch {
    // no-op
  }
}

function normalizeFilhoTab(tab: string) {
  return FILHO_ALLOWED_TABS.has(tab) ? tab : 'profile';
}

function isFilhoIdentity(user?: { email?: string | null; user_metadata?: any } | null, emailFallback?: string, roleFallback?: string) {
  const role = String(user?.user_metadata?.role || roleFallback || '').toLowerCase().trim();
  const email = String(user?.email || emailFallback || '').toLowerCase().trim();
  return role === 'filho' || (email.startsWith('f_') && email.endsWith('@axecloud.internal'));
}

export type AppSurface = 'login' | 'dashboard';

export default function App({ surface = 'dashboard' }: { surface?: AppSurface }) {
  // Prioridade máxima: lê âncora de tenant no topo do ciclo de render, antes de effects.
  const earlyTenantAnchor = readTenantAnchorFromStorage();
  const earlyRoleAnchor = readUserRoleAnchor();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [subscriptionActive, setSubscriptionActive] = useState(true);
  const [isAdminGlobal, setIsAdminGlobal] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'filho' | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [tenantData, setTenantData] = useState<{ 
    nome: string; 
    plan: string; 
    tenant_id?: string;
    expires_at?: string;
    status?: string;
    foto_url?: string;
    cargo?: string | null;
    role?: string | null;
    tradicao?: string | null;
  } | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [filhoFotoUrl, setFilhoFotoUrl] = useState<string | null>(null);
  /** Falha ao recuperar tenant após API + fallback (evita shell “zumbi”). */
  const [tenantRecoveryFailed, setTenantRecoveryFailed] = useState(false);
  const [isSessionHydrating, setIsSessionHydrating] = useState(false);
  const [sessionExpiredState, setSessionExpiredState] = useState(false);
  /** Evita recoverTenantAfterFailure em loop quando userRole não hidrata. */
  const roleRecoveryOnceForUserRef = useRef<string | null>(null);
  const [showConnectionResetCta, setShowConnectionResetCta] = useState(false);
  const [tenantAnchorId, setTenantAnchorId] = useState<string | null>(earlyTenantAnchor);
  const [roleAnchor, setRoleAnchor] = useState<'admin' | 'filho' | null>(
    earlyRoleAnchor === 'filho' || earlyRoleAnchor === 'admin' ? earlyRoleAnchor : null
  );
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [legalTermsAccepted, setLegalTermsAccepted] = useState<boolean | null>(null);
  const [legalTermsAccepting, setLegalTermsAccepting] = useState(false);
  const lastAuthUserIdRef = useRef<string | null>(null);

  const isFilhoForPush = userRole === 'filho';
  const { permission, subscribe, loading: pushLoading } = useWebPush(
    session?.user?.id || null,
    tenantData?.tenant_id || null,
    isFilhoForPush
  );

  const initializedRef = useRef(false);
  const authFirstEventHandledRef = useRef(false);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const pendingFilhoHydration = useMemo(
    () =>
      !!session?.user &&
      (readPersistedFilhoFlag(session.user.id) || roleAnchor === 'filho') &&
      (userRole !== 'filho' || tenantData?.role !== 'filho'),
    [session?.user, userRole, roleAnchor, tenantData?.role]
  );

  const effectiveTenantId = useMemo(
    () => String(tenantData?.tenant_id || tenantAnchorId || '').trim() || null,
    [tenantData?.tenant_id, tenantAnchorId]
  );

  const blockingSpinnerActive = useMemo(() => {
    if (isInitializing || loading) return true;
    if (!session?.user) return false;
    if (tenantRecoveryFailed) return false;
    return (
      isSessionHydrating ||
      !userRole ||
      pendingFilhoHydration ||
      (!!userRole && !effectiveTenantId)
    );
  }, [
    isInitializing,
    loading,
    session?.user,
    tenantRecoveryFailed,
    isSessionHydrating,
    userRole,
    pendingFilhoHydration,
    effectiveTenantId,
  ]);

  useEffect(() => {
    const ready =
      !!session?.user &&
      !!userRole &&
      !!effectiveTenantId &&
      !(roleAnchor === 'filho' && userRole !== 'filho');
    isSessionReadyGlobal = ready;
    setIsSessionReady(ready);
  }, [session?.user, userRole, effectiveTenantId, roleAnchor]);

  useEffect(() => {
    const liveTenant = String(tenantData?.tenant_id || '').trim();
    if (liveTenant) {
      writeTenantAnchorToStorage(liveTenant);
      setTenantAnchorId(liveTenant);
      return;
    }
    if (!session?.user) {
      writeTenantAnchorToStorage(null);
      setTenantAnchorId(null);
    }
  }, [tenantData?.tenant_id, session?.user?.id]);

  useEffect(() => {
    if (userRole) {
      writeUserRoleAnchor(userRole);
      setRoleAnchor(userRole);
      return;
    }
    if (!session?.user) {
      writeUserRoleAnchor(null);
      setRoleAnchor(null);
    }
  }, [userRole, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (tenantData?.tenant_id) return;
    if (!tenantAnchorId) return;
    setTenantData((prev) =>
      prev
        ? { ...prev, tenant_id: tenantAnchorId }
        : {
            nome: '',
            plan: 'premium',
            tenant_id: tenantAnchorId,
            role: userRole ?? undefined,
          }
    );
  }, [session?.user?.id, tenantData?.tenant_id, tenantAnchorId, userRole]);

  useEffect(() => {
    if (!blockingSpinnerActive) {
      setShowConnectionResetCta(false);
      return;
    }
    const id = window.setTimeout(() => setShowConnectionResetCta(true), 8000);
    return () => {
      window.clearTimeout(id);
    };
  }, [blockingSpinnerActive]);

  useEffect(() => {
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
  }, []);

  // Safety global: se o spinner inicial ficar travado (auth listener nunca finalizar,
  // lock do Supabase entre abas, etc.), libera para a UI poder seguir — Login se sem sessão,
  // recovery/erro se com sessão sem tenant. Evita "tela de loading eterna" ao reabrir o app.
  useEffect(() => {
    if (!isInitializing) return;
    const id = window.setTimeout(() => {
      console.warn('[SYSTEM] isInitializing > 6s — forçando liberação do spinner.');
      authFirstEventHandledRef.current = true;
      setIsInitializing(false);
      setLoading(false);
      setIsSessionHydrating(false);
    }, 6000);
    return () => window.clearTimeout(id);
  }, [isInitializing]);

  useEffect(() => {
    const handleSessionExpired = async () => {
      try {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('axecloud_version', SYSTEM_VERSION);
      } catch {
        // no-op
      }
      persistFilhoFlag(false);
      writeTenantAnchorToStorage(null);
      writeUserRoleAnchor(null);
      setTenantAnchorId(null);
      setRoleAnchor(null);
      setTenantData(null);
      setUserRole(null);
      setSessionExpiredState(true);
      setLoading(false);
      setIsInitializing(false);
      setIsSessionHydrating(false);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // no-op
      }
    };

    const onExpired = () => {
      void handleSessionExpired();
    };
    window.addEventListener('axecloud:session-expired', onExpired as EventListener);
    return () => window.removeEventListener('axecloud:session-expired', onExpired as EventListener);
  }, []);

  /** Ao voltar para a aba: re-hidrata sessão se o estado React perdeu o user mas o storage ainda tem sessão. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!s?.user) return;
        setSession((prev) => (prev?.user?.id ? prev : s));
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      try {
        if (sessionStorage.getItem('axecloud_critical_txn') !== '1') return;
      } catch {
        return;
      }
      event.preventDefault();
      event.returnValue = 'Uma transação importante está em andamento.';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /**
   * Após falha do tenant-info ou timeout: valida sessão real com getSession(),
   * hidrata tenant do cache ou resolveTenantFromSupabase. Filho sem vínculo não recebe tenant_id falso.
   */
  const recoverTenantAfterFailure = async (
    userId: string,
    userEmail?: string | null,
    authRole?: string
  ): Promise<boolean> => {
    setTenantRecoveryFailed(false);
    try {
      const {
        data: { session: fresh },
      } = await supabase.auth.getSession();
      if (!fresh?.user || fresh.user.id !== userId) {
        setSession(null);
        setTenantData(null);
        setUserRole(null);
        lastAuthUserIdRef.current = null;
        return false;
      }

      const persistedFilho = readPersistedFilhoFlag(userId);
      let tid = readCachedTenantIdForUser(userId);
      if (!tid) {
        tid = await resolveTenantFromSupabase(userId, userEmail ?? undefined);
        if (tid) writeCachedTenantIdForUser(userId, tid);
      }

      const isFilhoAuth = persistedFilho || isFilhoIdentity(fresh.user, undefined, authRole);
      persistFilhoFlag(isFilhoAuth, userId);

      if (tid) {
        setSession(fresh);
        setUserRole(isFilhoAuth ? 'filho' : 'admin');
        writeUserRoleAnchor(isFilhoAuth ? 'filho' : 'admin');
        setRoleAnchor(isFilhoAuth ? 'filho' : 'admin');
        setTenantData({
          nome: '',
          plan: 'premium',
          tenant_id: tid,
          role: isFilhoAuth ? 'filho' : 'admin',
        });
        setSubscriptionActive(true);
        setIsAdminGlobal(false);
        setLegalTermsAccepted(
          isFilhoAuth ? true : hasAcceptedLegalTerms(userId, null) ? true : false
        );
        if (isFilhoAuth) {
          setActiveTab((prev) => normalizeFilhoTab(prev));
        }
        return true;
      }

      if (!isFilhoAuth) {
        writeCachedTenantIdForUser(userId, userId);
        setSession(fresh);
        setUserRole('admin');
        writeUserRoleAnchor('admin');
        setRoleAnchor('admin');
        setTenantData({
          nome: '',
          plan: 'premium',
          tenant_id: userId,
          role: 'admin',
        });
        setSubscriptionActive(true);
        setIsAdminGlobal(false);
        setLegalTermsAccepted(hasAcceptedLegalTerms(userId, null) ? true : false);
        return true;
      }

      setTenantRecoveryFailed(true);
      return false;
    } catch (e) {
      console.error('[recoverTenantAfterFailure]', e);
      setTenantRecoveryFailed(true);
      return false;
    }
  };

  const loadAllTenantData = async (
    userId: string,
    userEmail?: string,
    authRole?: string,
    accessToken?: string | null
  ) => {
    // Timeouts curtos: melhor cair pro cache+recovery do que travar a UI.
    // Quem ja tem cache hidratado nao ve o spinner — esse fetch e essencialmente
    // "background refresh" da maioria das vezes.
    let retries = 2;
    const isFilhoAuth = readPersistedFilhoFlag(userId) || isFilhoIdentity(null, userEmail, authRole);
    persistFilhoFlag(isFilhoAuth, userId);

    if (!isFilhoAuth && hasAcceptedLegalTerms(userId, null)) {
      setLegalTermsAccepted(true);
    }

    const cachedSnap = peekCachedTenantId(userId);
    if (cachedSnap) {
      setTenantData((prev) => ({
        nome: prev?.nome ?? '',
        plan: prev?.plan ?? 'premium',
        tenant_id: cachedSnap,
        expires_at: prev?.expires_at,
        status: prev?.status,
        foto_url: prev?.foto_url,
        cargo: prev?.cargo ?? undefined,
        role: prev?.role ?? undefined,
      }));
    }

    // Aborta fetches em andamento quando o safety timeout dispara, para destravar o await principal.
    const safetyAbort = new AbortController();
    let safetyFired = false;

    // Safety Net: Garantia de que o loader sairá em no máximo 6s.
    const safetyTimeout = setTimeout(() => {
      safetyFired = true;
      console.warn('[SYSTEM] Safety timeout (6s) — caindo para recuperação por cache/Supabase.');
      try {
        safetyAbort.abort();
      } catch {
        /* noop */
      }
      void recoverTenantAfterFailure(userId, userEmail, authRole).then((ok) => {
        if (!ok) setTenantRecoveryFailed(true);
      });
    }, 6000);

    try {
      setTenantRecoveryFailed(false);
      while (retries > 0) {
        try {
          const url = `/api/tenant-info?userId=${userId}&email=${encodeURIComponent(userEmail || '')}`;
          // Cada tentativa tem hard timeout próprio (3.5s) e também respeita o safety global.
          const perAttempt = AbortSignal.timeout(3500);
          const signal = AbortSignal.any
            ? AbortSignal.any([perAttempt, safetyAbort.signal])
            : perAttempt;
          const response = await authFetch(url, { signal }, accessToken ?? undefined);
          
          if (response.status === 403) {
            const errorData = await response.json();
            if (errorData.status === 'blocked') setIsBlocked(true);
            if (errorData.status === 'deleted') setIsDeleted(true);
            return;
          }

          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();

          // Reset block/delete states on successful load
          setIsBlocked(false);
          setIsDeleted(false);

        // 1. Role & Admin Status
        // Normaliza: apenas 'filho' é tratado como filho — qualquer outro valor (admin, lider, zelador, etc.) é gestor.
        const rawRole = (data.role || 'admin').toLowerCase().trim();
        const role: 'admin' | 'filho' = rawRole === 'filho' || isFilhoAuth ? 'filho' : 'admin';
        setUserRole(role);
        writeUserRoleAnchor(role);
        setRoleAnchor(role);
        persistFilhoFlag(role === 'filho', userId);
        const termsOk =
          role === 'filho' ||
          hasAcceptedLegalTerms(userId, data.terms_accepted_version as string | undefined);
        setLegalTermsAccepted(role === 'filho' ? true : termsOk);
        
        // 2. Tenant Info
        const plan = (data.plan || 'premium').toLowerCase().trim();
        const isGlobalAdmin = !!data.is_admin_global;
        let nome = data.nome_terreiro || (role === 'filho' ? '' : 'Meu Terreiro');
        let tenantId = role === 'filho' ? (data.tenant_id || '') : (data.tenant_id || userId);
        let tenantFotoUrl = data.foto_url;

          // Filhos podem acessar direto sem passar pelo Dashboard do zelador.
          // Por isso resolvemos o terreiro pelo vínculo do filho antes de montar as abas.
          if (role === 'filho') {
            let { data: childData, error: childError } = await supabase
              .from('filhos_de_santo')
              .select('id, foto_url, lider_id, tenant_id')
              .eq('user_id', userId)
              .maybeSingle();

            if (!childData && userEmail) {
              const byEmail = await supabase
                .from('filhos_de_santo')
                .select('id, foto_url, lider_id, tenant_id')
                .eq('email', userEmail)
                .maybeSingle();
              childData = byEmail.data;
              childError = byEmail.error;
            }
            
            if (childError) {
              console.error("Erro ao buscar vínculo de filho:", childError);
            } else if (childData) {
              setSelectedChildId(childData.id);
              setFilhoFotoUrl(childData.foto_url || null);

              const profileFilters = [
                childData.lider_id ? `id.eq.${childData.lider_id}` : null,
                childData.tenant_id ? `tenant_id.eq.${childData.tenant_id}` : null,
                childData.tenant_id ? `id.eq.${childData.tenant_id}` : null,
              ].filter(Boolean).join(',');

              if (profileFilters) {
                const { data: leaderProfile, error: leaderError } = await supabase
                  .from('perfil_lider')
                  .select('id, nome_terreiro, tenant_id, foto_url')
                  .or(profileFilters)
                  .maybeSingle();

                if (leaderError) {
                  console.error("Erro ao buscar terreiro do filho:", leaderError);
                } else if (leaderProfile) {
                  nome = leaderProfile.nome_terreiro || nome;
                  tenantId = leaderProfile.tenant_id || leaderProfile.id || childData.lider_id || childData.tenant_id || tenantId;
                  tenantFotoUrl = leaderProfile.foto_url || tenantFotoUrl;
                } else {
                  tenantId = childData.lider_id || childData.tenant_id || tenantId;
                }
              } else {
                tenantId = childData.lider_id || childData.tenant_id || tenantId;
              }
            }
          }
        
        setTenantData({ 
          nome, 
          plan, 
          tenant_id: String(tenantId || '').trim() || undefined,
          expires_at: data.expires_at,
          status: data.status,
          foto_url: tenantFotoUrl,
          cargo: data.cargo ?? undefined,
          role: role,
          tradicao: data.tradicao || 'mista',
        });
        if (String(tenantId || '').trim()) {
          writeCachedTenantIdForUser(userId, String(tenantId));
        }

          setIsAdminGlobal(isGlobalAdmin);

          if (activeTab === 'admin') {
            setActiveTab('dashboard');
          }

          // Se for filho, garante que ele caia no Perfil (profile)
          if (role === 'filho') {
            setActiveTab(prev => normalizeFilhoTab(prev));
          }

          // 3. Subscription (Filhos de Santo não precisam de assinatura ativa)
          if (isGlobalAdmin || role === 'filho') {
            setSubscriptionActive(true);
          } else if (isLifetimePlan(plan)) {
            // Planos vitalícios (vita/cortesia): ativo se status for 'active' ou se não houver registro de assinatura
            setSubscriptionActive(!data.status || data.status === 'active');
          } else if (!data.status || data.status === 'pending') {
            setSubscriptionActive(false);
          } else if (!data.expires_at) {
            setSubscriptionActive(false);
          } else {
            const now = new Date();
            const expiresAt = new Date(data.expires_at);
            const isActive = data.status === 'active' && expiresAt > now;
            setSubscriptionActive(isActive);
          }

          return; 

        } catch (err: any) {
          console.warn(`[WARN] Recuperando Tenant (Tentativa ${4 - retries}): ${err?.message || 'Failed to fetch'}`);
          // Se o safety timeout já disparou, não adianta retentar — recovery já foi acionado em paralelo.
          if (safetyFired) {
            return;
          }
          const {
            data: { session: alive },
          } = await supabase.auth.getSession();
          if (!alive?.user) {
            setSession(null);
            setTenantData(null);
            setUserRole(null);
            lastAuthUserIdRef.current = null;
            return;
          }
          retries--;

          if (retries > 0) {
            // Atraso breve antes de tentar novamente — total maximo ~7s para 2 tentativas.
            await new Promise(resolve => setTimeout(resolve, 600));
            continue;
          }

          // Nunca exibir tela de assinatura/lock só porque a API caiu (5xx) ou rede falhou
          console.warn('[WARN] tenant-info indisponível — validando sessão e recuperando tenant.');
          const recovered = await recoverTenantAfterFailure(userId, userEmail, authRole);
          if (!recovered) setTenantRecoveryFailed(true);
          return;
        }
      }
    } finally {
      clearTimeout(safetyTimeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    const markAuthInitialized = () => {
      if (authFirstEventHandledRef.current) return;
      authFirstEventHandledRef.current = true;
      setIsInitializing(false);
    };

    const initializeAuth = async () => {
      const lastVersion = localStorage.getItem('axecloud_version');

      if (lastVersion !== SYSTEM_VERSION) {
        // SOFT version bump: apenas registra a nova versão e segue o fluxo normal.
        // A sessão Supabase é preservada — o novo bundle JS já foi carregado pelo SW
        // (src/main.tsx → onNeedRefresh fez o reload). O usuário NÃO é deslogado.
        console.log('[SYSTEM] Nova versão detectada (soft):', SYSTEM_VERSION);
        void performVersionBumpLogout(SYSTEM_VERSION);
      }

      // getSession() pode demorar com aba em segundo plano (throttling de timer/rede)
      // ou fila de lock entre abas. O lock resiliente em src/lib/supabase.ts evita espera infinita.
      // Importante: NUNCA retornar "sessão null" por timeout — isso apagava o estado React e
      // parecia logout espúrio mesmo com tokens válidos no localStorage (Promise.race antigo).
      const sessionPromise = supabase.auth.getSession();
      const slowLog = window.setTimeout(() => {
        console.warn(
          '[SYSTEM] getSession inicial > 5.5s — possível aba em background ou rede lenta; aguardando resultado real (sem deslogar).'
        );
      }, 5500);
      const {
        data: { session: initialSession },
      } = await sessionPromise;
      window.clearTimeout(slowLog);
      if (initialSession?.user) {
        setSession(initialSession);
        lastAuthUserIdRef.current = initialSession.user.id;
        // Hidratação otimista: se ja temos cache de tenant + role no localStorage,
        // renderizamos a UI IMEDIATAMENTE com cache e o fetch de /api/tenant-info
        // roda em background. Evita "spinner amarelo" em mobile com rede lenta.
        const cachedTenant = peekCachedTenantId(initialSession.user.id);
        const cachedRole = readUserRoleAnchor();
        if (cachedTenant && cachedRole) {
          console.log('[SYSTEM] Hidratação otimista do cache (tenant + role).');
          setTenantData((prev) => prev ?? {
            nome: '',
            plan: 'premium',
            tenant_id: cachedTenant,
            role: cachedRole,
          });
          setUserRole(cachedRole);
          setIsAdminGlobal(false);
          setSubscriptionActive(true);
          setLoading(false);
          setIsSessionHydrating(false);
          authFirstEventHandledRef.current = true;
          setIsInitializing(false);
        } else {
          setLoading(true);
          setIsSessionHydrating(true);
        }
      } else {
        setSession(null);
        // Só mostra Login depois que getSession() de fato respondeu sem usuário.
        if (!authFirstEventHandledRef.current) {
          authFirstEventHandledRef.current = true;
          setIsInitializing(false);
          setLoading(false);
          setIsSessionHydrating(false);
        }
      }
    };

    void initializeAuth();

    // 2. Auth Listener
    // This will trigger INITIAL_SESSION immediately on subscribe
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      
      // Quando trocamos de aba, o Supabase muitas vezes dispara eventos espúrios.
      // Se não há alteração real na sessão e ela já estava setada, nós ignoramos chamadas extras custosas de fetch (INITIAL_SESSION/SIGNED_IN)
      if (
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && 
        session && 
        initializedRef.current
      ) {
        const {
          data: { session: fresh },
        } = await supabase.auth.getSession();
        const effective = fresh ?? session;
        setSession(effective);
        if (effective?.user) {
          lastAuthUserIdRef.current = effective.user.id;
          const cachedMerge = peekCachedTenantId(effective.user.id);
          if (cachedMerge) {
            setTenantData((prev) =>
              prev?.tenant_id
                ? prev
                : {
                    nome: prev?.nome ?? '',
                    plan: prev?.plan ?? 'premium',
                    tenant_id: cachedMerge,
                    expires_at: prev?.expires_at,
                    status: prev?.status,
                    foto_url: prev?.foto_url,
                    cargo: prev?.cargo ?? undefined,
                    role: prev?.role ?? undefined,
                  }
            );
          }
        }
        return;
      }

      // Evento disparado silenciamente ao trocar de aba sem alterar o usuário
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session) setSession(session);
        return; 
      }

      try {
        setSession(session);
        if (session) {
          lastAuthUserIdRef.current = session.user.id;
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            // Garante que qualquer papel residual de sessão anterior não vaze para a UI
            // enquanto os dados do novo usuário ainda estão sendo carregados.
            roleRecoveryOnceForUserRef.current = null;
            setTenantRecoveryFailed(false);
            setIsMobileOpen(false);
            const cachedImmediate = peekCachedTenantId(session.user.id);
            const cachedRoleAnchor = readUserRoleAnchor();
            const hasFullCache = !!cachedImmediate && !!cachedRoleAnchor;

            // Hidratação otimista: se há cache valido, hidratamos a UI IMEDIATAMENTE
            // sem mostrar spinner. O loadAllTenantData roda em background e atualiza
            // detalhes quando responder.
            if (hasFullCache) {
              setUserRole(cachedRoleAnchor);
              setTenantData({
                nome: '',
                plan: 'premium',
                tenant_id: cachedImmediate,
                role: cachedRoleAnchor,
              });
              setIsAdminGlobal(false);
              setSubscriptionActive(true);
              setLoading(false);
              setIsSessionHydrating(false);
            } else {
              setUserRole(null);
              setLoading(true);
              setIsSessionHydrating(true);
              if (cachedImmediate) {
                setTenantData({
                  nome: '',
                  plan: 'premium',
                  tenant_id: cachedImmediate,
                });
              }
            }

            // Sempre inicia na Home após sessão válida; evita aba 'profile' órfã (sem filho)
            // da sessão anterior. Filhos de santo são reposicionados em loadAllTenantData.
            const isFilhoAuth = readPersistedFilhoFlag(session.user.id) || isFilhoIdentity(session.user);
            persistFilhoFlag(isFilhoAuth, session.user.id);
            setActiveTab(isFilhoAuth ? 'profile' : 'dashboard');
            if (isFilhoAuth) {
              setUserRole('filho');
              setIsAdminGlobal(false);
              setSubscriptionActive(true);
            }
            await loadAllTenantData(
              session.user.id,
              session.user.email,
              session.user.user_metadata?.role,
              session.access_token
            );
            if (session.access_token) {
              const { trackSessionActivity } = await import('./lib/trackSessionActivity');
              void trackSessionActivity(session.access_token);
            }
            initializedRef.current = true;
          }
        } else {
          const uidOut = lastAuthUserIdRef.current;
          if (uidOut) clearCachedTenantIdForUser(uidOut);
          lastAuthUserIdRef.current = null;
          roleRecoveryOnceForUserRef.current = null;
          setUserRole(null);
          setLegalTermsAccepted(null);
          setIsAdminGlobal(false);
          setSubscriptionActive(true);
          setTenantData(null);
          writeTenantAnchorToStorage(null);
          setTenantAnchorId(null);
          writeUserRoleAnchor(null);
          setRoleAnchor(null);
          setSelectedChildId(null);
          setFilhoFotoUrl(null);
          setTenantRecoveryFailed(false);
          setIsSessionHydrating(false);
          setActiveTab('dashboard');
          setIsMobileOpen(false);
          initializedRef.current = false;
          persistFilhoFlag(false);
        }
      } catch (error: any) {
        const errorMessage = String(error?.message || '').toLowerCase();
        if (errorMessage.includes('jwt') && errorMessage.includes('expir')) {
          window.dispatchEvent(new CustomEvent('axecloud:session-expired', { detail: { source: 'auth_listener' } }));
          return;
        }
        if (error && error.message && (error.message.includes('stole it') || error.message.includes('Lock'))) {
          if (session?.user) {
            void recoverTenantAfterFailure(
              session.user.id,
              session.user.email,
              session.user.user_metadata?.role
            );
          }
          return;
        }
        console.error('Error in onAuthStateChange:', error);
        if (session?.user) {
          void recoverTenantAfterFailure(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.role
          ).then((ok) => {
            if (!ok) setTenantRecoveryFailed(true);
          });
        }
      } finally {
        const canResolveInitialization =
          event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT';
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
           setLoading(false);
           setIsSessionHydrating(false);
        }
        if (canResolveInitialization) markAuthInitialized();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (surface !== 'dashboard') return;
    if (loading || isInitializing || isSessionHydrating) return;
    if (!session) goToLogin();
  }, [surface, session, loading, isInitializing, isSessionHydrating]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || userRole !== 'admin') return;
    if (hasAcceptedLegalTerms(uid, null)) {
      setLegalTermsAccepted(true);
    }
  }, [session?.user?.id, userRole]);

  useEffect(() => {
    if (loading || !session?.user || userRole) return;
    if (roleRecoveryOnceForUserRef.current === session.user.id) return;
    roleRecoveryOnceForUserRef.current = session.user.id;
    void recoverTenantAfterFailure(
      session.user.id,
      session.user.email,
      session.user.user_metadata?.role
    ).then((ok) => {
      if (!ok) setTenantRecoveryFailed(true);
    });
  }, [loading, session?.user?.id, userRole]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (effectiveTenantId) return;
    const timer = window.setTimeout(async () => {
      const {
        data: { session: freshSession },
      } = await supabase.auth.getSession();
      if (!freshSession?.user) return;
      if (effectiveTenantId) return;
      const storageAnchor = readTenantAnchorFromStorage();
      if (storageAnchor) {
        setTenantAnchorId(storageAnchor);
        setTenantData((prev) =>
          prev
            ? { ...prev, tenant_id: storageAnchor }
            : {
                nome: '',
                plan: 'premium',
                tenant_id: storageAnchor,
                role: userRole ?? undefined,
              }
        );
        return;
      }
      console.warn('[SESSION] tenant_id ausente após 3s — corta-circuito (logout sem redirect).');
      persistFilhoFlag(false);
      await emergencyAuthCircuitBreaker();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [session?.user?.id, effectiveTenantId, userRole]);

  /** Se o tenant não veio do tenant-info/props, tenta perfil_lider / filhos (JWT) e atualiza o estado. */
  useEffect(() => {
    if (!session?.user?.id || !tenantData) return;
    const raw = tenantData.tenant_id;
    if (String(raw || '').trim()) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const fallback = await resolveTenantFromSupabase(session.user.id, session.user.email);
      if (cancelled) return;
      if (fallback) {
        writeCachedTenantIdForUser(session.user.id, fallback);
        setTenantData((prev) => (prev ? { ...prev, tenant_id: fallback } : prev));
        if (import.meta.env.DEV) {
          console.warn('[TenantContext][App]', {
            userId: session.user.id,
            tenant_id: fallback,
            origem: 'supabase_fallback_cliente',
          });
        }
      } else if (import.meta.env.DEV) {
        console.warn('[TenantContext][App]', {
          userId: session.user.id,
          tenant_id: null,
          alerta: 'tenant_id continua vazio após login e fallback Supabase — finanças/membros podem zerar',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.email, tenantData?.tenant_id]);

  useEffect(() => {
    const handleNavigateToSubscription = () => {
      setActiveTab('settings');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-subscription-tab'));
      }, 100);
    };

    window.addEventListener('navigate-to-subscription', handleNavigateToSubscription);
    return () => window.removeEventListener('navigate-to-subscription', handleNavigateToSubscription);
  }, []);

  useEffect(() => {
    const onTradicaoUpdated = (e: Event) => {
      const tradicao = (e as CustomEvent<{ tradicao?: string }>).detail?.tradicao;
      if (!tradicao) return;
      setTenantData((prev) => (prev ? { ...prev, tradicao } : prev));
    };
    window.addEventListener('axecloud:tradicao-updated', onTradicaoUpdated);
    return () => window.removeEventListener('axecloud:tradicao-updated', onTradicaoUpdated);
  }, []);

  useEffect(() => {
    if (userRole === 'filho' && !FILHO_ALLOWED_TABS.has(activeTab)) {
      setActiveTab('profile');
    }
  }, [userRole, activeTab]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      setActiveTab('gallery');
    }
  }, [activeTab]);

  /** Loading prolongado: evita recarga automática para não entrar em loop no mobile. */
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => {
      if (!loadingRef.current) return;
      setShowConnectionResetCta(true);
    }, 32000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const refreshAllData = async (newData?: { nome_terreiro?: string; foto_url?: string; cargo?: string | null }) => {
    if (session?.user) {
      
      if (newData) {
        setTenantData(prev => prev ? ({
          ...prev,
          nome: newData.nome_terreiro || prev.nome,
          foto_url: newData.foto_url !== undefined ? newData.foto_url : prev.foto_url,
          cargo: newData.cargo !== undefined ? newData.cargo : prev.cargo
        }) : null);
      } else {
        await loadAllTenantData(
          session.user.id,
          session.user.email,
          session.user.user_metadata?.role,
          session.access_token
        );
      }
    }
  };

  const connectionEmergencyCta =
    showConnectionResetCta && blockingSpinnerActive && !tenantAnchorId && !readTenantAnchorFromStorage() ? (
      <button
        type="button"
        onClick={() => void performEmergencyClientReset()}
        className="relative z-20 mt-10 w-[min(96vw,28rem)] px-6 py-5 rounded-2xl bg-red-600 text-white text-sm sm:text-base font-black uppercase tracking-wide text-center shadow-xl border border-red-400/40 active:scale-[0.98] transition-transform"
      >
        ERRO DE CONEXÃO: CLIQUE AQUI PARA RESETAR
      </button>
    ) : null;

  if (sessionExpiredState) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
        <AuthScreenBackground variant="dark" className="fixed inset-0" />
        <div className="relative z-10 max-w-md w-full bg-card border border-white/10 rounded-[32px] p-8 text-center space-y-6">
          <ShieldAlert className="w-14 h-14 text-red-500 mx-auto" />
          <h2 className="text-xl font-black text-white tracking-tight">Sessão expirada</h2>
          <p className="text-sm text-gray-400 font-medium">
            Sua sessão não pôde ser recuperada com segurança. Faça login novamente para continuar.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/login';
            }}
            className="w-full py-4 bg-primary text-black font-black rounded-2xl hover:opacity-95 transition-opacity"
          >
            Fazer Login Novamente
          </button>
        </div>
      </div>
    );
  }

  if (isInitializing || loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden px-4">
        <AuthScreenBackground className="fixed inset-0" />
        <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
        {connectionEmergencyCta}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <AuthScreenBackground className="fixed inset-0 opacity-30" />
        <Loader2 className="relative z-10 h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isDeleted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
        <AuthScreenBackground className="fixed inset-0" />
        <div className="max-w-md w-full bg-card border border-white/5 p-12 rounded-[40px] text-center space-y-6 relative z-10">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter">CONTA EXCLUÍDA</h2>
          <p className="text-gray-400 font-medium">Esta conta foi removida do sistema. Entre em contato com o suporte para mais informações.</p>
          <button onClick={() => performFastLogout()} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all">
            VOLTAR AO LOGIN
          </button>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
        <AuthScreenBackground className="fixed inset-0" />
        <div className="max-w-md w-full bg-card border border-white/5 p-12 rounded-[40px] text-center space-y-6 relative z-10">
          <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter">ACESSO SUSPENSO</h2>
          <p className="text-gray-400 font-medium">Seu acesso ao AxéCloud foi temporariamente suspenso por um administrador.</p>
          <button onClick={() => performFastLogout()} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all">
            VOLTAR AO LOGIN
          </button>
        </div>
      </div>
    );
  }

  // Show lock screen if subscription is not active AND user is not admin
  // Admins and Children should always have access to the system
  if (!subscriptionActive && !isAdminGlobal && userRole !== 'filho') {
    return <SubscriptionLock plan={tenantData?.plan} subscriptionStatus={tenantData?.status} />;
  }

  if (loading || isSessionHydrating || !userRole || pendingFilhoHydration) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden px-4">
        <AuthScreenBackground className="fixed inset-0" />
        <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
        <p className="relative z-10 mt-6 text-sm font-bold uppercase tracking-widest text-gray-400">
          Carregando Perfil...
        </p>
        {connectionEmergencyCta}
      </div>
    );
  }

  if (!effectiveTenantId) {
    if (tenantRecoveryFailed) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <AuthScreenBackground className="fixed inset-0" />
          <div className="relative z-10 max-w-md w-full bg-card border border-white/10 rounded-[32px] p-8 text-center space-y-6">
            <ShieldAlert className="w-14 h-14 text-amber-500 mx-auto" />
            <h2 className="text-xl font-black text-white tracking-tight">Não foi possível carregar o terreiro</h2>
            <p className="text-sm text-gray-400 font-medium">
              A sessão existe, mas os dados do terreiro não foram recuperados. Tente recarregar ou saia e entre de novo.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setTenantRecoveryFailed(false);
                  setLoading(true);
                  void loadAllTenantData(
                    session.user.id,
                    session.user.email,
                    session.user.user_metadata?.role,
                    session.access_token
                  );
                }}
                className="w-full py-4 bg-primary text-black font-black rounded-2xl hover:opacity-95 transition-opacity"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => void performFastLogout()}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden px-4">
        <AuthScreenBackground className="fixed inset-0" />
        <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
        {connectionEmergencyCta}
      </div>
    );
  }

  const navigateToTab = (tab: string) => {
    setActiveTab(userRole === 'filho' ? normalizeFilhoTab(tab) : tab);
  };

  const renderView = () => {
    // SISTEMA DO FILHO: Se for filho, ele tem um sistema de visualização dedicado
    // Independente de planos ou assinaturas do zelador.
    // Injetamos is_admin_global: true no tenantData enviado aos componentes APENAS para bypassar travas de PLANO
    // Mas passamos isAdminGlobal={false} para desativar botões de edição/exclusão.
    const hijoTenantData = tenantData ? { ...tenantData, is_admin_global: true } : null;

    if (userRole === 'filho') {
      // Filhos de Santo nunca são bloqueados por plano — eles acessam o conteúdo
      // que o zelador/zeladora publica, sem precisar de assinatura própria.
      switch (activeTab) {
        case 'profile':
        case 'perfil': return <PerfilFilho user={session.user} tenantData={hijoTenantData} setActiveTab={navigateToTab} />;
        case 'financial': return <MensalidadeFilho user={session.user} tenantData={hijoTenantData} setActiveTab={navigateToTab} />;
        case 'calendar': return <Calendar user={session.user} tenantData={hijoTenantData} setActiveTab={navigateToTab} userRole={userRole} />;
        case 'library': return <Library user={session.user} userRole={userRole} tenantData={hijoTenantData} isAdminGlobal={false} setActiveTab={navigateToTab} />;
        case 'store': return <Store userRole={userRole} tenantData={hijoTenantData} userId={session.user.id} isAdminGlobal={false} setActiveTab={navigateToTab} />;
        case 'mural': return <NoticeBoard isAdmin={false} tenantData={hijoTenantData} setActiveTab={navigateToTab} />;
        default: return <PerfilFilho user={session.user} tenantData={hijoTenantData} setActiveTab={navigateToTab} />;
      }
    }

    
    // Check access for the active tab (Filhos de Santo têm acesso total de visualização via plano Cortesia)
    const featureAccess = {
      dashboard: true,
      children: true,
      calendar: true,
      mural: true,
      settings: true,
      profile: true,
      inventory: hasPlanAccess(tenantData?.plan, 'inventory', isAdminGlobal),
      camarinha: hasPlanAccess(tenantData?.plan, 'camarinha', isAdminGlobal),
      atendimentos: hasPlanAccess(tenantData?.plan, 'atendimentos', isAdminGlobal),
      gallery: hasPlanAccess(tenantData?.plan, 'gallery', isAdminGlobal),
      library: hasPlanAccess(tenantData?.plan, 'library', isAdminGlobal),
      financial: hasPlanAccess(tenantData?.plan, 'financial', isAdminGlobal),
      store: hasPlanAccess(tenantData?.plan, 'store', isAdminGlobal),
      subscription: true
    };

    const isFeatureRestricted = !featureAccess[activeTab as keyof typeof featureAccess];

    if (isFeatureRestricted) {
      const requiredPlan = activeTab === 'financial' || activeTab === 'store' ? 'Fundamento' : 'Orô';
      return (
        <Paywall 
          featureName={activeTab === 'financial' ? 'Financeiro' : activeTab === 'store' ? 'Loja do Axé' : activeTab === 'gallery' ? 'Galeria' : activeTab === 'inventory' ? 'Almoxarifado' : 'Biblioteca'} 
          requiredPlan={requiredPlan}
          onUpgrade={() => navigateToTab('subscription')}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard': 
        return <Dashboard setActiveTab={navigateToTab} user={session.user} userRole={userRole} tenantData={tenantData} isAdminGlobal={isAdminGlobal} setSelectedChildId={setSelectedChildId} systemVersion={SYSTEM_VERSION} isSessionReady={isSessionReady} />;
      case 'children': 
        return <Children setActiveTab={navigateToTab} user={session.user} setSelectedChildId={setSelectedChildId} tenantData={tenantData} />;
      case 'inventory': 
        return <Inventory tenantData={tenantData} userRole={userRole} isAdminGlobal={isAdminGlobal} setActiveTab={navigateToTab} />;
      case 'camarinha':
        return <Camarinha tenantData={tenantData} userRole={userRole} isAdminGlobal={isAdminGlobal} setActiveTab={navigateToTab} />;
      case 'atendimentos':
        return <Atendimentos tenantData={tenantData} setActiveTab={navigateToTab} />;
      case 'gallery':
        return <Gallery tenantData={tenantData} userRole={userRole} isAdminGlobal={isAdminGlobal} setActiveTab={navigateToTab} />;
      case 'calendar': 
        return <Calendar user={session.user} userRole={userRole} tenantData={tenantData} setActiveTab={navigateToTab} />;
      case 'mural':
        /* Neste ramo o usuário nunca é filho (filho tem switch próprio acima) — sempre gestão do terreiro */
        return <NoticeBoard isAdmin tenantData={tenantData} setActiveTab={navigateToTab} />;
      case 'financial': 
        return <Financial userRole={userRole} userId={session.user.id} tenantData={tenantData} isAdminGlobal={isAdminGlobal} setActiveTab={navigateToTab} isSessionReady={isSessionReady} />;
      case 'settings': 
        return <Settings user={session.user} session={session} onRefresh={refreshAllData} tenantData={tenantData} setActiveTab={navigateToTab} />;
      case 'library':
        return <Library user={session.user} userRole={userRole} tenantData={tenantData} isAdminGlobal={isAdminGlobal} setActiveTab={navigateToTab} />;
      case 'store':
        return <Store userRole={userRole} tenantData={tenantData} userId={session.user.id} isAdminGlobal={isAdminGlobal} setActiveTab={navigateToTab} />;
      case 'admin':
        return (
          <Dashboard
            setActiveTab={navigateToTab}
            user={session.user}
            userRole={userRole}
            tenantData={tenantData}
            isAdminGlobal={isAdminGlobal}
            setSelectedChildId={setSelectedChildId}
            systemVersion={SYSTEM_VERSION}
            isSessionReady={isSessionReady}
          />
        );
      case 'profile':
      case 'perfil':
        if (!selectedChildId) {
          return <Dashboard setActiveTab={navigateToTab} user={session.user} userRole={userRole} tenantData={tenantData} isAdminGlobal={isAdminGlobal} setSelectedChildId={setSelectedChildId} systemVersion={SYSTEM_VERSION} isSessionReady={isSessionReady} />;
        }
        return <ChildProfile childId={selectedChildId} setActiveTab={navigateToTab} user={session.user} tenantData={tenantData} isSelfView={false} />;
      case 'subscription':
        return <Subscription session={session} tenantData={tenantData} onPlanUpdated={refreshAllData} setActiveTab={navigateToTab} />;
      default: 
        return <Dashboard setActiveTab={navigateToTab} user={session.user} userRole={userRole} systemVersion={SYSTEM_VERSION} isSessionReady={isSessionReady} />;
    }
  };

  const handleAcceptLegalTerms = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLegalTermsAccepting(true);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      if (!authSession?.access_token) {
        throw new Error('Sessão expirada');
      }
      const response = await authFetch('/api/v1/legal/accept-terms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ version: CURRENT_LEGAL_TERMS_VERSION }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível registrar o aceite');
      }
      writeLocalLegalAcceptance(userId);
      setLegalTermsAccepted(true);
    } catch (err) {
      console.warn('[legal] Falha ao persistir aceite no servidor:', err);
      // Cache local + preservação no logout evitam reexibir o modal na mesma conta/dispositivo.
      writeLocalLegalAcceptance(userId);
      setLegalTermsAccepted(true);
    } finally {
      setLegalTermsAccepting(false);
    }
  };

  const showLegalTermsModal = userRole === 'admin' && legalTermsAccepted === false;

  const getPlanColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'premium': return 'text-[#FBBC00]';
      case 'vita':
      case 'cortesia': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <>
    <div className="h-[100dvh] w-full bg-[#121317] text-white font-sans selection:bg-primary selection:text-background flex relative overflow-hidden">
      {userRole === 'filho' ? (
        <FilhoSidebar 
          activeTab={activeTab} 
          setActiveTab={navigateToTab} 
          tenantData={tenantData}
          user={session?.user}
          filhoFotoUrl={filhoFotoUrl}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />
      ) : (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={navigateToTab} 
          isMobileOpen={isMobileOpen} 
          setIsMobileOpen={setIsMobileOpen} 
          isAdmin={isAdminGlobal}
          userRole={userRole}
          tenantData={tenantData}
        />
      )}

      <div className={cn(
        "app-content-panel flex min-w-0 flex-1 flex-col h-[100dvh] relative z-10",
        userRole === 'filho' ? "lg:pl-64" : "lg:pl-[248px]"
      )}>
        <div className="app-content-panel__base" aria-hidden />

        {/* Mobile Header */}
        <header className="page-header-shell sticky top-0 z-50 flex h-20 min-w-0 shrink-0 items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl lg:hidden">
          {userRole === 'filho' ? (
            /* Header exclusivo para filho de santo */
            <>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-yellow-500/30 bg-black/40">
                  <img
                    src={
                      filhoFotoUrl ||
                      session?.user?.user_metadata?.foto_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(session?.user?.user_metadata?.nome || 'filho')}`
                    }
                    alt="Perfil"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col pr-2">
                  <p className="truncate text-sm font-black text-white">
                    {session?.user?.user_metadata?.nome || 'Filho de Santo'}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-yellow-500" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500">
                      {tenantData?.nome || 'TERREIRO'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <PwaInstallTopbarButton />
                <NotificationPanel tenantData={tenantData} systemVersion={SYSTEM_VERSION} userRole={userRole} userId={session?.user?.id} />
                <button
                  onClick={() => setIsMobileOpen(true)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            </>
          ) : (
            /* Header padrão do zelador */
            <>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-primary text-center text-lg font-black leading-10 text-background shadow-lg shadow-primary/20">
                  {tenantData?.foto_url ? (
                    <img 
                      src={tenantData.foto_url} 
                      alt="Profile" 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    tenantData?.nome?.[0] || 'Z'
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col pr-2">
                  <p className="truncate text-sm font-black text-white" title={tenantData?.nome || 'AXÉCLOUD'}>
                    {tenantData?.nome || 'AXÉCLOUD'}
                  </p>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-primary">ONLINE</p>
                    </div>
                    {tenantData && (
                      <>
                        <span className="shrink-0 text-[10px] text-white/30">|</span>
                        <span className={cn(
                          "min-w-0 truncate text-[9px] font-black uppercase tracking-widest",
                          getPlanColor(tenantData.plan)
                        )}>
                          {tenantData.plan}
                          {tenantData.plan.toLowerCase() === 'premium' && " 👑"}
                          {(tenantData.plan.toLowerCase() === 'vita' || tenantData.plan.toLowerCase() === 'plano vita' || tenantData.plan.toLowerCase() === 'cortesia') && " 💎"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <PwaInstallTopbarButton />
                <NotificationPanel tenantData={tenantData} systemVersion={SYSTEM_VERSION} userRole={userRole} userId={session?.user?.id} />
                <button 
                  onClick={() => setIsMobileOpen(true)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            </>
          )}
        </header>

        {/* Main Content Area with Scroll */}
        <div className="relative z-[2] min-w-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <main
            className="app-page-shell flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[#121212]/80 backdrop-blur-[2px]"
            data-role={userRole ?? undefined}
          >
            {/* Notificações push: apenas filhos — banner só com permissão ainda "default"; granted/denied o navegador já decidiu */}
            {userRole === 'filho' && permission === 'default' && session && (
              <div className="mx-4 mb-6 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 sm:mx-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Bell className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">Ativar Notificações?</h4>
                    <p className="text-xs text-gray-400">Receba avisos do mural e eventos em tempo real.</p>
                  </div>
                </div>
                <button
                  onClick={subscribe}
                  disabled={pushLoading}
                  className="w-full md:w-auto bg-primary text-background px-6 py-2 rounded-xl font-black text-sm hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {pushLoading ? 'Ativando...' : 'Ativar Agora'}
                </button>
              </div>
            )}
            {userRole === 'filho' && permission === 'denied' && session && (
              <div className="mx-4 mb-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400 sm:mx-6">
                Notificações estão <span className="font-bold text-white/80">bloqueadas</span> neste navegador. Para receber avisos do terreiro, permita o site em{' '}
                <span className="text-gray-300">Configurações do site</span> (ícone de cadeado ou informações ao lado do endereço).
              </div>
            )}
            <div className="flex-1">
              <Suspense
                fallback={
                  <div className="flex min-h-[60vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                }
              >
                {renderView()}
              </Suspense>
            </div>
            <AppFooter />
          </main>
        </div>
      </div>
    </div>
    <LegalTermsModal
      open={showLegalTermsModal}
      onAccept={handleAcceptLegalTerms}
      accepting={legalTermsAccepting}
    />
    </>
  );
}
