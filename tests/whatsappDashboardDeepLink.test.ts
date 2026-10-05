import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboard = readFileSync(new URL('../src/views/Dashboard.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../src/views/Settings.tsx', import.meta.url), 'utf8');
const whatsappPanel = readFileSync(new URL('../src/components/settings/SettingsWhatsAppPanel.tsx', import.meta.url), 'utf8');

test('o card de falhas direciona para Configurações > WhatsApp > Histórico', () => {
  assert.match(dashboard, /sessionStorage\.setItem\('axecloud:settings-section', 'whatsapp'\)/);
  assert.match(dashboard, /sessionStorage\.setItem\('axecloud:whatsapp-view', 'historico'\)/);
  assert.match(settings, /sessionStorage\.getItem\('axecloud:whatsapp-view'\)/);
  assert.match(settings, /<SettingsWhatsAppPanel initialView=\{initialWhatsAppView\} \/>/);
  assert.match(whatsappPanel, /if \(initialView\) return initialView/);
});
