import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  LEGAL_TERMS_SECTIONS,
  LEGAL_TERMS_SUMMARY,
  LEGAL_TERMS_TITLE,
} from '../content/legalTerms';
import { ROUTES } from '../lib/routes';

interface LegalTermsModalProps {
  open: boolean;
  onAccept: () => void | Promise<void>;
  accepting?: boolean;
}

export default function LegalTermsModal({ open, onAccept, accepting = false }: LegalTermsModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-[301] w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-2xl border border-white/10 bg-[#16171c] p-5 shadow-2xl shadow-black/50 outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200'
          )}
        >
          <Dialog.Title className="sr-only">{LEGAL_TERMS_TITLE}</Dialog.Title>
          <Dialog.Description className="sr-only">{LEGAL_TERMS_SUMMARY}</Dialog.Description>

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">{LEGAL_TERMS_TITLE}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">{LEGAL_TERMS_SUMMARY}</p>
            </div>
          </div>

          <div
            className="mt-4 max-h-[9.5rem] overflow-y-auto rounded-xl border border-white/5 bg-black/30 px-3 py-2.5 text-[11px] leading-relaxed text-gray-400 scrollbar-thin scrollbar-thumb-white/10"
            tabIndex={0}
          >
            {LEGAL_TERMS_SECTIONS.map((section) => (
              <div key={section.title} className="mb-3 last:mb-0">
                <p className="mb-0.5 text-[10px] font-black uppercase tracking-wider text-primary/90">
                  {section.title}
                </p>
                <p>{section.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-center text-[10px] text-zinc-500">
            <a href={ROUTES.terms} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
              Termos completos
            </a>
            {' · '}
            <a href={ROUTES.privacy} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
              Privacidade
            </a>
          </p>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-primary/20">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 accent-primary"
            />
            <span className="text-xs font-medium leading-snug text-gray-300">
              Li e aceito os Termos de Uso e a Política de Privacidade do AxéCloud.
            </span>
          </label>

          <button
            type="button"
            disabled={!checked || accepting}
            onClick={() => void onAccept()}
            className={cn(
              'mt-4 w-full rounded-xl bg-primary py-3 text-sm font-black text-background shadow-lg shadow-primary/25',
              'transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'
            )}
          >
            {accepting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando…
              </span>
            ) : (
              'Aceitar e continuar'
            )}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
