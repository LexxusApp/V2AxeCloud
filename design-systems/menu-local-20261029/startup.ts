export type StartupStage = 'config' | 'session' | 'access' | 'house' | 'opening';
export type StartupDependencies = {
  configure: (signal: AbortSignal) => Promise<void>;
  connect: (signal: AbortSignal, onStage: (stage: StartupStage) => void) => Promise<boolean>;
  mount: () => Promise<unknown>;
  onStage: (stage: StartupStage) => void;
  onError: (error: unknown) => void;
  setTimer?: (callback: () => void, milliseconds: number) => unknown;
  clearTimer?: (timer: unknown) => void;
};
export async function runStartup(deps: StartupDependencies): Promise<void> {
  const controller = new AbortController();
  let timedOut = false;
  const setTimer = deps.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer || (timer => clearTimeout(timer as ReturnType<typeof setTimeout>));
  const timer = setTimer(() => {
    timedOut = true;
    controller.abort();
    deps.onError(new Error('A conexão demorou mais que o esperado. Verifique sua internet e tente novamente.'));
  }, 30000);
  const assertActive = () => { if (timedOut) throw new Error('Tempo de conexão esgotado.'); };
  try {
    deps.onStage('config');
    await deps.configure(controller.signal);
    assertActive();
    deps.onStage('session');
    const connected = await deps.connect(controller.signal, stage => { if (!timedOut) deps.onStage(stage); });
    assertActive();
    if (!connected) return; // The existing session flow owns sign-in and classic redirects.
    deps.onStage('opening');
    await deps.mount();
  } catch (error) { if (!timedOut) deps.onError(error); }
  finally { clearTimer(timer); }
}
