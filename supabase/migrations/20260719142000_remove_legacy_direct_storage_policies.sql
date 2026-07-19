-- Policy display names changed over the lifetime of the project. Remove every
-- legacy policy by its effective bucket predicate instead of relying on names.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%biblioteca_estudos%'
        or coalesce(with_check, '') ilike '%biblioteca_estudos%'
      )
  loop
    execute format('drop policy %I on storage.objects', policy_row.policyname);
  end loop;

  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (
        coalesce(qual, '') ilike '%loja_imagens%'
        or coalesce(with_check, '') ilike '%loja_imagens%'
      )
  loop
    execute format('drop policy %I on storage.objects', policy_row.policyname);
  end loop;
end
$$;
