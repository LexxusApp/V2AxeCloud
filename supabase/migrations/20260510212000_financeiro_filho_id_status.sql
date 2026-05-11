-- Garante colunas `filho_id` e `status` em `public.financeiro` (schema legado).
-- O front e o backend já lidam com schemas onde essas colunas estavam ausentes,
-- mas adicioná-las simplifica queries de débito (badge "TEM DÉBITO" do perfil)
-- e evita fallback por parsing de descrição.

alter table public.financeiro
  add column if not exists filho_id uuid,
  add column if not exists status text;

create index if not exists financeiro_filho_id_idx on public.financeiro (filho_id);
create index if not exists financeiro_status_idx on public.financeiro (status);

-- Backfill best-effort do `filho_id` a partir do padrão "(ID:<uuid>)" ou "FILHO_ID:<uuid>"
-- gravado na descricao pelo backend legado.
update public.financeiro
set filho_id = sub.match::uuid
from (
  select id,
         (regexp_match(descricao, '(?:FILHO_ID:|\(ID:)([0-9a-fA-F-]{36})'))[1] as match
  from public.financeiro
  where filho_id is null
    and descricao is not null
) sub
where public.financeiro.id = sub.id
  and sub.match is not null
  and public.financeiro.filho_id is null;

-- Backfill best-effort do `status` (apenas para linhas onde dá pra inferir com segurança).
update public.financeiro
set status = 'pendente'
where status is null
  and descricao ilike '%vencimento%'
  and descricao not ilike '%competência%'
  and descricao not ilike '%competencia%';

update public.financeiro
set status = 'pago'
where status is null
  and (descricao ilike '%competência%' or descricao ilike '%competencia%');

notify pgrst, 'reload schema';
