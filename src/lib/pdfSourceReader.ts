import { authFetch } from './authenticatedFetch';

export interface ReadPdfOptions {
  signal?: AbortSignal;
  tenantId?: string;
  storagePath?: string;
}

function validatePdfSignature(bytes: Uint8Array): void {
  if (bytes.byteLength < 5) {
    throw new Error('INVALID_PDF');
  }
  const magic = new TextDecoder().decode(bytes.slice(0, 5));
  if (magic !== '%PDF-') {
    throw new Error('INVALID_PDF');
  }
}

/**
 * Resiliently fetches and validates PDF bytes from any source URL, File, or Blob.
 * 
 * Bulletproof protections:
 * - Dual-route cross-fallback (/api/pilot/library/pdf-proxy <-> /api/v1/library/pdf-proxy)
 * - Up to 3 attempts with exponential backoff on transient errors (429, 500, 502, 503, 504)
 * - Immediate fallback to alternate route if primary returns 403, 404, or fails
 * - Validates %PDF- magic signature
 * - Graceful AbortSignal support
 */
export async function readPdfBytes(
  source: string | File | Blob,
  options: ReadPdfOptions = {}
): Promise<Uint8Array> {
  if (source instanceof Blob) {
    const buffer = await source.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    validatePdfSignature(bytes);
    return bytes;
  }

  if (typeof source !== 'string' || !source.trim()) {
    throw new Error('MISSING_SOURCE');
  }

  const rawUrl = source.trim();
  const candidates: string[] = [rawUrl];

  // Cross-route fallback
  if (rawUrl.startsWith('/api/pilot/library/pdf-proxy')) {
    candidates.push(rawUrl.replace('/api/pilot/library/pdf-proxy', '/api/v1/library/pdf-proxy'));
  } else if (rawUrl.startsWith('/api/v1/library/pdf-proxy')) {
    candidates.push(rawUrl.replace('/api/v1/library/pdf-proxy', '/api/pilot/library/pdf-proxy'));
  }

  // Ensure storagePath + tenantId URLs if specified
  if (options.storagePath && options.tenantId) {
    const encodedPath = encodeURIComponent(options.storagePath);
    const encodedTenant = encodeURIComponent(options.tenantId);
    const pilotUrl = `/api/pilot/library/pdf-proxy?path=${encodedPath}&tenantId=${encodedTenant}`;
    const v1Url = `/api/v1/library/pdf-proxy?path=${encodedPath}&tenantId=${encodedTenant}`;
    if (!candidates.includes(pilotUrl)) candidates.push(pilotUrl);
    if (!candidates.includes(v1Url)) candidates.push(v1Url);
  }

  let lastError: Error | null = null;

  for (const url of candidates) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (options.signal?.aborted) {
        throw new Error('ABORTED');
      }

      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 200));
      }

      try {
        const fetchFn = url.startsWith('/api/') ? authFetch : fetch;
        const res = await fetchFn(url, {
          cache: 'no-store',
          signal: options.signal,
          headers: {
            Accept: 'application/pdf, application/octet-stream, */*',
          },
        });

        if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 2) {
          await res.body?.cancel().catch(() => {});
          lastError = new Error(`HTTP_${res.status}`);
          continue;
        }

        if (!res.ok) {
          lastError = new Error(`HTTP_${res.status}`);
          // On non-server error (401, 403, 404, etc.), break to try alternate candidate URL
          break;
        }

        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        validatePdfSignature(bytes);
        return bytes;
      } catch (err: any) {
        if (options.signal?.aborted) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  throw lastError || new Error('FAILED_LOAD');
}
