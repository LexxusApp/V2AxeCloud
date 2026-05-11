/** Linha mínima de `filhos_de_santo` para contagem no admin. */
export type FilhoTenantLink = { tenant_id?: string | null; lider_id?: string | null };

export type PerfilLiderIds = { id: string; tenant_id?: string | null };

/**
 * Conta filhos ligados ao terreiro do zelador.
 * Na base, `tenant_id` do filho pode ser o UUID lógico do terreiro (`perfil_lider.tenant_id`)
 * e/ou `lider_id` o `perfil_lider.id` do zelador — a listagem antiga só comparava `tenant_id === perfil_lider.id`.
 */
export function countFilhosForPerfilLider(leader: PerfilLiderIds, children: FilhoTenantLink[]): number {
  const pTenant = leader.tenant_id ?? null;
  let n = 0;
  for (const c of children) {
    const tid = c.tenant_id ?? null;
    const lid = c.lider_id ?? null;
    if (lid === leader.id || tid === leader.id) {
      n++;
      continue;
    }
    if (pTenant && (tid === pTenant || lid === pTenant)) {
      n++;
    }
  }
  return n;
}
