import { request, scoped, previewSession } from './session';

export type RenewalPixCharge =
  | { paid: true; status: string }
  | { paid: false; txid: string; copyPaste: string; qrCodeDataUrl: string | null; status: string; expiresIn: number; reused: boolean };

export async function createSubscriptionRenewalPix(tenantId: string, cycle: 'monthly' | 'annual'): Promise<RenewalPixCharge> {
  if (previewSession().tenantId !== tenantId) throw new Error('A assinatura não pertence à casa atual.');
  if (cycle !== 'monthly' && cycle !== 'annual') throw new Error('Selecione um ciclo válido.');
  const result = await request<Record<string, unknown>>(
    scoped('/api/v1/checkout/efi/pix'), 'POST',
    { tenantId, purpose: 'renewal', billingCycle: cycle },
  );
  if (result.alreadyActive === true && result.paid === true) return { paid: true, status: 'CONCLUIDA' };
  if (result.alreadyActive === true) throw new Error('O provedor não confirmou uma nova cobrança. Atualize a assinatura.');
  const txid = String(result.txid || '').trim();
  const copyPaste = String(result.copyPaste || '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(txid) || copyPaste.length < 30 || copyPaste.length > 2048 || result.billingCycle !== cycle) {
    throw new Error('O provedor retornou dados Pix incompletos. Verifique a cobrança antes de tentar novamente.');
  }
  const qr = typeof result.qrCodeDataUrl === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(result.qrCodeDataUrl) && result.qrCodeDataUrl.length < 1_000_000
    ? result.qrCodeDataUrl : null;
  const expires = Number(result.expiresIn);
  return {
    paid: false, txid, copyPaste, qrCodeDataUrl: qr,
    status: String(result.status || 'ATIVA'),
    expiresIn: Number.isFinite(expires) && expires > 0 ? expires : 86400,
    reused: result.reused === true,
  };
}

export async function checkRenewalPixStatus(tenantId: string, txid: string): Promise<{ paid: boolean; status: string }> {
  if (previewSession().tenantId !== tenantId) throw new Error('A casa desta cobrança não corresponde à sessão.');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(txid)) throw new Error('Referência Pix inválida.');
  const result = await request<Record<string, unknown>>(scoped(`/api/v1/checkout/efi/pix/${encodeURIComponent(txid)}/status`));
  if (typeof result.paid !== 'boolean' || typeof result.status !== 'string') throw new Error('Não foi possível confirmar a situação com o provedor.');
  return { paid: result.paid, status: result.status };
}
