import React from 'react';
import { Loader2, UserRound, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../../lib/modalMotion';
import { appInputClass, appLabelClass } from '../../lib/appUiTokens';
import { AppPrimaryButton } from '../ui/appDemoUi';
import { cn } from '../../lib/utils';

const ORIXAS = ['Oxalá', 'Iemanjá', 'Ogum', 'Oxóssi', 'Xangô', 'Iansã', 'Oxum', 'Nanã', 'Obaluaê', 'Exu', 'Pombagira'];

const fieldLabel = cn(appLabelClass, 'mb-0.5 text-[9px]');
const fieldInput = cn(appInputClass, 'py-1.5 text-[11px]');

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-4 sm:p-6">
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
        className="relative z-[101] flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1E242B] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <UserRound className="h-3.5 w-3.5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 id="edit-child-title" className="text-sm font-bold leading-tight text-[#F1F5F9]">
                Editar prontuário
              </h3>
              <p className="text-[9px] font-medium uppercase tracking-widest text-[#64748B]">
                Dados cadastrais do filho
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="shrink-0 rounded-lg p-1.5 text-[#94A3B8] transition-colors hover:bg-[#12161A] hover:text-[#F1F5F9] disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-4">
                <label className={fieldLabel}>Nome completo</label>
                <input
                  type="text"
                  required
                  value={String(editData.nome || '')}
                  onChange={(e) => onChange('nome', e.target.value)}
                  className={fieldInput}
                />
              </div>

              <div>
                <label className={fieldLabel}>Nascimento</label>
                <input
                  type="date"
                  value={String(editData.data_nascimento || '')}
                  onChange={(e) => onChange('data_nascimento', e.target.value)}
                  className={fieldInput}
                />
              </div>
              <div>
                <label className={fieldLabel}>CPF</label>
                <input
                  type="text"
                  value={String(editData.cpf || '')}
                  onChange={(e) => onChange('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  className={fieldInput}
                />
              </div>
              <div className="col-span-2">
                <label className={fieldLabel}>Contato</label>
                <input
                  type="text"
                  value={String(editData.contato || '')}
                  onChange={(e) => onChange('contato', e.target.value)}
                  placeholder="WhatsApp ou telefone"
                  className={fieldInput}
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label className={fieldLabel}>Endereço</label>
                <input
                  type="text"
                  value={String(editData.endereco || '')}
                  onChange={(e) => onChange('endereco', e.target.value)}
                  className={fieldInput}
                />
              </div>

              <div className="col-span-2">
                <label className={fieldLabel}>Orixá de frente</label>
                <select
                  value={String(editData.orixa_frente || '')}
                  onChange={(e) => onChange('orixa_frente', e.target.value)}
                  className={cn(fieldInput, '[&>option]:bg-[#13171D]')}
                >
                  <option value="">Selecione…</option>
                  {ORIXAS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={fieldLabel}>Adjuntó</label>
                <input
                  type="text"
                  value={String(editData.adjunto || '')}
                  onChange={(e) => onChange('adjunto', e.target.value)}
                  className={fieldInput}
                />
              </div>

              <div className="col-span-2">
                <label className={fieldLabel}>Entrada na casa</label>
                <input
                  type="date"
                  value={String(editData.data_entrada || '')}
                  onChange={(e) => onChange('data_entrada', e.target.value)}
                  className={fieldInput}
                />
              </div>
              <div className="col-span-2">
                <label className={fieldLabel}>Feitura</label>
                <input
                  type="date"
                  value={String(editData.data_feitura || '')}
                  onChange={(e) => onChange('data_feitura', e.target.value)}
                  className={fieldInput}
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label className={fieldLabel}>Quizilas</label>
                <input
                  type="text"
                  value={quizilasValue}
                  onChange={(e) => onChange('quizilas', e.target.value)}
                  placeholder="Separe por vírgula"
                  className={fieldInput}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#1E242B] px-4 py-2.5">
            {showDelete && onDelete ? (
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={isDeleting || isSaving}
                className="rounded-lg border border-red-500/25 bg-red-950/20 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-red-400 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
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
                className="rounded-lg border border-[#1E242B] bg-[#12161A] px-3 py-1.5 text-[11px] font-bold text-[#94A3B8] transition hover:text-[#F1F5F9] disabled:opacity-50"
              >
                Cancelar
              </button>
              <AppPrimaryButton
                type="submit"
                disabled={isSaving || isDeleting}
                className="inline-flex min-w-[96px] items-center justify-center gap-1.5 px-3 py-1.5 text-[11px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
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
