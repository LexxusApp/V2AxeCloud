-- Gestão avançada do terreiro: módulos administrativos opcionais.
-- O acesso do produto passa pela API autenticada; nenhuma leitura anônima é permitida.

create table if not exists public.gestao_registros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  tipo text not null check (tipo in (
    'patrimonio', 'documentos', 'consulentes', 'atendimentos',
    'caminhada', 'liturgico', 'desenvolvimento', 'camarinha'
  )),
  titulo text not null check (char_length(trim(titulo)) between 2 and 160),
  descricao text,
  status text not null default 'ativo' check (char_length(status) between 2 and 40),
  data_inicio timestamptz,
  data_fim timestamptz,
  filho_id uuid references public.filhos_de_santo(id) on delete set null,
  valor numeric(14,2),
  metadata jsonb not null default '{}'::jsonb,
  criado_por uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim is null or data_inicio is null or data_fim >= data_inicio),
  check (valor is null or valor >= 0)
);

create index if not exists gestao_registros_tenant_tipo_idx
  on public.gestao_registros (tenant_id, tipo, updated_at desc);
create index if not exists gestao_registros_filho_idx
  on public.gestao_registros (tenant_id, filho_id, data_inicio desc)
  where filho_id is not null;
create index if not exists gestao_registros_datas_idx
  on public.gestao_registros (tenant_id, tipo, data_inicio, data_fim);

create or replace function public.touch_gestao_registros_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gestao_registros_touch_updated_at on public.gestao_registros;
create trigger gestao_registros_touch_updated_at
before update on public.gestao_registros
for each row execute function public.touch_gestao_registros_updated_at();

alter table public.gestao_registros enable row level security;
revoke all on public.gestao_registros from anon, authenticated;

comment on table public.gestao_registros is
  'Registros privados dos módulos Patrimônio, Documentos, Consulentes, Atendimentos, Caminhada, Calendário litúrgico, Desenvolvimento e Camarinha.';
comment on column public.gestao_registros.metadata is
  'Campos complementares validados pela API; nunca contém credenciais ou segredos.';
