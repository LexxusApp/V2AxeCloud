import test from 'node:test';
import assert from 'node:assert/strict';
import { runStartup, type StartupDependencies } from '../design-systems/menu-local-20261029/startup';

function fixture(overrides: Partial<StartupDependencies> = {}) {
  const stages: string[] = [], errors: unknown[] = [];
  let deadline = () => {}, mounts = 0, cleared = false;
  const deps: StartupDependencies = {
    configure: async () => {}, connect: async (_signal, onStage) => { onStage('access'); onStage('house'); return true; },
    mount: async () => { mounts++; }, onStage: stage => stages.push(stage), onError: error => errors.push(error),
    setTimer: (callback, ms) => { assert.equal(ms, 30000); deadline = callback; return 'timer'; },
    clearTimer: () => { cleared = true; }, ...overrides,
  };
  return { deps, stages, errors, expire: () => deadline(), mounts: () => mounts, cleared: () => cleared };
}
test('mounts the panel only after configuration and verified session, preserving real startup stages', async () => {
  const f = fixture(); await runStartup(f.deps);
  assert.deepEqual(f.stages, ['config','session','access','house','opening']);
  assert.equal(f.mounts(), 1); assert.equal(f.errors.length, 0); assert.equal(f.cleared(), true);
});
test('an authentication redirect never mounts the private application', async () => {
  const f = fixture({ connect: async () => false }); await runStartup(f.deps);
  assert.equal(f.mounts(), 0); assert.equal(f.errors.length, 0); assert.equal(f.cleared(), true);
});
test('configuration failures keep the recovery screen and do not proceed to authentication', async () => {
  let connections = 0;
  const failure = new Error('Configuração indisponível');
  const f = fixture({ configure: async () => { throw failure; }, connect: async () => { connections++; return true; } });
  await runStartup(f.deps);
  assert.equal(connections, 0); assert.equal(f.mounts(), 0); assert.deepEqual(f.errors, [failure]);
});
test('startup timeout aborts requests and a late session response cannot open the application', async () => {
  let finish!: (connected: boolean) => void, signal!: AbortSignal;
  const f = fixture({ connect: (received) => { signal = received; return new Promise(resolve => { finish = resolve; }); } });
  const run = runStartup(f.deps); await Promise.resolve();
  assert.equal(signal.aborted, false); f.expire(); assert.equal(signal.aborted, true);
  finish(true); await run;
  assert.equal(f.mounts(), 0); assert.equal(f.errors.length, 1); assert.match(String(f.errors[0]), /demorou/);
  assert.equal(f.cleared(), true);
});
test('configuration and session requests share the abort signal and cannot advance after timeout', async () => {
  let finish!: () => void, configSignal!: AbortSignal, connections = 0;
  const f = fixture({ configure: signal => { configSignal = signal; return new Promise<void>(resolve => { finish = resolve; }); }, connect: async () => { connections++; return true; } });
  const run = runStartup(f.deps); f.expire(); finish(); await run;
  assert.equal(configSignal.aborted, true); assert.equal(connections, 0); assert.equal(f.errors.length, 1);
});
test('a failed application module produces a recoverable startup error', async () => {
  const failure = new Error('Falha ao carregar o painel');
  const f = fixture({ mount: async () => { throw failure; } }); await runStartup(f.deps);
  assert.deepEqual(f.errors, [failure]); assert.equal(f.cleared(), true);
});
