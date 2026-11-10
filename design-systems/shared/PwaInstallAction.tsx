import {useRef, useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {Download, X} from 'lucide-react';
import {usePwaInstall} from '../../src/hooks/usePwaInstall';
import {isIosPwaDevice} from '../../src/lib/pwaInstall';
import './pwa-install.css';

export default function PwaInstallAction({className, iconSize = 20}: {className?: string; iconSize?: number}) {
  const {isInstalled, canInstall, install} = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const lock = useRef(false);
  if (isInstalled) return null;

  async function startInstall() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await install();
      if (result === 'ios' || result === 'unavailable') setOpen(true);
      else setOpen(false);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <>
    <button type="button" className={className} title="Instalar app" aria-label="Instalar app" disabled={busy} onClick={() => void startInstall()}>
      <Download size={iconSize} aria-hidden="true"/><span>{busy ? 'Abrindo instalação…' : 'Instalar app'}</span>
    </button>
    <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal>
      <Dialog.Overlay className="axe-pwa-overlay"/>
      <Dialog.Content className="axe-pwa-dialog">
        <Dialog.Close className="axe-pwa-close" aria-label="Fechar instruções de instalação"><X size={20}/></Dialog.Close>
        <Download size={28} aria-hidden="true"/>
        <Dialog.Title>Instalar o AxéCloud</Dialog.Title>
        <Dialog.Description>Tenha o acesso à sua casa na tela inicial do celular ou no computador.</Dialog.Description>
        {isIosPwaDevice() ? <ol><li>Abra o AxéCloud no Safari.</li><li>Toque em Compartilhar e escolha <strong>Adicionar à Tela de Início</strong>.</li><li>Confirme em <strong>Adicionar</strong> e abra pelo novo ícone.</li></ol> : <>
          <ol><li>Abra o menu do navegador (⋮ ou …).</li><li>Procure <strong>Instalar AxéCloud</strong>, <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>. No Edge, procure também em <strong>Aplicativos</strong>.</li><li>Confirme a instalação e abra pelo novo ícone.</li></ol>
          <p>Se a opção não aparecer, abra este endereço no Chrome ou Edge atualizado, fora da navegação anônima. Se já instalou, procure o AxéCloud nos seus aplicativos.</p>
        </>}
        {canInstall && <button type="button" className="axe-pwa-confirm" disabled={busy} onClick={() => void startInstall()}>Instalar agora</button>}
        <Dialog.Close className="axe-pwa-confirm">Entendi</Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal></Dialog.Root>
  </>;
}
