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
      <header className="mx-auto flex min-w-0 max-w-[1440px] flex-col gap-3 md:gap-4">
        <div className="flex min-w-0 items-start justify-between gap-4 md:gap-6">
          <div className="min-w-0 flex-1 space-y-1 md:space-y-2">
            <h2 className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl md:text-4xl lg:text-4xl [&>*]:min-w-0">
              {title}
            </h2>
            {subtitle ? (
              <p className="max-w-full break-words text-sm font-medium text-gray-400 md:text-base">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="hidden shrink-0 sm:block">
            <ZeladorIdentityBadge tenantData={tenantData} />
          </div>
        </div>

        {tabs ? <div className="page-header-tabs min-w-0 w-full">{tabs}</div> : null}

        {actions ? (
          <div className="page-header-actions flex min-w-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </header>
    </div>
  );
}
