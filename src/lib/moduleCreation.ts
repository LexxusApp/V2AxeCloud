type Module = 'calendar' | 'financial';
type Scope = { userId: string; tenantId: string };
let pending: (Scope & { module: Module; expires: number }) | null = null;
/** One-shot intent in this tab only; never a persisted business operation. */
export function requestModuleCreation(scope: Scope, module: Module, now = Date.now()) {
  pending = scope.userId && scope.tenantId ? { ...scope, module, expires: now + 60000 } : null;
}
export function consumeModuleCreation(scope: Scope, module: Module, now = Date.now()): boolean {
  if (!pending) return false;
  if (pending.expires <= now || pending.userId !== scope.userId || pending.tenantId !== scope.tenantId) { pending = null; return false; }
  if (pending.module !== module) return false;
  pending = null;
  return true;
}
