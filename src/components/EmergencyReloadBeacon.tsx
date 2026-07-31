import { performEmergencyHardReload } from '../lib/emergencyReload';

/**
 * Área quase invisível no canto inferior esquerdo — evita sobrepor o botão “voltar ao topo” da landing.
 */
export function EmergencyReloadBeacon() {
  return (
    <button
      type="button"
      aria-label="Recarregar aplicativo"
      title="Recarga de emergência (limpa cache do app)"
      className="pointer-events-auto fixed bottom-0 left-0 z-[99999] h-3 w-3 opacity-0 hover:opacity-20 active:bg-white/10"
      onClick={() => performEmergencyHardReload()}
    />
  );
}
