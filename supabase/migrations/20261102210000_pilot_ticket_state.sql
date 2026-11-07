begin;
create or replace function public.piloto_atualizar_senha(p_tenant uuid,p_event uuid,p_senha uuid,p_status text,p_antes text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;t public.evento_senhas;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_status not in ('chamado','atendido') or p_antes not in ('aguardando','presente','chamado') or p_status is null or p_antes is null then raise exception 'Situação de atendimento inválida' using errcode='22023';end if;
 perform 1 from public.calendario_axe where id=p_event and tenant_id=p_tenant for share;
 if not found then raise exception 'Gira não pertence a esta casa' using errcode='42501';end if;
 select * into t from public.evento_senhas where id=p_senha and event_id=p_event and tenant_id=p_tenant for update;
 if not found then raise exception 'Senha não pertence a esta gira' using errcode='42501';end if;
 if t.status=p_status then return jsonb_build_object('id',t.id,'status',t.status,'replayed',true);end if;
 if t.status<>p_antes then raise exception 'O atendimento foi atualizado em outro aparelho. Recarregue a fila.' using errcode='23505';end if;
 if (p_status='chamado' and t.status not in ('aguardando','presente')) or (p_status='atendido' and t.status<>'chamado') then raise exception 'Conclua as etapas do atendimento na ordem' using errcode='22023';end if;
 update public.evento_senhas set status=p_status,called_at=case when p_status='chamado' then now() else called_at end,attended_at=case when p_status='atendido' then now() else attended_at end where id=p_senha returning * into t;
 return jsonb_build_object('id',t.id,'status',t.status,'replayed',false);
end $$;
revoke all on function public.piloto_atualizar_senha(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.piloto_atualizar_senha(uuid,uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
