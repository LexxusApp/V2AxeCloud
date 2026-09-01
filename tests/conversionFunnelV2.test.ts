import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchConversionFunnelStats } from '../api/lib/publicConversionTracking.ts';

type Row = { event_name: string; visitor_id: string; path?: string; cta_id?: string | null; metadata?: unknown };

function fakeSupabase(rows: Row[]): SupabaseClient {
  return {
    from() {
      let eventName = '';
      const query = {
        select() { return query; },
        eq(_column: string, value: string) { eventName = value; return query; },
        gte() { return query; },
        lt() { return query; },
        order() { return query; },
        async range(from: number, to: number) {
          const data = rows
            .filter((row) => row.event_name === eventName)
            .slice(from, to + 1)
            .map((row) => ({ path: '/', cta_id: null, metadata: {}, ...row }));
          return { data, error: null };
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

test('funil comercial não mistura tráfego e ações do diretório', async () => {
  const stats = await fetchConversionFunnelStats(fakeSupabase([
    { event_name: 'commercial_view', visitor_id: 'commercial-1' },
    { event_name: 'trial_cta_click', visitor_id: 'commercial-1' },
    { event_name: 'register_view', visitor_id: 'commercial-1' },
    { event_name: 'register_started', visitor_id: 'commercial-1' },
    { event_name: 'register_submitted', visitor_id: 'commercial-1' },
    { event_name: 'register_completed', visitor_id: 'commercial-1' },
    { event_name: 'directory_view', visitor_id: 'directory-1', path: '/terreiros' },
    { event_name: 'directory_action', visitor_id: 'directory-1', path: '/terreiros' },
    { event_name: 'claim_started', visitor_id: 'directory-1', path: '/terreiro/casa' },
    { event_name: 'claim_completed', visitor_id: 'directory-1', path: '/terreiro/casa' },
  ]), 0);

  assert.equal(stats.commercial.visitors, 1);
  assert.equal(stats.commercial.registerSubmitted, 1);
  assert.equal(stats.commercial.viewToCompletePct, 100);
  assert.equal(stats.directory.visitors, 1);
  assert.equal(stats.directory.actions, 1);
  assert.equal(stats.directory.claimCompletionPct, 100);
});

test('cadastro mede abertura, início, envio e conclusão e mantém conclusão no servidor', () => {
  const register = readFileSync('src/views/Register.tsx', 'utf8');
  const onboarding = readFileSync('api/lib/onboardingRoutes.ts', 'utf8');
  const migration = readFileSync('supabase/migrations/20260826143000_conversion_funnels_v2.sql', 'utf8');

  assert.match(register, /trackConversionEvent\('register_view'/);
  assert.match(register, /trackConversionEvent\('register_started'/);
  assert.match(register, /trackConversionEvent\('register_submitted'/);
  assert.match(register, /Etapa \{step\} de 3/);
  assert.match(register, /register_step_completed', \{ metadata: \{ step: 2 \} \}/);
  assert.match(onboarding, /eventName: 'register_completed'/);
  assert.match(migration, /'register_submitted'/);
  assert.match(migration, /'commercial_view'/);
  assert.match(migration, /'directory_view'/);
});
