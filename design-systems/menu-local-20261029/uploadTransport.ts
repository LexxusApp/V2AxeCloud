export type UploadProgress = (loaded: number, total?: number) => void;
/** Per-request transport. The ordinary authenticatedFetch still owns authorization and 401 retry. */
export function xhrUploadTransport(progress: UploadProgress, create = () => new XMLHttpRequest()): typeof fetch {
  return (input, init: RequestInit = {}) => new Promise<Response>((resolve, reject) => {
    const xhr = create();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');
    let finished = false, last = 0;
    const signal = init.signal;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const fail = (error: Error) => { if (finished) return; finished = true; cleanup(); reject(error); };
    const abort = () => { xhr.abort(); fail(new DOMException('Envio interrompido.', 'AbortError')); };
    if (signal?.aborted) { fail(new DOMException('Envio interrompido.', 'AbortError')); return; }
    try {
      xhr.open(method, url, true); xhr.timeout = 300000;
      xhr.withCredentials = init.credentials === 'include';
      new Headers(init.headers).forEach((value,key) => xhr.setRequestHeader(key,value));
      xhr.upload.onprogress = event => { const now = Date.now(); if (now-last < 100 && event.loaded !== event.total) return; last=now; progress(event.loaded, event.lengthComputable ? event.total : undefined); };
      xhr.upload.onload = () => progress(1, 1); // Transfer completed; server confirmation remains separate.
      xhr.onload = () => {
        if (finished) return;
        try {
          const headers = new Headers();
          for (const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)) { const colon=line.indexOf(':'); if(colon>0)headers.append(line.slice(0,colon),line.slice(colon+1).trim()); }
          const response = new Response([204,205,304].includes(xhr.status) ? null : xhr.responseText, { status:xhr.status, statusText:xhr.statusText, headers });
          finished = true; cleanup(); resolve(response);
        } catch(error) { fail(error instanceof Error ? error : new Error('Resposta de envio inválida.')); }
      };
      xhr.onerror = () => fail(new Error('A conexão falhou durante o envio. Confira os arquivos antes de tentar novamente.'));
      xhr.ontimeout = () => fail(new Error('O envio excedeu o tempo de espera. Confira sua conexão e tente novamente.'));
      xhr.onabort = () => fail(new DOMException('Envio interrompido.', 'AbortError'));
      signal?.addEventListener('abort', abort, { once:true });
      if (init.body instanceof ReadableStream) throw new Error('Este formato de envio não permite medir a transferência.');
      xhr.send(init.body as XMLHttpRequestBodyInit | null | undefined);
    } catch(error) { fail(error instanceof Error ? error : new Error('Não foi possível iniciar o envio.')); }
  });
}
