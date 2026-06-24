/**
 * Fallback de carregamento de rotas (equivalente ao `loading.tsx` do Next.js App Router).
 * Usado pelo `AppRouter` via React Suspense e como shell inicial em `index.html`.
 */
export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950 text-white"
      role="status"
      aria-live="polite"
      aria-label="Carregando"
    >
      <div
        className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500"
        aria-hidden
      />
      <p className="animate-pulse text-sm font-medium tracking-wide text-neutral-400">
        Carregando AxéCloud...
      </p>
    </div>
  );
}
