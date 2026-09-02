-- Radar: CEP estruturado para preenchimento assistido do endereço público.

alter table public.terreiros_diretorio
  add column if not exists cep text;
alter table public.terreiros_diretorio
  drop constraint if exists terreiros_diretorio_cep_check,
  add constraint terreiros_diretorio_cep_check
    check (cep is null or cep ~ '^[0-9]{8}$');
comment on column public.terreiros_diretorio.cep is
  'CEP com oito dígitos usado pelo Radar para preenchimento assistido e geocodificação.';
