/** Detecta link de recuperação de senha do Supabase Auth (hash ou query). */
export function isPasswordRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.replace(/^#/, '');
  const search = window.location.search.replace(/^\?/, '');
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(search);
  const type = hashParams.get('type') || searchParams.get('type');
  return type === 'recovery';
}
