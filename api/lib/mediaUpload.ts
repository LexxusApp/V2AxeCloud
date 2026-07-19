const GALLERY_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/webm", "video/quicktime",
]);

export function isAllowedGalleryMime(value: unknown): boolean {
  return GALLERY_MIME_TYPES.has(String(value || "").split(";", 1)[0].trim().toLowerCase());
}
