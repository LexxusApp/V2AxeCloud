import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFeatureFromRoute,
  reportFeatureFailure,
} from '../api/lib/featureFailureMonitor.js';

test('featureFailureMonitor: classifica corretamente as rotas de negócio dos terreiros', () => {
  assert.equal(classifyFeatureFromRoute('/api/v1/gallery/upload-url'), 'fotos');
  assert.equal(classifyFeatureFromRoute('/api/v1/profile/upload-photo'), 'fotos');
  assert.equal(classifyFeatureFromRoute('/api/events'), 'agenda');
  assert.equal(classifyFeatureFromRoute('/api/events/123'), 'agenda');
  assert.equal(classifyFeatureFromRoute('/api/v1/financial/mensalidades'), 'financeiro');
  assert.equal(classifyFeatureFromRoute('/api/v1/financial/mensalidades/liquidar'), 'financeiro');
  assert.equal(classifyFeatureFromRoute('/api/filhos'), 'membros');
  assert.equal(classifyFeatureFromRoute('/api/children/add'), 'membros');
  assert.equal(classifyFeatureFromRoute('/api/v1/settings/save'), 'configuracoes');
  assert.equal(classifyFeatureFromRoute('/api/auth/login'), 'acesso');
});

test('featureFailureMonitor: reportFeatureFailure salva e deduplica falhas repetidas', async () => {
  const insertedFailures: any[] = [];
  const fakeSb = {
    from: (table: string) => ({
      insert: async (row: any) => {
        if (table === 'tenant_feature_failures') {
          insertedFailures.push(row);
        }
        return { error: null };
      },
    }),
  };

  const input = {
    tenantId: '11111111-2222-3333-4444-555555555555',
    feature: 'fotos',
    route: 'POST /api/v1/gallery/upload-url',
    errorMessage: 'Arquivo excede o limite máximo de 5MB',
    httpStatus: 413,
  };

  // Primeiro disparo: deve salvar
  const first = await reportFeatureFailure(fakeSb, input);
  assert.equal(first.saved, true);
  assert.equal(insertedFailures.length, 1);
  assert.equal(insertedFailures[0].feature, 'fotos');
  assert.equal(insertedFailures[0].error_message, 'Arquivo excede o limite máximo de 5MB');

  // Segundo disparo idêntico dentro da janela de deduplicação: deve deduplicar
  const second = await reportFeatureFailure(fakeSb, input);
  assert.equal(second.saved, false);
  assert.equal(second.deduped, true);
  assert.equal(insertedFailures.length, 1);
});
