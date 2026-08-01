import React, { useRef } from 'react';
import { CalendarDays, CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../../lib/modalMotion';
import { AppPrimaryButton } from '../ui/appDemoUi';
import { cn } from '../../lib/utils';
import BodyPortal from '../BodyPortal';

const paperLabelClass =
  'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]';
const paperInputClass =
  'min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15';

export type ObligationFormData = {
  titulo: string;
  data: string;
  hora: string;
  descricao: string;
  notifyChild: boolean;
};

type ObligationScheduleModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: ObligationFormData;
  setFormData: React.Dispatch<React.SetStateAction<ObligationFormData>>;
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  isSubmitting: boolean;
  showNotifyCheckbox: boolean;
};

export function ObligationScheduleModal({
  open,
  onClose,
  onSubmit,
  formData,
  setFormData,
  pdfFile,
  setPdfFile,
  isSubmitting,
  showNotifyCheckbox,
}: ObligationScheduleModalProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  return (
    <BodyPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={MODAL_TW}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden
      />
      <motion.div
        initial={MODAL_PANEL_IN}
        animate={MODAL_PANEL_DONE}
        exit={MODAL_PANEL_OUT}
        transition={MODAL_TW}
        role="dialog"
        aria-modal="true"
        aria-labelledby="obligation-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[101] my-auto flex w-full max-h-[88dvh] max-w-md flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#DED8CB] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1E8D2]">
              <CalendarDays className="h-4 w-4 text-[#8F7724]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 id="obligation-modal-title" className="font-display text-sm font-black text-[#171A16] sm:text-base">
                Agendar obrigação
              </h3>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#8F7724]">
                Calendário do Axé
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="shrink-0 rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition-colors hover:bg-white disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-5">
            <div className="space-y-3">
            <div>
              <label className={paperLabelClass}>Título da obrigação</label>
              <input
                required
                type="text"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                className={paperInputClass}
                placeholder="Ex: Obrigação de 7 anos"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={paperLabelClass}>Data prevista</label>
                <input
                  required
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  className={paperInputClass}
                />
              </div>
              <div>
                <label className={paperLabelClass}>Hora</label>
                <input
                  required
                  type="time"
                  value={formData.hora}
                  onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                  className={paperInputClass}
                />
              </div>
            </div>

            <div>
              <label className={paperLabelClass}>Observações</label>
              <textarea
                value={formData.descricao}
                rows={2}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className={cn(paperInputClass, 'min-h-[72px] resize-none py-2')}
                placeholder="Detalhes sobre a obrigação…"
              />
            </div>

            <div>
              <label className={paperLabelClass}>Anexo PDF (opcional)</label>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                    alert('Selecione um arquivo PDF.');
                    e.target.value = '';
                    setPdfFile(null);
                    return;
                  }
                  if (file && file.size > 15 * 1024 * 1024) {
                    alert('PDF muito grande (máx. 15 MB).');
                    e.target.value = '';
                    setPdfFile(null);
                    return;
                  }
                  setPdfFile(file);
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => !isSubmitting && pdfInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') pdfInputRef.current?.click();
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#D8D2C4] bg-white px-3 py-3 text-left transition hover:border-[#B8AF9D] aria-disabled:opacity-50"
                aria-disabled={isSubmitting}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1ECE0]">
                  {pdfFile ? (
                    <FileText className="h-4 w-4 text-[#8F7724]" />
                  ) : (
                    <Upload className="h-4 w-4 text-[#6F675C]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#171A16]">
                    {pdfFile ? pdfFile.name : 'Anexar documento da obrigação'}
                  </p>
                  <p className="text-[10px] text-[#6F675C]">
                    {pdfFile ? 'Toque para trocar o arquivo' : 'PDF até 15 MB'}
                  </p>
                </div>
                {pdfFile ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPdfFile(null);
                      if (pdfInputRef.current) pdfInputRef.current.value = '';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        setPdfFile(null);
                        if (pdfInputRef.current) pdfInputRef.current.value = '';
                      }
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-[#6F675C] hover:bg-[#F1ECE0] hover:text-[#171A16]"
                    aria-label="Remover PDF"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>
            </div>

            {showNotifyCheckbox ? (
              <label className="flex cursor-pointer items-center gap-2.5 pt-0.5">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={formData.notifyChild}
                    onChange={(e) => setFormData({ ...formData, notifyChild: e.target.checked })}
                    className="peer sr-only"
                  />
                  <div className="flex h-4 w-4 items-center justify-center rounded border border-[#C9C1B3] bg-white transition-all peer-checked:border-[#17251D] peer-checked:bg-[#17251D]">
                    <CheckCircle2 className="h-3 w-3 text-[#FFFAF0] opacity-0 transition-opacity peer-checked:opacity-100" />
                  </div>
                </div>
                <span className="text-xs text-[#6F675C]">Enviar aviso para o filho</span>
              </label>
            ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#DED8CB] px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-[#D8D2C4] bg-white px-4 py-2 text-xs font-bold text-[#4A463E] transition hover:bg-[#F5F0E5] disabled:opacity-50"
            >
              Cancelar
            </button>
            <AppPrimaryButton
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-w-[140px] items-center justify-center gap-2 bg-[#17251D] text-[#FFFAF0] hover:bg-[#20342A]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Confirmar'
              )}
            </AppPrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
    </BodyPortal>
  );
}
