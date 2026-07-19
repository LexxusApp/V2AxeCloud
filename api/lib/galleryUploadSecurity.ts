import { HeadObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowedGalleryMime } from "./mediaUpload.js";

type VerifiedGalleryUpload = {
  ok: true;
  normalizedKey: string;
  normalizedType: string;
  mediaType: "image" | "video";
  actualSize: number;
  expectedPublicUrl: string;
};

type GalleryUploadFailure = { ok: false; status: number; error: string };

export async function verifyCompletedGalleryUpload(opts: {
  supabaseAdmin: SupabaseClient;
  r2Client: S3Client;
  bucketName: string;
  tenantId: string;
  albumId: string;
  storageKey: unknown;
  publicUrl: unknown;
  contentType: unknown;
  sizeBytes: unknown;
  quotaBytes: number;
  buildPublicUrl: (key: string) => string;
}): Promise<VerifiedGalleryUpload | GalleryUploadFailure> {
  const normalizedKey = String(opts.storageKey || "").replace(/\\/g, "/");
  if (!normalizedKey.startsWith(`${opts.tenantId}/${opts.albumId}/`) || normalizedKey.includes("..")) {
    return { ok: false, status: 400, error: "storageKey inválido para este álbum" };
  }
  const expectedPublicUrl = opts.buildPublicUrl(normalizedKey);
  if (String(opts.publicUrl) !== expectedPublicUrl) {
    return { ok: false, status: 400, error: "publicUrl não confere com storageKey" };
  }
  const normalizedType = String(opts.contentType).split(";", 1)[0].trim().toLowerCase();
  const declaredSize = Number(opts.sizeBytes);
  if (!isAllowedGalleryMime(normalizedType)) {
    return { ok: false, status: 400, error: "Tipo de mídia inválido" };
  }
  if (!Number.isFinite(declaredSize) || declaredSize <= 0 || declaredSize > 500 * 1024 * 1024) {
    return { ok: false, status: 400, error: "Tamanho de arquivo inválido" };
  }

  const { data: album, error: albumError } = await opts.supabaseAdmin
    .from("gallery_albums").select("id").eq("id", opts.albumId).eq("tenant_id", opts.tenantId).maybeSingle();
  if (albumError) throw albumError;
  if (!album) return { ok: false, status: 404, error: "Álbum não encontrado" };

  const uploaded = await opts.r2Client.send(
    new HeadObjectCommand({ Bucket: opts.bucketName, Key: normalizedKey })
  );
  const actualSize = Number(uploaded.ContentLength || 0);
  const actualType = String(uploaded.ContentType || "").split(";", 1)[0].trim().toLowerCase();
  if (!actualSize || actualSize > 500 * 1024 * 1024) {
    return { ok: false, status: 400, error: "Objeto enviado vazio ou acima de 500 MB" };
  }
  if (actualType !== normalizedType) {
    return { ok: false, status: 400, error: "O tipo do objeto enviado não confere" };
  }

  const { data: quotaRows, error: quotaError } = await opts.supabaseAdmin
    .from("gallery_media").select("size_bytes").eq("tenant_id", opts.tenantId);
  if (quotaError) throw quotaError;
  const usedBytes = (quotaRows || []).reduce((sum, row) => sum + Number(row.size_bytes || 0), 0);
  if (usedBytes + actualSize > opts.quotaBytes) {
    return { ok: false, status: 403, error: "Cota da galeria excedida (100GB por terreiro)" };
  }

  return {
    ok: true,
    normalizedKey,
    normalizedType,
    mediaType: normalizedType.startsWith("video/") ? "video" : "image",
    actualSize,
    expectedPublicUrl,
  };
}
