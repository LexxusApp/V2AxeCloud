import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNotificationPermission,
  safeLocalStorageGet,
  safeLocalStorageSet,
  supportsWebPush,
} from '../src/lib/browserCapabilities.ts';

test('recursos ausentes do WebView não lançam erro no bootstrap autenticado', () => {
  assert.equal(getNotificationPermission(), null);
  assert.equal(supportsWebPush(), false);
  assert.equal(safeLocalStorageGet('inexistente'), null);
  assert.equal(safeLocalStorageSet('chave', 'valor'), false);
});
