import React from 'react';
import { Loader2, UserRound, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../../lib/modalMotion';
import { appInputClass, appLabelClass } from '../../lib/appUiTokens';
import { AppPrimaryButton } from '../ui/appDemoUi';
import { cn } from '../../lib/utils';

const ORIXAS = ['Oxalá', 'Iemanjá', 'Ogum', 'Oxóssi', 'Xangô', 'Iansã', 'Oxum', 'Nanã', 'Obaluaê', 'Exu', 'Pombagira'];

type ChildProfileEditModalProps = {
  open: boolean;
  onClose: () => void;
  editData: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
  onSave: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  isSaving: boolean;
  isDeleting: boolean;
  showDelete: boolean;
};

export function ChildProfileEditModal({
  open,
  onClose,
  editData,
  onChange,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
  showDelete,
}: ChildProfileEditModalProps) {
  if (!open) return null;

  const quizilasValue = Array.isArray(editData.quizilas)
    ? editData.quizilas.join(', ')
    : String(editData.quizilas || '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave();
  }

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
        aria-labelledby="edit-child-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[101] my-auto flex w-full max-h-[min(88dvh,calc(100dvh-5rem))] max-w-xl flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1E242B] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <UserRound className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 id="edit-child-title" className="text-sm font-bold text-[#F1F5F9] sm:text-base">
                Editar prontuário
              </h3>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[#94A3B8]">
                Dados cadastrais do filho
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="shrink-0 rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-[#12161A] hover:text-[#F1F5F9] disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
              <div className="sm:col-span-2">
                <label className={appLabelClass}>Nome completo</label>
                <input
                  type="text"
                  required
                  value={String(editData.nome || '')}
                  onChange={(e) => onChange('nome', e.target.value)}
                  className={appInputClass}
                />
              </div>

              <div>
                <label className={appLabelClass}>Nascimento</label>
                <input
                  type="date"
                  value={String(editData.data_nascimento || '')}
                  onChange={(e) => onChange('data_nascimento', e.target.value)}
                  className={appInputClass}
                />
              </div>
              <div>
                <label className={appLabelClass}>CPF</label>
                <input
                  type="text"
                  value={String(editData.cpf || '')}
                  onChange={(e) => onChange('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  className={appInputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={appLabelClass}>Endereço</label>
                <input
                  type="text"
                  value={String(editData.endereco || '')}
                  onChange={(e) => onChange('endereco', e.target.value)}
                  className={appInputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={appLabelClass}>Contato</label>
                <input
                  type="text"
                  value={String(editData.contato || '')}
                  onChange={(e) => onChange('contato', e.target.value)}
                  placeholder="WhatsApp ou telefone"
                  className={appInputClass}
                />
              </div>

              <div>
                <label className={appLabelClass}>Orixá de frente</label>
                <select
                  value={String(editData.orixa_frente || '')}
                  onChange={(e) => onChange('orixa_frente', e.target.value)}
                  className={cn(appInputClass, '[&>option]:bg-[#13171D]')}
                >
                  <option value="">Selecione…</option>
                  {ORIXAS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={appLabelClass}>Adjuntó</label>
                <input
                  type="text"
                  value={String(editData.adjunto || '')}
                  onChange={(e) => onChange('adjunto', e.target.value)}
                  className={appInputClass}
                />
              </div>

              <div>
                <label className={appLabelClass}>Entrada na casa</label>
                <input
                  type="date"
                  value={String(editData.data_entrada || '')}
                  onChange={(e) => onChange('data_entrada', e.target.value)}
                  className={appInputClass}
                />
              </div>
              <div>
                <label className={appLabelClass}>Feitura</label>
                <input
                  type="date"
                  value={String(editData.data_feitura || '')}
                  onChange={(e) => onChange('data_feitura', e.target.value)}
                  className={appInputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={appLabelClass}>Quizilas</label>
                <textarea
                  value={quizilasValue}
                  onChange={(e) => onChange('quizilas', e.target.value)}
                  rows={2}
                  placeholder="Separe por vírgula, se houver mais de uma"
                  className={cn(appInputClass, 'min-h-[72px] resize-none py-2')}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#1E242B] px-5 py-3.5">
            {showDelete && onDelete ? (
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={isDeleting || isSaving}
                className="rounded-xl border border-red-500/25 bg-red-950/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-red-400 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo…' : 'Excluir filho'}
              </button>
            ) : (
              <span />
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-2 text-xs font-bold text-[#94A3B8] transition hover:text-[#F1F5F9] disabled:opacity-50"
              >
                Cancelar
              </button>
              <AppPrimaryButton
                type="submit"
                disabled={isSaving || isDeleting}
                className="inline-flex min-w-[120px] items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  'Salvar'
                )}
              </AppPrimaryButton>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
