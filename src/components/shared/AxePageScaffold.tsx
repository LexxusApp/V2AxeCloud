import React from 'react';
import { LucideIcon, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

// ==========================================
// 1. AXÉ PAGE HEADER (SOPHISTICATED BERRY HERO)
// ==========================================
export interface AxePageHeaderProps {
  kicker?: string;
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  theme?: 'forest' | 'liturgical' | 'gold' | 'night';
}

export function AxePageHeader({
  kicker,
  title,
  description,
  actions,
  badge,
  className,
  theme = 'forest',
}: AxePageHeaderProps) {
  const themeGradients = {
    forest: 'from-[#09150E] via-[#0F261B] to-[#173A2A]',
    gold: 'from-[#140E06] via-[#21180C] to-[#18261C]',
    liturgical: 'from-[#0A1612] via-[#12241C] to-[#193627]',
    night: 'from-[#071016] via-[#0D1C24] to-[#142825]',
  };

  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-lg p-6 sm:p-8 lg:p-9 shadow-[0_14px_40px_rgba(8,20,13,0.32)] border border-[#D4AF37]/35 transition-all duration-300',
        'bg-gradient-to-br text-white',
        themeGradients[theme] || themeGradients.forest,
        className,
      )}
    >
      {/* 1. Sacred Aura & ambient background glow */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-[#D4AF37]/25 via-[#1F5942]/35 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-gradient-to-tr from-[#1F5942]/40 via-[#0F261B]/50 to-transparent blur-2xl"
        aria-hidden="true"
      />

      {/* 2. Risco de Energia Sagrada em Ouro (Energy Stream Line) */}
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full opacity-40 mix-blend-screen"
        viewBox="0 0 1200 130"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="axe-header-gold-energy" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EBCB56" stopOpacity="0" />
            <stop offset="25%" stopColor="#F2CE55" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#FFF2B2" stopOpacity="0.95" />
            <stop offset="75%" stopColor="#F2CE55" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#E3B936" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M-20 95 Q 260 25 560 70 T 1220 45"
          stroke="url(#axe-header-gold-energy)"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M-40 105 Q 320 45 680 85 T 1240 60"
          stroke="url(#axe-header-gold-energy)"
          strokeWidth="1.2"
          strokeDasharray="6 8"
          fill="none"
          opacity="0.6"
        />
      </svg>

      {/* 3. Header Content */}
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          {kicker && (
            <div className="mb-3 flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5AE12]/18 border border-[#E5AE12]/45 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#F6C94C] shadow-sm backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F6C94C] animate-pulse" />
                {kicker}
                <span className="text-xs text-[#F6C94C]">✦</span>
              </span>
              {badge}
            </div>
          )}
          <h1 className="font-display text-2xl font-black tracking-tight text-white !text-white drop-shadow-sm sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2.5 max-w-2xl text-xs sm:text-sm font-medium leading-relaxed text-[#D2E2D7]">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

// ==========================================
// 2. AXÉ BUTTONS
// ==========================================
export interface AxeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export function AxeButton({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: AxeButtonProps) {
  const sizeClasses = {
    sm: 'min-h-9 px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'min-h-11 px-4 py-2 text-sm rounded-xl gap-2',
    lg: 'min-h-12 px-5 py-2.5 text-base rounded-lg gap-2.5',
  }[size];

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#174A35] to-[#22674B] hover:from-[#22674B] hover:to-[#2B7F5D] text-white shadow-[0_4px_16px_rgba(20,70,50,0.35)] font-black border border-[#D4AF37]/50 active:scale-[0.98]',
    secondary:
      'bg-white/12 hover:bg-white/20 text-white font-bold border border-white/25 shadow-sm backdrop-blur-md active:scale-[0.98]',
    ghost:
      'bg-white hover:bg-[#FAF7F2] text-[#17251D] font-bold border border-[#D8CDBA] shadow-xs active:scale-[0.98]',
    danger:
      'bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200 active:scale-[0.98]',
    gold:
      'bg-gradient-to-r from-[#B88728] to-[#E5AE12] hover:from-[#A87B22] hover:to-[#D4A010] text-[#0A160F] font-black border border-[#FFF0A3]/60 shadow-[0_4px_16px_rgba(229,174,18,0.3)] active:scale-[0.98]',
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center select-none transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer',
        sizeClasses,
        variantClasses,
        className,
      )}
      {...props}
    >
      {Icon && iconPosition === 'left' && (
        <Icon className={cn('shrink-0', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', loading && 'animate-spin')} />
      )}
      <span>{children}</span>
      {Icon && iconPosition === 'right' && (
        <Icon className={cn('shrink-0', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', loading && 'animate-spin')} />
      )}
    </button>
  );
}

// ==========================================
// 3. AXÉ METRIC RAIL & CARD (VIBRANT & ACCENTED)
// ==========================================
export function AxeMetricRail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4', className)}
      aria-label="Indicadores principais"
    >
      {children}
    </section>
  );
}

export interface AxeMetricCardProps {
  label: string;
  value: string | number | React.ReactNode;
  icon: LucideIcon;
  tone?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'neutral';
  subtext?: string | React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function AxeMetricCard({
  label,
  value,
  icon: Icon,
  tone = 'emerald',
  subtext,
  onClick,
  className,
}: AxeMetricCardProps) {
  const toneClasses = {
    emerald: {
      cardBg: 'bg-gradient-to-br from-white via-[#F4FAF6] to-[#E3F5EB]',
      border: 'border-[#A8DEC0] hover:border-[#86CFA7]',
      topBar: 'bg-[#1F5942]',
      iconBg: 'bg-[#E8F5EE] text-[#1F5942] border-[#C6E7D5]',
      valueColor: 'text-[#134431]',
    },
    amber: {
      cardBg: 'bg-gradient-to-br from-white via-[#FFFDF7] to-[#FEF4DC]',
      border: 'border-[#F8DC9B] hover:border-[#F2C86B]',
      topBar: 'bg-[#D4AF37]',
      iconBg: 'bg-[#FEF7E6] text-[#8F630E] border-[#FBE3B5]',
      valueColor: 'text-[#825406]',
    },
    rose: {
      cardBg: 'bg-gradient-to-br from-white via-[#FFF9F8] to-[#FDE8E5]',
      border: 'border-[#F8BCB3] hover:border-[#F2988C]',
      topBar: 'bg-[#C53030]',
      iconBg: 'bg-[#FDF0EE] text-[#9E2A1C] border-[#F7C8C2]',
      valueColor: 'text-[#8E2015]',
    },
    blue: {
      cardBg: 'bg-gradient-to-br from-white via-[#F7FAFD] to-[#E8F2FA]',
      border: 'border-[#BDD9EC] hover:border-[#96C2E0]',
      topBar: 'bg-[#0284C7]',
      iconBg: 'bg-[#EEF5FA] text-[#1E567B] border-[#CDE3F1]',
      valueColor: 'text-[#154E70]',
    },
    purple: {
      cardBg: 'bg-gradient-to-br from-white via-[#FAF7FB] to-[#F2E5F7]',
      border: 'border-[#DFC2E9] hover:border-[#CF9EE0]',
      topBar: 'bg-[#8B5CF6]',
      iconBg: 'bg-[#F5EEF9] text-[#6B2F96] border-[#DEC7E6]',
      valueColor: 'text-[#58217F]',
    },
    neutral: {
      cardBg: 'bg-gradient-to-br from-white via-[#FDFCFA] to-[#F6F0E6]',
      border: 'border-[#DDD4C5] hover:border-[#C4B9A7]',
      topBar: 'bg-[#59655E]',
      iconBg: 'bg-[#F4EDE2] text-[#59655E] border-[#E6DFD3]',
      valueColor: 'text-[#211D17]',
    },
  }[tone];

  return (
    <article
      onClick={onClick}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-lg border p-4 sm:p-5 shadow-[0_2px_10px_rgba(28,37,31,0.04)] transition-all duration-200 hover:shadow-[0_8px_24px_rgba(28,37,31,0.08)]',
        toneClasses.cardBg,
        toneClasses.border,
        onClick && 'cursor-pointer active:scale-[0.99]',
        className,
      )}
    >
      {/* Accent top stripe */}
      <div className={cn('absolute inset-x-0 top-0 h-1', toneClasses.topBar)} />

      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform duration-200 group-hover:scale-105',
            toneClasses.iconBg,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        {subtext && (
          <span className="text-[11px] font-bold text-[#6D7B74] text-right truncate">
            {subtext}
          </span>
        )}
      </div>

      <div className="mt-3.5">
        <strong className={cn('block font-display text-2xl sm:text-3xl font-black tabular-nums tracking-tight', toneClasses.valueColor)}>
          {value}
        </strong>
        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#4E5B54] line-clamp-1">
          {label}
        </p>
      </div>
    </article>
  );
}

// ==========================================
// 4. AXÉ FILTER BAR
// ==========================================
export interface AxeFilterBarProps {
  search?: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  };
  filterTabs?: {
    current: string;
    options: { id: string; label: string; count?: number }[];
    onChange: (id: string) => void;
  };
  sort?: {
    value: string;
    options: { id: string; label: string }[];
    onChange: (id: string) => void;
    label?: string;
  };
  rightActions?: React.ReactNode;
  className?: string;
}

export function AxeFilterBar({
  search,
  filterTabs,
  sort,
  rightActions,
  className,
}: AxeFilterBarProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-[#E2D8C7] bg-white p-3 sm:p-4 shadow-[0_2px_10px_rgba(28,37,31,0.03)] flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between',
        className,
      )}
      aria-label="Busca e filtros"
    >
      {/* Search Input */}
      {search && (
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A958E]" aria-hidden />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder || 'Buscar...'}
            className="w-full min-h-11 rounded-xl border border-[#D8CDBA] bg-[#FAF7F2] pl-10 pr-9 text-sm font-medium text-[#17251D] placeholder:text-[#8A958E] focus:border-[#1F5942] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F5942]/15 transition-all"
          />
          {search.value && (
            <button
              type="button"
              onClick={() => search.onChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A958E] hover:text-[#17251D] p-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Filter Tabs / Pills */}
      {filterTabs && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {filterTabs.options.map((option) => {
            const active = filterTabs.current === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => filterTabs.onChange(option.id)}
                className={cn(
                  'whitespace-nowrap px-3.5 py-2 text-xs font-bold rounded-xl border transition-all duration-150 shrink-0 inline-flex items-center gap-1.5 cursor-pointer',
                  active
                    ? 'border-[#1F5942] bg-[#1F5942] text-white shadow-xs font-black'
                    : 'border-[#E2D8C7] bg-[#FAF7F2] text-[#59655E] hover:border-[#D8CDBA] hover:bg-white hover:text-[#17251D]',
                )}
              >
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <span
                    className={cn(
                      'text-[10px] font-black rounded-full px-1.5 py-0.2',
                      active ? 'bg-white/20 text-white' : 'bg-white text-[#8A958E] border border-[#E6DFD3]',
                    )}
                  >
                    {option.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Sort / Right Controls */}
      <div className="flex items-center gap-2.5 shrink-0 justify-end">
        {sort && (
          <label className="flex items-center gap-2 text-xs font-bold text-[#59655E]">
            <span className="hidden sm:inline">{sort.label || 'Ordem'}:</span>
            <select
              value={sort.value}
              onChange={(e) => sort.onChange(e.target.value)}
              className="min-h-10 rounded-xl border border-[#D8CDBA] bg-white px-3 py-1.5 text-xs font-bold text-[#17251D] focus:border-[#1F5942] focus:outline-none focus:ring-1 focus:ring-[#1F5942] cursor-pointer"
            >
              {sort.options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {rightActions}
      </div>
    </section>
  );
}

// ==========================================
// 5. AXÉ CARD
// ==========================================
export function AxeCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <article
      onClick={onClick}
      className={cn(
        'rounded-lg border border-[#E2D8C7] bg-white p-4 sm:p-5 md:p-6 shadow-[0_2px_10px_rgba(28,37,31,0.03)] transition-all duration-200',
        onClick && 'cursor-pointer hover:border-[#D8CDBA] hover:shadow-[0_6px_20px_rgba(28,37,31,0.06)] active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </article>
  );
}

// ==========================================
// 6. AXÉ BADGE
// ==========================================
export interface AxeBadgeProps {
  children: React.ReactNode;
  variant?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'stone' | 'gold';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  className?: string;
}

export function AxeBadge({
  children,
  variant = 'emerald',
  size = 'sm',
  icon: Icon,
  className,
}: AxeBadgeProps) {
  const variantStyles = {
    emerald: 'bg-[#E8F5EE] text-[#1F5942] border-[#C6E7D5]',
    amber: 'bg-[#FEF7E6] text-[#8F630E] border-[#FBE3B5]',
    rose: 'bg-[#FDF0EE] text-[#9E2A1C] border-[#F7C8C2]',
    blue: 'bg-[#EEF5FA] text-[#1E567B] border-[#CDE3F1]',
    purple: 'bg-[#F5EEF9] text-[#6B2F96] border-[#DEC7E6]',
    stone: 'bg-[#F4EDE2] text-[#625F58] border-[#DFD9CE]',
    gold: 'bg-[#FEF5DC] text-[#8A5B08] border-[#F8DC9B]',
  }[variant];

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider',
    md: 'text-xs px-2.5 py-1 rounded-full font-bold',
  }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border select-none',
        variantStyles,
        sizeStyles,
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}

// ==========================================
// 7. AXÉ EMPTY STATE (ARTISANAL & SOPHISTICATED)
// ==========================================
export interface AxeEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function AxeEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: AxeEmptyStateProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden flex flex-col items-center justify-center rounded-lg border border-[#E2D8C7] bg-gradient-to-b from-[#FFFFFF] to-[#FAF7F2] p-8 sm:p-12 text-center shadow-[0_4px_16px_rgba(28,37,31,0.03)]',
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-[#E8F5EE] to-[#C6E7D5] text-[#1F5942] border border-[#B7E2CB] shadow-sm">
        <Icon className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="mt-4 font-display text-xl font-black text-[#17251D]">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm font-medium text-[#59655E] leading-relaxed">
        {description}
      </p>
      {action && (
        <AxeButton
          onClick={action.onClick}
          icon={action.icon}
          variant="primary"
          size="lg"
          className="mt-6"
        >
          {action.label}
        </AxeButton>
      )}
    </div>
  );
}

// ==========================================
// 8. AXÉ TABS BAR (SUBMODULES & SUBVIEWS)
// ==========================================
export interface AxeTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

export interface AxeTabsBarProps {
  tabs: AxeTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function AxeTabsBar({ tabs, activeTab, onChange, className }: AxeTabsBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black transition-all shrink-0 border cursor-pointer select-none',
              isActive
                ? 'bg-[#17251D] text-[#F6C94C] border-[#D4AF37]/50 shadow-[0_4px_14px_rgba(23,37,29,0.25)]'
                : 'bg-white/85 hover:bg-white text-[#59655E] hover:text-[#17251D] border-[#E6DFD3] hover:border-[#D8CDBA] shadow-2xs',
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-[#F6C94C]' : 'text-[#8A958E]',
                )}
              />
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span
                className={cn(
                  'ml-1 rounded-full px-2 py-0.5 text-[10px] font-black',
                  isActive
                    ? 'bg-[#E5AE12]/25 text-[#FFF2B2]'
                    : 'bg-[#F0EBE1] text-[#71685C]',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
