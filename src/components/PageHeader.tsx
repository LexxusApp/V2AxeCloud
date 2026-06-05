import React from 'react';
import { ZeladorIdentityBadge } from './ZeladorIdentityBadge';

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
    <div className="page-header-shell mb-0 w-full min-w-0 max-w-full overflow-x-hidden bg-transparent py-3 md:mb-6 md:py-8">
      <header className="mx-auto flex min-w-0 max-w-[1440px] flex-col justify-between gap-4 md:gap-8 lg:flex-row lg:items-start lg:gap-6 xl:items-center">
        <div className="min-w-0 flex-1 max-w-full space-y-1 md:space-y-2 lg:pr-4">
          <h2 className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl md:text-4xl lg:text-4xl [&>*]:min-w-0">
            {title}
          </h2>
          {subtitle && (
            <p className="max-w-full text-sm font-medium text-gray-400 md:text-base break-words">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex min-w-0 max-w-full flex-col items-start gap-4 pb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end md:gap-4 xl:w-auto xl:flex-nowrap xl:items-center xl:gap-4 xl:pb-0">
          {actions && (
            <div className="flex min-w-0 shrink-0 items-center [&_.app-page-action]:inline-flex [&_.app-page-action]:w-auto [&_.app-page-action]:max-w-full">
              {actions}
            </div>
          )}

          {/* Badge de identificacao do zelador - apenas visual, sem dropdown.
             Configuracoes e Sair do Sistema vivem na sidebar para evitar duplicidade. */}
          <div className="relative hidden shrink-0 sm:ml-0 xl:block">
            <ZeladorIdentityBadge tenantData={tenantData} />
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
