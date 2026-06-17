import type React from 'react';
import { cn } from '../lib/utils';

const pulse = 'animate-pulse bg-[#1E242B]/40 border border-[#1E242B]/60';

export function SkeletonBlock({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(pulse, 'rounded-lg', className)} {...props} />;
}

export function LibraryCardSkeleton({ embedded }: { embedded?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[#1E242B] bg-[#13171D] flex flex-col',
        embedded && 'min-h-0'
      )}
    >
      <SkeletonBlock className={cn('w-full rounded-none border-0', embedded ? 'h-32' : 'h-40')} />
      <div className={cn('space-y-2 p-3', embedded && 'p-2')}>
        <SkeletonBlock className="h-3 w-3/4" />
        <SkeletonBlock className="h-2 w-1/2" />
        <div className="flex gap-2 pt-2">
          <SkeletonBlock className="h-8 flex-1" />
        </div>
      </div>
    </div>
  );
}

export function CalendarEventRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#1E242B] bg-[#13171D] p-3">
      <SkeletonBlock className="h-14 w-[3.75rem] shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBlock className="h-3 w-16 rounded-full" />
        <SkeletonBlock className="h-4 w-4/5" />
        <SkeletonBlock className="h-3 w-32" />
      </div>
    </div>
  );
}

export function MensalidadeCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-card p-8 space-y-6">
      <div className="flex flex-col md:flex-row gap-8 justify-between">
        <div className="space-y-4 flex-1">
          <SkeletonBlock className="h-4 w-48" />
          <SkeletonBlock className="h-10 w-32" />
          <SkeletonBlock className="h-3 w-64" />
        </div>
        <SkeletonBlock className="h-12 w-40 rounded-xl self-start" />
      </div>
    </div>
  );
}

export function FilhoHomeSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <SkeletonBlock className="h-20 w-20 rounded-full" />
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="h-3 w-32" />
        </div>
      </div>
      <SkeletonBlock className="h-32 w-full rounded-2xl" />
      <div className="grid gap-3">
        <SkeletonBlock className="h-20 w-full rounded-xl" />
        <SkeletonBlock className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
