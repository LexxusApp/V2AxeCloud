export function microphoneAccessErrorMessage(err: unknown): string {
  if (!window.isSecureContext) {
    return 'O microfone só funciona em conexão segura (HTTPS). Acesse o site via https://.';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Seu navegador não suporta gravação de áudio. Tente Chrome, Firefox ou Edge atualizados.';
  }
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return 'Permissão do microfone negada. Clique no ícone de cadeado na barra de endereço e permita o microfone para este site.';
    }
    if (err.name === 'NotFoundError') {
      return 'Nenhum microfone encontrado. Conecte um microfone e tente novamente.';
    }
    if (err.name === 'SecurityError') {
      return 'O acesso ao microfone está bloqueado pela política do site. Entre em contato com o suporte se o problema persistir.';
    }
  }
  return 'Não foi possível acessar o microfone. Verifique as permissões do navegador.';
}

export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new DOMException('Insecure context', 'SecurityError');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('getUserMedia not supported', 'NotSupportedError');
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function pickAudioMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
  return '';
}
