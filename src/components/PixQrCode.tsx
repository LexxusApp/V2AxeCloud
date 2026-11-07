import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { buildPixPayload, type PixConfig } from '../lib/pixPayload';

export function PixQrCode({ config, value, description }: { config: PixConfig; value: number; description: string }) {
  const [image, setImage] = useState<{ payload: string; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const configured = Boolean(config.chave_pix.trim() && config.nome_beneficiario.trim() && Number.isFinite(value) && value > 0);
  const generated = useMemo(() => {
    if (!configured) return { payload: '', error: '' };
    try { return { payload: buildPixPayload(config, value, '***', description), error: '' }; }
    catch (error) { return { payload: '', error: error instanceof Error ? error.message : 'Confira os dados Pix.' }; }
  }, [configured, config.chave_pix, config.tipo_chave, config.nome_beneficiario, config.cidade, value, description]);
  const payload = generated.payload;
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!payload) { setImage(null); return; }
    void QRCode.toDataURL(payload, { width: 240, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(url => { if (!cancelled) setImage({ payload, url }); })
      .catch(() => { if (!cancelled) { setImage(null); setFailed(true); } });
    return () => { cancelled = true; };
  }, [payload]);
  if (!configured) return <p className="max-w-60 p-4 text-center text-sm text-[#526452]">Informe chave, beneficiário e valor para gerar o QR Code Pix.</p>;
  if (generated.error) return <p role="alert" className="max-w-60 p-4 text-center text-sm text-red-800">{generated.error}</p>;
  if (failed) return <p role="alert" className="max-w-60 p-4 text-center text-sm text-red-800">Não foi possível gerar o QR Code. Copie a chave ou tente novamente.</p>;
  if (!image || image.payload !== payload) return <p role="status" className="p-8 text-sm text-[#526452]">Gerando QR Code Pix…</p>;
  return <img src={image.url} alt={`QR Code Pix para ${config.nome_beneficiario}, valor ${value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`} width={240} height={240} className="max-w-full rounded-lg bg-white"/>;
}
