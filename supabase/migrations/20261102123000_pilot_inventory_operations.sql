begin;
-- Shared stock column types are unchanged. Only pilot-owned rows are written.
-- Fractional units use thousandths in the existing integer fields; escala is
-- stored privately and used to decode exact quantities in the pilot adapter.
create table if not exists public.piloto_estoque_itens(
 item_id uuid primary key references public.almoxarifado(id) on delete cascade,
 tenant_id uuid not null,unidade text not null default 'un.' check(unidade in ('un.','kg','L','m','maços','garrafas')),
 escala integer not null default 1 check(escala in (1,1000)),localizacao text not null default '',observacoes text not null default '',arquivado boolean not null default false
);
create table if not exists public.piloto_estoque_movimentos(
 id uuid primary key,tenant_id uuid not null,item_ref uuid not null,nome text not null,unidade text not null,
 tipo text not null check(tipo in ('initial','in','out','adjust')),antes bigint not null,depois bigint not null,
 motivo text not null,created_at timestamptz not null default now()
);
alter table public.piloto_estoque_itens enable row level security;
alter table public.piloto_estoque_movimentos enable row level security;
revoke all on public.piloto_estoque_itens,public.piloto_estoque_movimentos from public,anon,authenticated;
grant select on public.piloto_estoque_itens,public.piloto_estoque_movimentos to authenticated;
drop policy if exists piloto_estoque_metadata_read on public.piloto_estoque_itens;
create policy piloto_estoque_metadata_read on public.piloto_estoque_itens for select to authenticated
 using(tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
drop policy if exists piloto_estoque_history_read on public.piloto_estoque_movimentos;
create policy piloto_estoque_history_read on public.piloto_estoque_movimentos for select to authenticated
 using(tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);

create or replace function public.piloto_salvar_estoque(p_tenant uuid,p_item uuid,p_input jsonb,p_before jsonb,p_movement jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid; f public.almoxarifado; meta public.piloto_estoque_itens; previous public.piloto_estoque_movimentos;
 existing boolean; unit_name text; item_name text; category_name text; quantity bigint; minimum bigint; movement_id uuid;
 current_snapshot jsonb; normalized jsonb; movement_kind text; movement_note text; prior_quantity bigint;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_item is null then raise exception 'Identificação do item obrigatória' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':pilot-stock',0));
 select * into f from public.almoxarifado where id=p_item for update;existing:=found;
 if existing and not(coalesce(f.tenant_id=p_tenant,false) or coalesce(f.lider_id=actor,false)) then
   raise exception 'Item não pertence a esta casa' using errcode='42501';end if;
 select * into meta from public.piloto_estoque_itens where item_id=p_item;
 prior_quantity:=case when existing then round(coalesce(f.quantidade_atual,0)::numeric*1000/coalesce(meta.escala,1))::bigint else 0 end;
 current_snapshot:=jsonb_build_object('id',p_item,'name',f.item,'category',coalesce(f.categoria,'Rituais'),'unit',coalesce(meta.unidade,'un.'),
   'quantity',prior_quantity,'minimum',round(coalesce(f.quantidade_minima,0)::numeric*1000/coalesce(meta.escala,1))::bigint,
   'location',coalesce(meta.localizacao,''),'notes',coalesce(meta.observacoes,''));
 if p_input is null then
   if not existing or current_snapshot is distinct from p_before then raise exception 'O item mudou; atualize antes de remover' using errcode='23505';end if;
   insert into public.piloto_estoque_itens(item_id,tenant_id,arquivado) values(p_item,p_tenant,true)
     on conflict(item_id) do update set arquivado=true;
   return jsonb_build_object('id',p_item,'archived',true);
 end if;
 unit_name:=p_input->>'unit';item_name:=btrim(p_input->>'name');category_name:=p_input->>'category';
 quantity:=(p_input->>'quantity')::bigint;minimum:=(p_input->>'minimum')::bigint;
 if unit_name is null or unit_name not in ('un.','kg','L','m','maços','garrafas') or item_name is null or length(item_name) not between 3 and 200
    or category_name is null or category_name not in ('Camarinha','Rituais','Cozinha de Santo','Vestuário','Limpeza')
    or quantity is null or quantity<0 or quantity>1000000000 or minimum is null or minimum<0 or minimum>1000000000
    or (unit_name not in ('kg','L','m') and (quantity%1000<>0 or minimum%1000<>0))
    or length(coalesce(p_input->>'location',''))>500 or length(coalesce(p_input->>'notes',''))>4000 then
   raise exception 'Confira os dados, a unidade e as quantidades do item' using errcode='22023';end if;
 normalized:=jsonb_build_object('id',p_item,'name',item_name,'category',category_name,'unit',unit_name,'quantity',quantity,'minimum',minimum,
   'location',coalesce(p_input->>'location',''),'notes',coalesce(p_input->>'notes',''));
 if p_movement is not null then
   movement_id:=(p_movement->>'id')::uuid;movement_kind:=p_movement->>'kind';movement_note:=btrim(p_movement->>'note');
   if movement_id is null or movement_kind is null or movement_kind not in ('initial','in','out','adjust') or movement_note is null or length(movement_note) not between 3 and 1500
      or p_movement->>'itemId' is distinct from p_item::text or p_movement->>'unit' is distinct from unit_name
      or (p_movement->>'after')::numeric is distinct from quantity::numeric then raise exception 'Movimentação inválida' using errcode='22023';end if;
   select * into previous from public.piloto_estoque_movimentos where id=movement_id;
   if found then
     if previous.tenant_id<>p_tenant or previous.item_ref<>p_item or previous.tipo<>movement_kind or previous.depois<>quantity
        or previous.antes::numeric is distinct from (p_movement->>'before')::numeric or previous.motivo<>movement_note
        or current_snapshot is distinct from normalized or coalesce(meta.arquivado,false) then
       raise exception 'Esta tentativa não corresponde ao movimento já salvo; atualize o estoque' using errcode='23505';end if;
     return jsonb_build_object('id',p_item,'replayed',true);
   end if;
 end if;
 if existing then
   if coalesce(meta.arquivado,false) and p_before is null then
     if current_snapshot is distinct from normalized or p_movement is not null then raise exception 'O item arquivado mudou; confira antes de restaurar' using errcode='23505';end if;
   elsif current_snapshot is distinct from p_before then raise exception 'O saldo ou cadastro mudou; atualize antes de salvar' using errcode='23505';end if;
   if unit_name is distinct from coalesce(meta.unidade,'un.') then raise exception 'A unidade de um item existente não pode ser trocada' using errcode='22023';end if;
 else
   if p_before is not null or movement_kind is distinct from 'initial' then raise exception 'Informe o saldo inicial para cadastrar o item' using errcode='22023';end if;
 end if;
 if (not existing or quantity<>prior_quantity) and p_movement is null then raise exception 'Informe o movimento para alterar o saldo' using errcode='22023';end if;
 if p_movement is not null then
   if (p_movement->>'before')::numeric is distinct from prior_quantity::numeric or
      (not existing and movement_kind<>'initial') or (existing and movement_kind='initial') or
      (movement_kind='in' and quantity<=prior_quantity) or (movement_kind='out' and quantity>=prior_quantity) or
      (movement_kind='adjust' and quantity=prior_quantity) then raise exception 'O saldo do movimento não corresponde ao estoque' using errcode='23505';end if;
 end if;
 if exists(select 1 from public.almoxarifado a left join public.piloto_estoque_itens m on m.item_id=a.id where a.id<>p_item
   and (a.tenant_id=p_tenant or a.lider_id=actor) and not coalesce(m.arquivado,false) and lower(btrim(a.item))=lower(item_name)) then
   raise exception 'Já existe um item com este nome' using errcode='23505';end if;
 if existing then update public.almoxarifado set item=item_name,categoria=category_name,quantidade_atual=case when unit_name in ('kg','L','m') then quantity else quantity/1000 end,quantidade_minima=case when unit_name in ('kg','L','m') then minimum else minimum/1000 end where id=p_item;
 else insert into public.almoxarifado(id,lider_id,tenant_id,item,categoria,quantidade_atual,quantidade_minima)
   values(p_item,actor,p_tenant,item_name,category_name,case when unit_name in ('kg','L','m') then quantity else quantity/1000 end,case when unit_name in ('kg','L','m') then minimum else minimum/1000 end);end if;
 insert into public.piloto_estoque_itens(item_id,tenant_id,unidade,escala,localizacao,observacoes,arquivado)
 values(p_item,p_tenant,unit_name,case when unit_name in ('kg','L','m') then 1000 else 1 end,normalized->>'location',normalized->>'notes',false)
 on conflict(item_id) do update set unidade=excluded.unidade,escala=excluded.escala,localizacao=excluded.localizacao,observacoes=excluded.observacoes,arquivado=false;
 if p_movement is not null then insert into public.piloto_estoque_movimentos(id,tenant_id,item_ref,nome,unidade,tipo,antes,depois,motivo)
   values(movement_id,p_tenant,p_item,item_name,unit_name,movement_kind,prior_quantity,quantity,movement_note);end if;
 return jsonb_build_object('id',p_item,'archived',false);
end $$;
revoke all on function public.piloto_salvar_estoque(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.piloto_salvar_estoque(uuid,uuid,jsonb,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
