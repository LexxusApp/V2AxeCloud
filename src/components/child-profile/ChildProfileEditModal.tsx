import React from 'react';
import { Loader2, UserRound, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../../lib/modalMotion';
import { AppPrimaryButton } from '../ui/appDemoUi';
import { cn } from '../../lib/utils';
import { resolveChildWhatsAppPhone } from '../../lib/whatsappPhone';
import BodyPortal from '../BodyPortal';

const ORIXAS = ['Oxalá', 'Iemanjá', 'Ogum', 'Oxóssi', 'Xangô', 'Iansã', 'Oxum', 'Nanã', 'Obaluaê', 'Exu', 'Pombagira'];

const paperLabelClass =
  'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]';
const paperInputClass =
  'min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15';

const fieldLabel = cn(paperLabelClass, 'mb-0.5 text-[9px]');
const fieldInput = cn(paperInputClass, 'py-1.5 text-[11px]');

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
        aria-labelledby="edit-child-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[101] flex w-full max-h-[88dvh] max-w-2xl flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#DED8CB] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1E8D2]">
              <UserRound className="h-3.5 w-3.5 text-[#8F7724]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 id="edit-child-title" className="font-display text-sm font-black leading-tight text-[#171A16]">
                Editar prontuário
              </h3>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#8F7724]">
                Dados cadastrais do filho
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="shrink-0 rounded-full border border-[#DCD6CA] bg-white/70 p-1.5 text-[#171A16] transition-colors hover:bg-white disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
                <label className={fieldLabel}>CPF completo</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  minLength={6}
                  pattern="\d{6}|\d{11}"
                  title="Informe o CPF completo (11 dígitos) ou, no mínimo, os 6 primeiros"
                  value={String(editData.cpf || '').replace(/\D/g, '').slice(0, 11)}
                  onChange={(e) => onChange('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="Ex.: 12345678900"
                  className={fieldInput}
                />
                <p className="mt-1 text-[10px] text-[#8A8070]">
                  11 dígitos liberam o comprovante automático. Os 6 primeiros continuam sendo a senha de acesso.
                </p>
              </div>
              <div className="col-span-2">
                <label className={fieldLabel}>WhatsApp</label>
                <input
                  type="tel"
                  value={resolveChildWhatsAppPhone(editData)}
                  onChange={(e) => onChange('whatsapp_phone', e.target.value)}
                  placeholder="11999999999"
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
                  className={cn(fieldInput, '[&>option]:bg-white')}
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

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#DED8CB] px-4 py-2.5">
            {showDelete && onDelete ? (
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={isDeleting || isSaving}
                className="rounded-lg bg-[#B04A32] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white transition hover:bg-[#9C3F2A] disabled:opacity-50"
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
                className="rounded-lg border border-[#D8D2C4] bg-white px-3 py-1.5 text-[11px] font-bold text-[#4A463E] transition hover:bg-[#F5F0E5] disabled:opacity-50"
              >
                Cancelar
              </button>
              <AppPrimaryButton
                type="submit"
                disabled={isSaving || isDeleting}
                className="inline-flex min-w-[96px] items-center justify-center gap-1.5 bg-[#17251D] px-3 py-1.5 text-[11px] text-[#FFFAF0] hover:bg-[#20342A]"
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
    </BodyPortal>
  );
}
