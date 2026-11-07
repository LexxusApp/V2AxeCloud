-- Additive metadata only. Existing visibility, recipient and download policies remain unchanged.
begin;
alter table public.biblioteca add column if not exists descricao text not null default '';
alter table public.biblioteca add constraint biblioteca_descricao_length check (length(descricao)<=4000) not valid;
commit;
