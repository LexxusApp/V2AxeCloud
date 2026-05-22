import React from 'react';

type Props = { children: React.ReactNode };

type State = { hasError: boolean };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[AppErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold">Algo deu errado</h1>
            <p className="text-gray-400 text-sm">Recarregue a página. Se persistir, entre em contato com o suporte.</p>
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
