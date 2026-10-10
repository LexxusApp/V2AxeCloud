/**
 * Gerador de payload Pix EMV (BR Code padrão Banco Central / BACEN) com cálculo de CRC-16.
 * Usado para gerar o código "Pix Copia e Cola" em mensagens WhatsApp e cobranças.
 */

export interface PixPayloadConfig {
  chave_pix: string;
  tipo_chave?: string;
  nome_beneficiario: string;
  cidade?: string;
}

/**
 * Calcula o checksum CRC-16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF).
 */
export function calculateCrc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o payload EMV do Pix Copia e Cola estático.
 */
export function buildPixPayload(
  config: PixPayloadConfig,
  valor: number,
  txid = "AXECLOUD",
  descricao = "MENSALIDADE"
): string {
  const chave = String(config.chave_pix || "").trim();
  if (!chave) return "";

  const nome = String(config.nome_beneficiario || "TERREIRO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, 25);

  const cidade = String(config.cidade || "SAO PAULO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, 15);

  const valorStr = valor > 0 ? valor.toFixed(2) : "";
  const txidClean = (txid.replace(/[^a-zA-Z0-9]/g, "") || "AXECLOUD").slice(0, 25).padEnd(5, "0");
  const descLimpa = descricao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim()
    .slice(0, 20);

  const merchantAccountInfo =
    `0014br.gov.bcb.pix01${chave.length.toString().padStart(2, "0")}${chave}` +
    (descLimpa ? `02${descLimpa.length.toString().padStart(2, "0")}${descLimpa}` : "");

  const mai = `26${merchantAccountInfo.length.toString().padStart(2, "0")}${merchantAccountInfo}`;
  const additionalInfo = `05${txidClean.length.toString().padStart(2, "0")}${txidClean}`;
  const add = `62${additionalInfo.length.toString().padStart(2, "0")}${additionalInfo}`;

  const payloadSemCrc =
    "000201" +
    "010212" +
    mai +
    "52040000" +
    "5303986" +
    (valorStr ? `54${valorStr.length.toString().padStart(2, "0")}${valorStr}` : "") +
    "5802BR" +
    `59${nome.length.toString().padStart(2, "0")}${nome}` +
    `60${cidade.length.toString().padStart(2, "0")}${cidade}` +
    add +
    "6304";

  const crc = calculateCrc16(payloadSemCrc);
  return payloadSemCrc + crc;
}
