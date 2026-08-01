import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODAL_DLG_DONE, MODAL_DLG_IN, MODAL_DLG_OUT, MODAL_TW } from '../lib/modalMotion';
import { X, Copy, CheckCircle2, Loader2, CalendarDays } from 'lucide-react';
import { cn } from '../lib/utils';
import BodyPortal from './BodyPortal';
import QRCode from 'qrcode';

export interface PixConfig {
  chave_pix: string;
  tipo_chave: string;
  nome_beneficiario: string;
  cidade: string;
}

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  pixConfig: PixConfig | null;
  valor: number;
  descricao: string;
  txid: string;
  vencimento?: string; // ex: "10/05/2026"
}

/** Gera o payload EMV Pix (BR Code) com CRC-16 correto */
export function buildPixPayload(config: PixConfig, valor: number, txid: string, descricao: string): string {
  const chave = config.chave_pix.trim();
  const nome = config.nome_beneficiario.trim().slice(0, 25);
  const cidade = (config.cidade || 'BRASIL').trim().slice(0, 15);
  const valorStr = valor.toFixed(2);
  const txidClean = txid.replace(/\D/g, '').slice(0, 25).padEnd(5, '0');
  const descLimpa = descricao.replace(/[^\w\s]/g, '').trim().slice(0, 20);

  const merchantAccountInfo = `0014br.gov.bcb.pix01${chave.length.toString().padStart(2, '0')}${chave}` +
    (descLimpa ? `02${descLimpa.length.toString().padStart(2, '0')}${descLimpa}` : '');
  const mai = `26${merchantAccountInfo.length.toString().padStart(2, '0')}${merchantAccountInfo}`;

  const additionalInfo = `05${txidClean.length.toString().padStart(2, '0')}${txidClean}`;
  const add = `62${additionalInfo.length.toString().padStart(2, '0')}${additionalInfo}`;

  const payload =
    '000201' +
    '010212' +
    mai +
    '52040000' +
    '5303986' +
    `54${valorStr.length.toString().padStart(2, '0')}${valorStr}` +
    '5802BR' +
    `59${nome.length.toString().padStart(2, '0')}${nome}` +
    `60${cidade.length.toString().padStart(2, '0')}${cidade}` +
    add +
    '6304';

  // CRC-16/CCITT-FALSE
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

export default function PixPaymentModal({
  open,
  onClose,
  loading,
  pixConfig,
  valor,
  descricao,
  txid,
  vencimento
}: PixPaymentModalProps) {
  const [copied, setCopied] = React.useState(false);
  const [pixPayload, setPixPayload] = React.useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !pixConfig?.chave_pix) return;
    const payload = buildPixPayload(pixConfig, valor, txid, descricao);
    setPixPayload(payload);

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, payload, {
        width: 192,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
    }
  }, [open, pixConfig, valor, txid, descricao]);

  const handleCopy = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
            className="relative z-10 flex w-full max-w-sm max-h-[88dvh] flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] p-6 text-[#171A16] shadow-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between pb-5">
              <h2 className="text-base font-display font-black text-[#171A16] uppercase tracking-tight">Pagamento via Pix</h2>
              <button onClick={onClose} className="rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] hover:bg-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <Loader2 className="w-7 h-7 text-[#8F7724] animate-spin" />
                <p className="text-xs font-bold text-[#6F675C] uppercase tracking-widest">Carregando...</p>
              </div>
            ) : pixConfig ? (
              <div className="flex-1 space-y-5 overflow-y-auto">
                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-2xl shadow-lg">
                    <canvas ref={canvasRef} className="rounded-xl block" />
                  </div>
                </div>

                {/* Valor + Vencimento */}
                <div className="flex items-center justify-between px-1">
                  <div>
                    <p className="text-[9px] font-black text-[#6F675C] uppercase tracking-widest">Valor</p>
                    <p className="text-2xl font-black text-[#171A16]">R$ {valor.toFixed(2).replace('.', ',')}</p>
                  </div>
                  {vencimento && (
                    <div className="text-right">
                      <p className="text-[9px] font-black text-[#6F675C] uppercase tracking-widest flex items-center justify-end gap-1">
                        <CalendarDays className="w-3 h-3" /> Vencimento
                      </p>
                      <p className="text-sm font-black text-[#8F7724]">{vencimento}</p>
                    </div>
                  )}
                </div>

                {/* Copia e Cola */}
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-[#6F675C] uppercase tracking-widest">Pix Copia e Cola</p>
                  <div className="bg-white border border-[#E3DCCE] rounded-xl px-3 py-2">
                    <p className="text-[10px] font-mono text-[#6F675C] break-all leading-relaxed select-all">
                      {pixPayload.slice(0, 60)}...
                    </p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      "w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                      copied
                        ? "bg-[#3F7258] text-white"
                        : "bg-[#17251D] text-[#FFFAF0] hover:bg-[#20342A] hover:scale-[1.02] active:scale-95"
                    )}
                  >
                    {copied ? (
                      <><CheckCircle2 className="w-4 h-4" /> Copiado!</>
                    ) : (
                      <><Copy className="w-4 h-4" /> Copiar Código Pix</>
                    )}
                  </button>
                </div>

                {/* Beneficiário */}
                <div className="pt-2 border-t border-[#E3DCCE] flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-[#6F675C] uppercase tracking-widest">Beneficiário</p>
                    <p className="text-xs font-bold text-[#171A16] mt-0.5">{pixConfig.nome_beneficiario}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-[#6F675C] uppercase tracking-widest">Chave ({pixConfig.tipo_chave})</p>
                    <p className="text-xs font-mono text-[#8F7724] mt-0.5">{pixConfig.chave_pix}</p>
                  </div>
                </div>
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
