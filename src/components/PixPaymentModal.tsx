import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODAL_DLG_DONE, MODAL_DLG_IN, MODAL_DLG_OUT, MODAL_TW } from '../lib/modalMotion';
import { X, Copy, CheckCircle2, Loader2, CalendarDays, KeyRound } from 'lucide-react';
import { cn } from '../lib/utils';
import BodyPortal from './BodyPortal';
import QRCode from 'qrcode';

import { buildPixPayload, type PixConfig } from '../lib/pixPayload';
export { buildPixPayload, type PixConfig } from '../lib/pixPayload';

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  pixConfig: PixConfig | null;
  valor: number;
  descricao: string;
  txid?: string;
  vencimento?: string; // ex: "10/05/2026"
  payload?: string;
  notice?: string;
}

export default function PixPaymentModal({
  open,
  onClose,
  loading,
  pixConfig,
  valor,
  descricao,
  txid,
  vencimento,
  payload: providedPayload,
  notice
}: PixPaymentModalProps) {
  const [copied, setCopied] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [pixPayload, setPixPayload] = React.useState('');
  const [pixError, setPixError] = React.useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    setPixPayload('');
    if (loading || !pixConfig?.chave_pix) return;
    setCopied(false);
    setCopiedKey(false);
    setPixError('');
    let payload: string;
    try {
      payload = providedPayload || buildPixPayload(pixConfig, valor, txid || '***', descricao);
    } catch (error) {
      setPixError(error instanceof Error ? error.message : 'Confira os dados Pix.');
      return;
    }
    setPixPayload(payload);

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, payload, {
        width: 192,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).catch(() => setPixError('Não foi possível gerar a imagem. Use o código Pix Copia e Cola.'));
    }
  }, [open, loading, pixConfig, valor, txid, descricao, providedPayload]);

  const handleCopy = async () => {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setPixError('');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setPixError('Não foi possível copiar. Confira a permissão de área de transferência do navegador.');
    }
  };

  const handleCopyKey = async () => {
    if (!pixConfig?.chave_pix) return;
    try {
      await navigator.clipboard.writeText(pixConfig.chave_pix);
      setCopiedKey(true);
      setPixError('');
      setTimeout(() => setCopiedKey(false), 2500);
    } catch {
      setPixError('Não foi possível copiar a chave Pix.');
    }
  };

  return (
    <BodyPortal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_DLG_IN}
              animate={MODAL_DLG_DONE}
              exit={MODAL_DLG_OUT}
              transition={MODAL_TW}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pix-payment-title"
              className="relative z-10 flex w-full max-w-[720px] max-h-[90dvh] flex-col overflow-hidden rounded-[20px] border border-[#D7DCCF] bg-[#F8F8F3] text-[#183326] shadow-[0_28px_90px_rgba(8,30,20,0.34)]"
            >
              <div className="flex shrink-0 items-start justify-between gap-5 border-b border-[#DCE3D8] bg-white/80 px-5 py-4 sm:px-6 sm:py-5">
                <div>
                  <h2 id="pix-payment-title" className="text-xl font-bold tracking-[-0.025em] text-[#183326]">Pagamento via Pix</h2>
                  <p className="mt-1 text-xs leading-5 text-[#64756A]">{descricao}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar pagamento via Pix"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#D6DFD4] bg-white text-[#385344] transition-colors hover:bg-[#EEF3EC]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {loading ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center space-y-3 px-6 py-12" role="status">
                  <Loader2 className="h-7 w-7 animate-spin text-[#2E6D4F]" />
                  <p className="text-sm font-semibold text-[#4D6558]">Preparando o pagamento…</p>
                </div>
              ) : pixConfig ? (
                <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                  {notice ? (
                    <p role="status" className="rounded-xl border border-[#E8D59B] bg-[#FFF8DF] px-4 py-3 text-xs leading-5 text-[#735B18]">
                      {notice}
                    </p>
                  ) : null}
                  {pixError ? (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800">
                      {pixError}
                    </p>
                  ) : null}

                  <div className="grid gap-5 md:grid-cols-[250px_minmax(0,1fr)] md:gap-6">
                    <section className="flex flex-col rounded-[16px] border border-[#D6E0D4] bg-[#EDF3EA] p-4">
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-[#224532]">Escaneie no aplicativo do banco</h3>
                        <p className="mt-1 text-[11px] leading-4 text-[#66796D]">O valor e o destinatário já estão preenchidos.</p>
                      </div>
                      <div className="mx-auto grid w-full max-w-[232px] place-items-center rounded-[14px] border border-[#D9DFD4] bg-white p-2.5 shadow-[0_8px_24px_rgba(25,57,43,0.08)]">
                        <canvas ref={canvasRef} className={pixPayload ? 'block h-auto max-w-full rounded-lg' : 'hidden'} />
                      </div>
                      <p className="mt-3 text-center text-[10px] leading-4 text-[#6B7C71]">QR Code gerado para este pagamento.</p>
                    </section>

                    <section className="flex min-w-0 flex-col">
                      <div className="flex items-end justify-between gap-4 border-b border-[#DCE3D8] pb-4">
                        <div>
                          <p className="text-xs text-[#687A70]">Valor a pagar</p>
                          <p className="mt-1 text-[30px] font-bold tracking-[-0.04em] text-[#183326]">R$ {valor.toFixed(2).replace('.', ',')}</p>
                        </div>
                        {vencimento && (
                          <div className="text-right">
                            <p className="flex items-center justify-end gap-1 text-[10px] text-[#718075]"><CalendarDays className="h-3.5 w-3.5" />Vencimento</p>
                            <p className="mt-1 text-sm font-semibold text-[#896D16]">{vencimento}</p>
                          </div>
                        )}
                      </div>

                      <div className="pt-4">
                        <p className="mb-2 text-xs font-medium text-[#526A5D]">Prefere copiar o código completo?</p>
                        <button
                          type="button"
                          onClick={handleCopy}
                          disabled={!pixPayload}
                          className={cn(
                            "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
                            copied ? "bg-[#377257] text-white" : "bg-[#173A2B] text-white hover:bg-[#22513D]"
                          )}
                        >
                          {copied ? <><CheckCircle2 className="h-4 w-4" />Código Pix copiado</> : <><Copy className="h-4 w-4" />Copiar código Pix</>}
                        </button>
                      </div>

                      <div className="mt-4 rounded-xl border border-[#D7DFD3] bg-white p-3.5">
                        <div className="flex items-start gap-3">
                          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#8B711D]" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-[#66776D]">Chave Pix direta · {pixConfig.tipo_chave || 'Chave'}</p>
                            <p className="mt-1 select-all break-all font-mono text-xs font-semibold text-[#183326]">{pixConfig.chave_pix}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyKey}
                          className={cn(
                            "mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors",
                            copiedKey ? "border-[#377257] bg-[#E7F2EB] text-[#275D43]" : "border-[#D5C079] bg-[#FFF7D8] text-[#725A12] hover:bg-[#F8ECC0]"
                          )}
                        >
                          {copiedKey ? <><CheckCircle2 className="h-3.5 w-3.5" />Chave copiada</> : <><Copy className="h-3.5 w-3.5" />Copiar chave Pix</>}
                        </button>
                        <p className="mt-3 border-t border-[#E3E8DF] pt-3 text-[11px] text-[#697A70]">Beneficiário: <strong className="font-semibold text-[#294738]">{pixConfig.nome_beneficiario}</strong></p>
                      </div>
                    </section>
                  </div>

                  <p className="rounded-xl border border-[#E7D8A6] bg-[#FFF9E8] px-4 py-3 text-[11px] leading-5 text-[#735D1E]">
                    Se o QR Code não funcionar no seu banco, use a chave Pix direta. Antes de confirmar, confira o beneficiário e o valor.
                  </p>
                </div>
              ) : (
                <div className="text-center py-10 space-y-3">
                  <div className="w-14 h-14 bg-[#B04A32]/10 rounded-2xl flex items-center justify-center mx-auto">
                    <X className="w-7 h-7 text-[#B04A32]" />
                  </div>
                  <p className="text-sm font-bold text-[#171A16]">Pix não configurado</p>
                  <p className="text-xs text-[#6F675C]">O zelador ainda não cadastrou uma chave Pix.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </BodyPortal>
  );
}
