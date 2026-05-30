/** Dados vindos de uma inscrição do Programa Fundador para pré-preencher «Novo terreiro». */
export type FounderTenantPrefill = {
  founderId: string;
  nomeTerreiro: string;
  nomeZelador: string;
  whatsapp: string;
  email: string;
  cidade: string;
  estado: string;
};

export type FounderPrefillSource = {
  id: string;
  nome_casa: string;
  nome_contato: string | null;
  whatsapp: string;
  email: string | null;
  cidade: string;
  estado: string;
};

export function founderRowToPrefill(row: FounderPrefillSource): FounderTenantPrefill {
  return {
    founderId: row.id,
    nomeTerreiro: row.nome_casa,
    nomeZelador: row.nome_contato || "",
    whatsapp: row.whatsapp,
    email: row.email || "",
    cidade: row.cidade,
    estado: row.estado,
  };
}
