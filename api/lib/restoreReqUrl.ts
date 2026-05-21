/** Reconstrói req.url para routers Express após rewrite Vercel (?target= / ?path=). */
export function restoreReqUrl(
  req: { url?: string; query?: Record<string, unknown> },
  basePath: string,
  stripKeys: string[] = ["target", "path", "route", "action", "job"]
): void {
  const suffix = String(req.query?.path || req.query?.target || "")
    .trim()
    .replace(/^\/+/, "");
  const segment = suffix || String(req.query?.route || "").trim().replace(/^\/+/, "");
  if (!segment && !basePath.endsWith("/")) return;

  const rawUrl = String(req.url || "");
  const qIndex = rawUrl.indexOf("?");
  const qs = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "";
  const params = new URLSearchParams(qs);
  for (const k of stripKeys) params.delete(k);
  const rest = params.toString();
  const path = segment ? `${basePath.replace(/\/$/, "")}/${segment}` : basePath;
  req.url = rest ? `${path}?${rest}` : path;
}
