-- Lookup indexado para login filho (evita SELECT * em filhos_de_santo).
-- Executável apenas via service_role (API backend).

create or replace function public.find_filhos_for_login(
  p_id_prefix text,
  p_cpf_prefix text
)
returns table (
  id uuid,
  cpf text,
  user_id uuid,
  nome text
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.cpf, f.user_id, f.nome
  from public.filhos_de_santo f
  where char_length(trim(coalesce(p_id_prefix, ''))) >= 4
    and char_length(regexp_replace(trim(coalesce(p_cpf_prefix, '')), '[^0-9]', '', 'g')) >= 6
    and lower(replace(f.id::text, '-', '')) like lower(replace(trim(p_id_prefix), '-', '')) || '%'
    and regexp_replace(coalesce(f.cpf, ''), '[^0-9]', '', 'g')
        like regexp_replace(trim(p_cpf_prefix), '[^0-9]', '', 'g') || '%'
  limit 10;
$$;

revoke all on function public.find_filhos_for_login(text, text) from public;
revoke all on function public.find_filhos_for_login(text, text) from anon;
revoke all on function public.find_filhos_for_login(text, text) from authenticated;
grant execute on function public.find_filhos_for_login(text, text) to service_role;

notify pgrst, 'reload schema';
