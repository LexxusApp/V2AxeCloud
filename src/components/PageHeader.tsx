import React from 'react';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  tenantData?: any;
  /**
   * Mantido por compatibilidade com chamadores antigos. O dropdown de
   * perfil foi removido (era redundante com a sidebar), entao esta prop
   * nao e mais utilizada internamente.
   */
  setActiveTab: (tab: string) => void;
}

export default function PageHeader({ title, subtitle, actions, tabs, tenantData }: PageHeaderProps) {
  return (
    <div className="mb-0 w-full min-w-0 max-w-full overflow-x-hidden bg-transparent px-3 py-3 sm:px-4 md:mb-6 md:px-6 md:py-8 lg:px-10">
      <header className="mx-auto flex min-w-0 max-w-[1440px] flex-col justify-between gap-6 md:gap-8 lg:flex-row lg:items-center">
        <div className="min-w-0 max-w-full space-y-1 md:space-y-2">
          <h2 className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl md:text-4xl lg:text-4xl [&>*]:min-w-0">
            {title}
          </h2>
          {subtitle && (
            <p className="max-w-full text-sm font-medium text-gray-400 md:text-base break-words">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex w-full min-w-0 max-w-full flex-col items-stretch gap-4 pb-2 lg:w-auto lg:max-w-none lg:flex-row lg:items-center lg:pb-0 md:gap-6">
          {actions && (
            <div className="w-full min-w-0 max-w-full lg:w-auto lg:max-w-none">
              {actions}
            </div>
          )}

          {/* Badge de identificacao do zelador - apenas visual, sem dropdown.
             Configuracoes e Sair do Sistema vivem na sidebar para evitar duplicidade. */}
          <div className="relative hidden shrink-0 lg:block">
            <div
              className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1 pr-3"
              aria-label="Identificação do zelador"
            >
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-primary bg-primary text-sm font-black text-background shadow-lg shadow-primary/20 md:h-9 md:w-9">
                {tenantData?.foto_url ? (
                  <img
                    src={tenantData.foto_url}
                    alt={tenantData?.nome || 'Terreiro'}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallbackInitial = (tenantData?.nome?.[0] || 'T').toUpperCase();
                        parent.innerHTML = fallbackInitial;
                      }
                    }}
                  />
                ) : (
                  (tenantData?.nome?.[0] || 'T').toUpperCase()
                )}
              </div>
              <div className="hidden flex-col items-start gap-0.5 md:flex">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight text-white">
                    {tenantData?.nome || 'Zelador'}
                  </span>
                  <span className="rounded-[4px] bg-[#FBBC00]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#FBBC00]">
                    {tenantData?.plan?.toUpperCase() || 'PREMIUM'}
                  </span>
                </div>
                {(tenantData?.role === 'filho' || tenantData?.cargo?.trim()) && (
                  <span className="max-w-[180px] truncate text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    {tenantData?.role === 'filho' ? 'Filho de Santo' : tenantData?.cargo?.trim()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      {tabs && (
        <div className="mx-auto mt-2 w-full min-w-0 max-w-[1440px] md:mt-0">
          {tabs}
        </div>
      )}
    </div>
  );
}
