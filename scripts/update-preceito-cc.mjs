import fs from 'fs';

const filePath = 'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/components/preceito/PreceitoCommandCenter.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Update React imports to include forwardRef and useImperativeHandle
code = code.replace(
  "import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';",
  "import { useCallback, useEffect, useMemo, useState, forwardRef, useImperativeHandle, type CSSProperties } from 'react';"
);

// 2. Export PreceitoCommandCenterHandle & update Props
const targetProps = `type Props = { tenantId: string; variant?: 'default' | 'dashboard-art' };`;
const replacementProps = `export type PreceitoCommandCenterHandle = {
  openWizard: () => void;
  openDetail: (cycle?: any) => void;
};

type Props = {
  tenantId: string;
  variant?: 'default' | 'dashboard-art' | 'hidden';
  onActiveCycleChange?: (active: Cycle | null, loading: boolean) => void;
};`;

code = code.replace(targetProps, replacementProps);

// 3. Update export default function PreceitoCommandCenter
const targetFn = `export default function PreceitoCommandCenter({ tenantId, variant = 'default' }: Props) {`;
const replacementFn = `const PreceitoCommandCenter = forwardRef<PreceitoCommandCenterHandle, Props>(function PreceitoCommandCenter(
  { tenantId, variant = 'default', onActiveCycleChange }: Props,
  ref
) {`;

code = code.replace(targetFn, replacementFn);

// 4. Add useImperativeHandle and effect for onActiveCycleChange
const targetHook = `  const openWizard = () => {`;
const replacementHook = `  useImperativeHandle(ref, () => ({
    openWizard: () => openWizard(),
    openDetail: (cycle?: any) => {
      const targetCycle = cycle || active;
      if (targetCycle) void openDetail(targetCycle);
      else openWizard();
    },
  }));

  useEffect(() => {
    onActiveCycleChange?.(active, loading);
  }, [active, loading, onActiveCycleChange]);

  const openWizard = () => {`;

code = code.replace(targetHook, replacementHook);

// 5. Update variant condition to support 'hidden'
const targetSection = `{variant === 'dashboard-art' ? (`;
const replacementSection = `{variant === 'hidden' ? null : variant === 'dashboard-art' ? (`;

code = code.replace(targetSection, replacementSection);

// 6. Export at the bottom
code = code + '\nexport default PreceitoCommandCenter;\n';

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated PreceitoCommandCenter with handle and hidden variant!');
