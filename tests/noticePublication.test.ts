import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNoticePublication } from '../src/lib/noticePublication';

function streamed(chunks: string[]) {
  const bytes = new TextEncoder().encode(chunks.join(''));
  // Split inside multibyte characters and JSON tokens, as a real connection can.
  return new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    },
  }), { headers: { 'content-type': 'application/x-ndjson' } });
}

test('publication reads real milestones across fragmented UTF-8 chunks', async () => {
  const milestones: unknown[] = [];
  const result = await readNoticePublication(streamed([
    JSON.stringify({ type: 'progress', stage: 'published' }) + '\n',
    JSON.stringify({ type: 'progress', stage: 'whatsapp', total: 3, sent: 1, errors: 1 }) + '\n',
    JSON.stringify({ type: 'result', payload: { success: true, titulo: 'Orientação de sábado' } }),
  ]), (progress) => milestones.push(progress));
  assert.equal(result.titulo, 'Orientação de sábado');
  assert.equal(milestones.length, 2);
  assert.deepEqual(milestones[1], { type: 'progress', stage: 'whatsapp', total: 3, sent: 1, errors: 1 });
});

test('publication keeps compatibility with JSON API', async () => {
  const result = await readNoticePublication(Response.json({ success: true }), () => assert.fail());
  assert.equal(result.success, true);
});

test('an interrupted stream never reports success', async () => {
  await assert.rejects(readNoticePublication(streamed([
    '{"type":"progress","stage":"published"}\n',
  ]), () => {}), /Confira o mural e o histórico/);
});

test('server errors preserve the published-notice warning', async () => {
  await assert.rejects(readNoticePublication(streamed([
    JSON.stringify({ type: 'error', error: 'Publicado no mural; confira o histórico.' }) + '\n',
  ]), () => {}), /Publicado no mural/);
});
