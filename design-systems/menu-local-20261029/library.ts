export const libraryCategories = [
  "Cantigas",
  "História",
  "Ervas",
  "Orixás",
  "Fundamentos",
] as const;
export type LibraryCategory = (typeof libraryCategories)[number];
import type { LibraryAudience } from "./libraryAccess";
export {
  mayReadMaterial,
  validLibraryAudience,
  type LibraryAudience,
  type LibraryViewer,
} from "./libraryAccess";
export type LibraryMaterial = {
  id: string;
  title: string;
  description: string;
  category: LibraryCategory;
  source: string | File;
  fileName: string;
  bytes: number;
  illustrative: boolean;
  audience: LibraryAudience;
  created: string;
  updated: string;
  editPolicy?: "revision" | "pending" | "legacy";
};
export type LocalLibrary = {
  materials: LibraryMaterial[];
  revisionEditing?: boolean;
};
export const libraryDate = (stamp: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(stamp));
export const librarySize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
