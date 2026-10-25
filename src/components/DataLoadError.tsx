import { AlertCircle } from 'lucide-react';

export default function DataLoadError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="my-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{message}</p>
      <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-amber-400 px-4 py-2 font-bold hover:bg-amber-100">
        Tentar novamente
      </button>
    </div>
  );
}
