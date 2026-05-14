-- Normaliza perfil_lider.role para garantir consistência.
-- O AxéCloud só distingue 'filho' do resto (qualquer outro valor = admin/zelador).
-- Antes, alguns clientes foram criados via signup público com role='user', o que
-- causava o painel admin mostrar "user" enquanto outros mostravam "admin".
-- Esta migration deixa todos os não-filhos com role='admin'.
--
-- Idempotente: pode ser rodada várias vezes sem efeito colateral.

update public.perfil_lider
   set role = 'admin',
       updated_at = coalesce(updated_at, now())
 where role is null
    or (
       lower(coalesce(role, '')) <> 'filho'
       and lower(coalesce(role, '')) <> 'admin'
    );
