import React from 'react';
import { hardRefreshFromStaleBundle, isRecoverableChunkError } from '../lib/urlHygiene';

type Props = { children: React.ReactNode };

type State = { hasError: boolean; recovering: boolean };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, recovering: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (isRecoverableChunkError(error) && hardRefreshFromStaleBundle()) {
      this.setState({ recovering: true });
      return;
    }
    console.error('[AppErrorBoundary]', error);
  }

  render() {
    if (this.state.recovering) {
      return (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950 text-white"
          role="status"
          aria-live="polite"
          aria-label="Atualizando aplicativo"
        >
          <div
            className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500"
            aria-hidden
          />
          <p className="text-sm font-medium tracking-wide text-neutral-400">Atualizando AxéCloud…</p>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold">Algo deu errado</h1>
            <p className="text-gray-400 text-sm">
              Recarregue a página. Se persistir, entre em contato com o suporte.
            </p>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-primary text-black font-semibold"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
