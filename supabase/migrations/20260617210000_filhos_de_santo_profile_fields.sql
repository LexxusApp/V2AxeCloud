-- Campos do prontuário do filho de santo (UI ChildProfile v3).
alter table public.filhos_de_santo
  add column if not exists endereco text,
  add column if not exists adjunto text,
  add column if not exists data_feitura date;
