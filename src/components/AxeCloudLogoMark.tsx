import { cn } from '../lib/utils';
import {
  BRAND_LOGO_ALT,
  BRAND_LOGO_LIGHT_SRC,
  BRAND_LOGO_SRC,
  BRAND_SYMBOL_LIGHT_SRC,
  BRAND_SYMBOL_SRC,
} from '../constants/brandLogo';

export type AxeCloudLogoMarkSize = 'compact' | 'default' | 'large';

const sizeStyles: Record<AxeCloudLogoMarkSize, string> = {
  compact: 'h-10 w-auto max-w-[12rem]',
  default: 'h-12 w-auto max-w-[15rem]',
  large: 'h-16 w-auto max-w-[20rem]',
};

export function AxeCloudLogoMark({
  className,
  size = 'default',
  compact = false,
  tone = 'light',
}: {
  className?: string;
  size?: AxeCloudLogoMarkSize;
  compact?: boolean;
  tone?: 'light' | 'dark';
}) {
  const resolvedSize: AxeCloudLogoMarkSize = compact && size === 'default' ? 'compact' : size;
  return (
    <img
      src={tone === 'light' ? BRAND_LOGO_LIGHT_SRC : BRAND_LOGO_SRC}
      alt={BRAND_LOGO_ALT}
      width={560}
      height={140}
      className={cn('block shrink-0 object-contain object-left', sizeStyles[resolvedSize], className)}
      decoding="async"
    />
  );
}

export function AxeCloudEmblem({
  className,
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <img
      src={tone === 'light' ? BRAND_SYMBOL_LIGHT_SRC : BRAND_SYMBOL_SRC}
      alt=""
      aria-hidden
      width={64}
      height={64}
      className={cn('block h-8 w-8 shrink-0 object-contain', className)}
      decoding="async"
    />
  );
}
