-- Execute inside BEGIN/ROLLBACK. No messages or real entries are retained.
do $$
declare t uuid; actor uuid; child uuid; other_child uuid; r public.financeiro; r2 public.financeiro; p jsonb; req uuid := gen_random_uuid(); before_count int;
begin
 select c.id,c.tenant_id,l.id into child,t,actor from filhos_de_santo c join perfil_lider l on c.tenant_id in(l.id,l.tenant_id) order by c.created_at desc limit 1;
 if child is null then raise exception 'No valid fixture context'; end if;
 -- Unique historical date within this rollback, independent from existing dues.
 delete from financeiro where filho_id=child and categoria='Mensalidade' and data between '2000-02-01' and '2000-02-29';
 p := jsonb_build_object('tipo','entrada','valor',102,'categoria','Mensalidade','data','2000-02-10','descricao','Regressão manual (vencimento 2000-02-10) (ID:'||child||')','filho_id',child,'status','pendente');
 r := registrar_lancamento_manual(actor,t,req,p);
 if r.filho_id<>child or r.valor<>102 or r.status<>'pendente' or not r.lancamento_manual or r.data_vencimento<>'2000-02-10'::date or r.data_pagamento is not null then raise exception 'Pending charge not persisted correctly'; end if;
 r2 := registrar_lancamento_manual(actor,t,req,p);
 if r.id<>r2.id then raise exception 'Retry duplicated entry'; end if;
 begin perform registrar_lancamento_manual(actor,t,gen_random_uuid(),p); raise exception 'Duplicate month accepted'; exception when unique_violation then null; end;
 begin perform registrar_lancamento_manual(actor,t,req,p||'{"valor":999}'::jsonb); raise exception 'Changed retry accepted'; exception when unique_violation then null; end;
 for i in 1..2 loop
   p := jsonb_build_object('tipo',case when i=1 then 'entrada' else 'saida' end,'valor',50,'categoria','Outros','data','2026-10-27','descricao','Regressão caixa','filho_id',child,'status','pendente');
   r := registrar_lancamento_manual(actor,t,gen_random_uuid(),p);
   if r.status<>'pago' or r.filho_id<>child or r.data_pagamento<>'2026-10-27'::date then raise exception 'Cash entry hidden or unlinked'; end if;
 end loop;
 -- Existing automatic pending charge becomes the explicit manual decision, preserving its ID.
 insert into financeiro(lider_id,tenant_id,tipo,valor,categoria,data,descricao,filho_id,status) values(actor,t,'entrada',80,'Mensalidade','2000-02-10','Auto',child,'pendente') returning * into r;
 delete from financeiro where filho_id=child and categoria='Mensalidade' and data='2000-02-10' and id<>r.id;
 p := jsonb_build_object('tipo','entrada','valor',105.5,'categoria','Mensalidade','data','2000-02-10','descricao','Quitação manual (competência 2000-02-10)','filho_id',child,'status','pago');
 r2 := registrar_lancamento_manual(actor,t,gen_random_uuid(),p);
 if r2.id<>r.id or r2.valor<>105.5 or r2.status<>'pago' or r2.data_pagamento is null then raise exception 'Automatic charge not replaced safely'; end if;
 select id into other_child from filhos_de_santo where tenant_id is distinct from t and lider_id is distinct from actor limit 1;
 if other_child is not null then begin perform registrar_lancamento_manual(actor,t,gen_random_uuid(),p||jsonb_build_object('filho_id',other_child)); raise exception 'Cross-tenant member accepted'; exception when insufficient_privilege then null; end; end if;
 if has_function_privilege('authenticated','public.registrar_lancamento_manual(uuid,uuid,uuid,jsonb)','EXECUTE') or has_function_privilege('anon','public.registrar_lancamento_manual(uuid,uuid,uuid,jsonb)','EXECUTE') then raise exception 'Private function exposed'; end if;
end $$;
