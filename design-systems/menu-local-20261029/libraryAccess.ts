// This models local preview visibility only. It is not server authorization.
export type LibraryAudience = { kind: 'house' } | { kind: 'individual'; memberId: string };
export type LibraryViewer = { kind: 'zelador' } | { kind: 'member'; memberId: string };
export function mayReadMaterial(material: { audience: LibraryAudience }, viewer: LibraryViewer) {
  if (!material?.audience || !viewer) return false;
  if (viewer.kind === 'zelador') return true;
  if (viewer.kind !== 'member' || !viewer.memberId) return false;
  if (material.audience.kind === 'house') return true;
  return material.audience.kind === 'individual' && !!material.audience.memberId && material.audience.memberId === viewer.memberId;
}
export function validLibraryAudience(audience: LibraryAudience, memberIds: string[]) { return audience?.kind === 'house' || audience?.kind === 'individual' && !!audience.memberId && memberIds.includes(audience.memberId); }
