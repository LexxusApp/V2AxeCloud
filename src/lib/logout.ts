import { supabase } from './supabase';
import { ROUTES } from './routes';
import { APP_VERSION, SYSTEM_VERSION } from '../config/version';
import {
  collectLegalAcceptanceFromStorage,
  restoreLegalAcceptanceToStorage,
} from './legalTerms';

/**
 * Remove todos os caches do Cache Storage (PWA / Workbox).
 */
async function deleteAllCacheStorage(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    /* Safari / modo privado */
  }
}

/** Desregistra service workers para não servir shell antigo após logout. */
async function unregisterAllServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignorar */
  }
}

/**
 * Logout com reset completo (mobile/PWA): encerra sessão no Supabase, apaga storage,
 * limpa caches do PWA e força navegação full reload para /login.
 *
 * Regrava só `axecloud_version` com a versão atual do app após o clear, para não
 * disparar o fluxo de “nova versão” no próximo carregamento.
 */
export async function performFastLogout(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await supabase.auth.signOut();
  } catch {
    /* rede / timeout — emergência no finally */
  }

  const preservedLegalAcceptance = collectLegalAcceptanceFromStorage();

  try {
    await deleteAllCacheStorage();
    await unregisterAllServiceWorkers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    try {
      localStorage.setItem('axecloud_version', SYSTEM_VERSION);
      restoreLegalAcceptanceToStorage(preservedLegalAcceptance);
    } catch {
      /* ignorar */
    }
  } catch {
    /* limpeza falhou — mesmo assim redireciona */
  } finally {
    // Cache-bust evita shell HTML antigo (hashes de bundle obsoletos → 404 em /assets).
    window.location.replace(`${ROUTES.login}?logout=${Date.now()}`);
  }
}

/**
 * Deploy / nova versão (SOFT): NÃO desconecta o usuário. Apenas registra a nova versão
 * em localStorage para que o aviso de "nova versão" não se repita no próximo carregamento.
 *
 * A atualização do bundle é tratada pelo Service Worker (src/main.tsx → onNeedRefresh),
 * que dispara um `location.reload()` quando o cliente passa a servir o novo build.
 *
 * Mantemos o nome `performVersionBumpLogout` por compatibilidade com chamadores,
 * mas o comportamento destrutivo (signOut + localStorage.clear) foi removido.
 *
 * Para forçar logout (mudança realmente incompatível), use `performFastLogout()` ou
 * `performEmergencyClientReset()` diretamente.
 */
export async function performVersionBumpLogout(systemVersion: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('axecloud_version', systemVersion);
  } catch {
    /* ignorar */
  }
}

/**
 * Corta-circuito: sessão inconsistente / tenant ausente — sem redirecionamento (evita loop PWA).
 * Limpa storages + caches e encerra sessão local do Supabase.
 */
export async function emergencyAuthCircuitBreaker(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    /* ignorar */
  }
  const preservedLegalAcceptance = collectLegalAcceptanceFromStorage();

  try {
    await deleteAllCacheStorage();
    window.localStorage.clear();
    window.sessionStorage.clear();
    try {
      localStorage.setItem('axecloud_version', SYSTEM_VERSION);
      restoreLegalAcceptanceToStorage(preservedLegalAcceptance);
    } catch {
      /* ignorar */
    }
  } catch {
    /* ignorar */
  }
}

/**
 * Reset manual (botão de emergência): mesmo reset + recarga na raiz.
 */
export async function performEmergencyClientReset(): Promise<void> {
  await emergencyAuthCircuitBreaker();
  window.location.href = '/';
}
