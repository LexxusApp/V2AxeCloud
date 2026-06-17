import React, { useRef } from 'react';
import { CalendarDays, CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../../lib/modalMotion';
import { appInputClass, appLabelClass } from '../../lib/appUiTokens';
import { AppPrimaryButton } from '../ui/appDemoUi';
import { cn } from '../../lib/utils';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4 pt-20 sm:p-8 sm:pt-24">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={MODAL_TW}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
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
        className="relative z-[101] my-auto flex w-full max-h-[min(85dvh,calc(100dvh-5rem))] max-w-md flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1E242B] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 id="obligation-modal-title" className="text-sm font-bold text-[#F1F5F9] sm:text-base">
                Agendar obrigação
              </h3>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[#94A3B8]">
                Calendário do Axé
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="shrink-0 rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-[#12161A] hover:text-[#F1F5F9] disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-5">
            <div className="space-y-3">
            <div>
              <label className={appLabelClass}>Título da obrigação</label>
              <input
                required
                type="text"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                className={appInputClass}
                placeholder="Ex: Obrigação de 7 anos"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={appLabelClass}>Data prevista</label>
                <input
                  required
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  className={appInputClass}
                />
              </div>
              <div>
                <label className={appLabelClass}>Hora</label>
                <input
                  required
                  type="time"
                  value={formData.hora}
                  onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                  className={appInputClass}
                />
              </div>
            </div>

            <div>
              <label className={appLabelClass}>Observações</label>
              <textarea
                value={formData.descricao}
                rows={2}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className={cn(appInputClass, 'min-h-[72px] resize-none py-2')}
                placeholder="Detalhes sobre a obrigação…"
              />
            </div>

            <div>
              <label className={appLabelClass}>Anexo PDF (opcional)</label>
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
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#1E242B] bg-[#12161A] px-3 py-3 text-left transition hover:border-[#2F3643] aria-disabled:opacity-50"
                aria-disabled={isSubmitting}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#13171D]">
                  {pdfFile ? (
                    <FileText className="h-4 w-4 text-primary" />
                  ) : (
                    <Upload className="h-4 w-4 text-[#94A3B8]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#F1F5F9]">
                    {pdfFile ? pdfFile.name : 'Anexar documento da obrigação'}
                  </p>
                  <p className="text-[10px] text-[#64748B]">
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
                    className="shrink-0 rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#1E242B] hover:text-[#F1F5F9]"
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
                  <div className="flex h-4 w-4 items-center justify-center rounded border border-[#2F3643] bg-[#12161A] transition-all peer-checked:border-primary peer-checked:bg-primary">
                    <CheckCircle2 className="h-3 w-3 text-[#080A0D] opacity-0 transition-opacity peer-checked:opacity-100" />
                  </div>
                </div>
                <span className="text-xs text-[#94A3B8]">Enviar aviso para o filho</span>
              </label>
            ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#1E242B] px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-2 text-xs font-bold text-[#94A3B8] transition hover:text-[#F1F5F9] disabled:opacity-50"
            >
              Cancelar
            </button>
            <AppPrimaryButton
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-w-[140px] items-center justify-center gap-2"
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
  );
}
