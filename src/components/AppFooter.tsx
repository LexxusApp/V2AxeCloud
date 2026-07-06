/** Rodapé no fluxo da página, discreto e sem elementos fixos. */
export default function AppFooter() {
  return (
    <footer className="app-footer relative mt-10 w-full px-4 pb-8 pt-7 sm:px-6">
      <div className="app-footer__glow" aria-hidden />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center">
        <div className="app-footer__line" aria-hidden />
        <p className="mt-5 text-center text-[11px] font-medium tracking-[0.05em] text-gray-500">
          © 2026 AxéCloud • CNPJ: 66.335.964/0001-07
        </p>
      </div>
    </footer>
  );
}
