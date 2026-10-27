export interface NoticeProgress {
  stage: 'publishing' | 'published' | 'whatsapp';
  total?: number;
  sent?: number;
  errors?: number;
}

/** Read server milestones, retaining JSON compatibility with older API versions. */
export async function readNoticePublication(response: Response, onProgress: (progress: NoticeProgress) => void): Promise<any> {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) return response.json();
  if (!response.body) throw new Error('Não foi possível acompanhar a publicação. Confira o mural antes de tentar novamente.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let result: any;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'progress') onProgress(event);
    if (event.type === 'result') result = event.payload;
    if (event.type === 'error') throw new Error(event.error);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      lines.forEach(consume);
      if (done) break;
    }
    consume(pending);
    if (!result) throw new Error('A conexão foi interrompida. Confira o mural e o histórico antes de publicar novamente.');
    return result;
  } finally {
    reader.releaseLock();
  }
}
