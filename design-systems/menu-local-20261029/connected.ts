import { runStartup, type StartupStage } from './startup';

// This screen is already styled in index.html, before any module or request loads.
const screen = document.getElementById('boot-screen')!;
const title = document.getElementById('boot-title')!;
const status = document.getElementById('boot-status')!;
const message = document.getElementById('boot-error')!;
const progress = document.getElementById('boot-progress')!;
const recovery = document.getElementById('boot-recovery')!;
const labels: Record<StartupStage, string> = {
  config: 'Abrindo sua casa…',
  session: 'Conferindo sua sessão…',
  access: 'Conectando sua conta…',
  house: 'Carregando os dados da sua casa…',
  opening: 'Abrindo seu painel…',
};
document.getElementById('boot-retry')!.addEventListener('click', event => { event.preventDefault(); location.reload(); });
function showError(error: unknown) {
  screen.setAttribute('aria-busy', 'false');
  title.textContent = 'Não foi possível abrir o painel';
  status.hidden = true;
  progress.hidden = true;
  message.textContent = navigator.onLine === false ? 'Você está sem conexão. Verifique sua internet e tente novamente.' : error instanceof Error ? error.message : 'Verifique sua conexão e tente novamente.';
  message.hidden = false;
  recovery.hidden = false;
}

if (navigator.onLine === false) showError(new Error('Sem conexão.'));
else void runStartup({
  async configure(signal) {
    // Only public runtime configuration enters the browser; never a service-role key.
    const response = await fetch('/api/public-config', { cache: 'no-store', signal });
    if (!response.ok) throw new Error('O servidor não respondeu à configuração da aplicação.');
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('A configuração pública de acesso está incompleta.');
    (window as any).__AXECLOUD_RUNTIME__ = { supabaseUrl: config.supabaseUrl, supabaseAnonKey: config.supabaseAnonKey, vapidPublicKey: config.vapidPublicKey || '' };
  },
  async connect(signal, onStage) { const { connectPreview } = await import('./remote/session'); return connectPreview({ signal, onStage }); },
  mount: () => import('./main'),
  onStage: stage => { status.textContent = labels[stage]; progress.setAttribute('aria-valuetext', labels[stage]); },
  onError: showError,
});
