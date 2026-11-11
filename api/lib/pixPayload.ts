import { buildStaticPixPayload, type PixConfig } from '../../src/lib/pixPayload.js';

export { pixCrc16 as calculateCrc16 } from '../../src/lib/pixPayload.js';
export type PixPayloadConfig = PixConfig;

export function buildPixPayload(
  config: PixPayloadConfig,
  valor: number,
  txid = '***',
  descricao = 'MENSALIDADE',
): string {
  if (!String(config.chave_pix || '').trim()) return '';
  return buildStaticPixPayload(
    { ...config, nome_beneficiario: config.nome_beneficiario || 'TERREIRO' },
    valor === 0 ? undefined : valor,
    txid,
    descricao,
  );
}
