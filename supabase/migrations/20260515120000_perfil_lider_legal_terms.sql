-- Aceite de Termos de Uso / Política de Privacidade (zelador)
alter table public.perfil_lider
  add column if not exists terms_accepted_version text,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.perfil_lider.terms_accepted_version is 'Versão dos termos aceita pelo zelador (ex.: 2026-05-15)';
comment on column public.perfil_lider.terms_accepted_at is 'Data/hora do aceite dos termos';
