import type { Express, Request, Response } from "express";
import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { apiReadRateLimit } from "./rateLimit.js";

const UUID_RE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

/** Banners de eventos (portal) e mídia publicada da galeria — sem chat/privado. */
const PUBLIC_MEDIA_KEY_RE = new RegExp(
  `^(?:${UUID_RE}/event_banners/.+|${UUID_RE}/${UUID_RE}/.+)$`,
  "i",
);

export function isPublicMediaStorageKey(key: string): boolean {
  const normalized = String(key || "")
    .replace(/\\/g, "/")
    .trim();
  if (!normalized || normalized.includes("..") || normalized.startsWith("chat/")) {
    return false;
  }
  return PUBLIC_MEDIA_KEY_RE.test(normalized);
}

export function resolvePublicSiteOrigin(): string {
  const fromEnv = [process.env.APP_PUBLIC_URL, process.env.PUBLIC_APP_URL, process.env.VITE_APP_URL]
    .map((s) => String(s || "").trim())
    .find((s) => s.startsWith("http"));
  return (fromEnv || "https://axecloud.com.br").replace(/\/+$/, "");
}

export function buildR2MediaProxyUrl(storageKey: string, absolute = false): string {
  const path = `/api/v1/public/media?key=${encodeURIComponent(storageKey)}`;
  return absolute ? `${resolvePublicSiteOrigin()}${path}` : path;
}

/** Extrai a storage key a partir de URL S3 (R2/B2) ou CDN público configurado. */
export function extractR2StorageKeyFromUrl(url: string): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\/+/, "");

    if (host.includes(".r2.cloudflarestorage.com")) {
      const parts = path.split("/");
      if (parts.length >= 2) {
        parts.shift();
        const key = parts.join("/");
        return key || null;
      }
    }

    // B2 virtual-hosted: bucket.s3.<region>.backblazeb2.com/<key>
    if (host.includes(".backblazeb2.com") && host.includes(".s3.")) {
      return path || null;
    }

    // B2 path-style: s3.<region>.backblazeb2.com/<bucket>/<key>
    if (/^s3\.[a-z0-9-]+\.backblazeb2\.com$/i.test(host)) {
      const parts = path.split("/");
      if (parts.length >= 2) {
        parts.shift();
        return parts.join("/") || null;
      }
    }

    const r2Base = String(process.env.R2_PUBLIC_BASE_URL || "")
      .trim()
      .replace(/\/+$/, "");
    if (
      r2Base &&
      !r2Base.includes(".r2.cloudflarestorage.com") &&
      !r2Base.includes(".backblazeb2.com") &&
      raw.startsWith(`${r2Base}/`)
    ) {
      return raw.slice(r2Base.length + 1) || null;
    }
  } catch {
    return null;
  }

  return null;
}

/** URLs do endpoint S3 privado não são públicas — reescreve para o proxy do app. */
export function resolvePublicMediaUrl(
  url: string | null | undefined,
  options?: { absolute?: boolean }
): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;

  const key = extractR2StorageKeyFromUrl(raw);
  if (
    key &&
    (raw.includes(".r2.cloudflarestorage.com") || raw.includes(".backblazeb2.com"))
  ) {
    return buildR2MediaProxyUrl(key, options?.absolute === true);
  }

  return raw;
}

export function buildR2PublicUrlFromKey(storageKey: string): string {
  const base = String(process.env.R2_PUBLIC_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (base && !base.includes(".r2.cloudflarestorage.com")) {
    return `${base}/${storageKey}`;
  }
  return buildR2MediaProxyUrl(storageKey, true);
}

type PublicMediaDeps = {
  r2Client: S3Client | null;
  bucketName: string | undefined;
};

export function registerPublicMediaRoutes(app: Express, deps: PublicMediaDeps): void {
  app.get("/api/v1/public/media", apiReadRateLimit, async (req: Request, res: Response) => {
    const key = String(req.query.key || "")
      .replace(/\\/g, "/")
      .trim();

    if (!isPublicMediaStorageKey(key)) {
      return res.status(400).json({ error: "Chave de mídia inválida." });
    }

    if (!deps.r2Client || !deps.bucketName) {
      return res.status(503).json({ error: "Armazenamento indisponível." });
    }

    try {
      const out = await deps.r2Client.send(
        new GetObjectCommand({
          Bucket: deps.bucketName,
          Key: key,
        })
      );

      const body = out.Body;
      if (!body) return res.status(404).end();

      const chunks: Buffer[] = [];
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      res.set({
        "Content-Type": out.ContentType || "image/jpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      });
      return res.send(buffer);
    } catch (err: unknown) {
      console.error("[public/media]", err instanceof Error ? err.message : err);
      return res.status(404).end();
    }
  });
}
