export type GalleryCategory = "gira" | "evento" | "lembranca";
export type GalleryMedia = {
  id: string;
  albumId: string;
  title: string;
  caption: string;
  type: "image" | "video";
  source: string | File;
  fileName: string;
  bytes: number;
  created: string;
  illustrative: boolean;
  liked: boolean;
  likeCount?: number;
};
export type GalleryAlbum = {
  id: string;
  name: string;
  description: string;
  category: GalleryCategory;
  created: string;
  coverId: string;
};
export type LocalGallery = { albums: GalleryAlbum[]; media: GalleryMedia[] };
export const galleryCategories: Record<GalleryCategory, string> = {
  gira: "Giras",
  evento: "Festas e rituais",
  lembranca: "Memórias da casa",
};
export const galleryDate = (stamp: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(stamp));
export const gallerySize = (bytes: number) =>
  bytes === 0
    ? "0 KB"
    : bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
