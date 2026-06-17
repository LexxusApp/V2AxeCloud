-- PDF privado de obrigação ligado ao filho (bucket biblioteca_estudos, pasta obrigacoes/).
alter table public.calendario_axe
  add column if not exists pdf_storage_path text;

comment on column public.calendario_axe.pdf_storage_path is
  'Caminho privado no storage (tenant/obrigacoes/filho_id/...) para documento PDF da obrigação.';
