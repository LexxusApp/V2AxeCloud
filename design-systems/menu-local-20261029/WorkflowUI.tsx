import { useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import './workflows.css';

export function WorkflowDialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: ReactNode }) {
  const opener = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog wf-dialog" onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={e => { e.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); else document.querySelector<HTMLElement>('#main-content h1')?.focus(); }}><div className="dialog-heading"><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label="Fechar janela"><X size={20} /></button></Dialog.Close></div><Dialog.Description>{description}</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function WorkflowEmpty({ title, text }: { title: string; text: string }) { return <div className="wf-empty"><h3>{title}</h3><p>{text}</p></div>; }
export const textMatch = (text: string, query: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());
