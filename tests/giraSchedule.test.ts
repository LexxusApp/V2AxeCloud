import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatGiraTime,
  getNextGiraScheduleItem,
  normalizeGiraSchedule,
} from '../lib/giraSchedule';

test('normaliza e ordena horários públicos de gira com limites seguros', () => {
  const schedule = normalizeGiraSchedule([
    { diaSemana: 5, horario: '19:00', titulo: ' Gira de Caboclo ', observacao: ' Confirmar em feriados ' },
    { diaSemana: 2, horario: '20:30' },
    { diaSemana: 9, horario: '99:00' },
    { diaSemana: 5, horario: '19:00', titulo: ' Gira de Caboclo ' },
  ]);

  assert.deepEqual(schedule, [
    { diaSemana: 2, horario: '20:30', titulo: null, observacao: null },
    { diaSemana: 5, horario: '19:00', titulo: 'Gira de Caboclo', observacao: 'Confirmar em feriados' },
  ]);
  assert.equal(formatGiraTime('19:00'), '19h');
  assert.equal(formatGiraTime('20:30'), '20h30');
});

test('destaca a próxima gira usando o horário de Brasília', () => {
  const schedule = normalizeGiraSchedule([
    { diaSemana: 5, horario: '19:00', titulo: 'Gira' },
    { diaSemana: 6, horario: '10:00' },
  ]);

  assert.equal(getNextGiraScheduleItem(schedule, new Date('2026-09-04T20:00:00Z'))?.daysUntil, 0);
  assert.equal(getNextGiraScheduleItem(schedule, new Date('2026-09-04T23:00:00Z'))?.item.diaSemana, 6);
});

test('Radar salva os horários e o perfil público os apresenta', () => {
  const migration = readFileSync('supabase/migrations/20260902123000_terreiro_gira_horarios.sql', 'utf8');
  const settingsApi = readFileSync('api/lib/consulentePortalRoutes.ts', 'utf8');
  const publicApi = readFileSync('api/lib/diretorioPublicRoutes.ts', 'utf8');
  const settings = readFileSync('src/components/settings/ClaimedDirectoryProfileSettings.tsx', 'utf8');
  const profile = readFileSync('src/views/portal/DiretorioTerreiroPage.tsx', 'utf8');

  assert.match(migration, /gira_horarios JSONB/);
  assert.match(settingsApi, /gira_horarios: horariosGira/);
  assert.match(publicApi, /horariosGira: normalizeGiraSchedule/);
  assert.match(settings, /Dias e horários de gira/);
  assert.match(profile, /Próxima gira prevista/);
  assert.match(profile, /A programação pode mudar/);
});
