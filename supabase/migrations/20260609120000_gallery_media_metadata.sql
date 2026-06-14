alter table public.gallery_media
  add column if not exists title text,
  add column if not exists caption text,
  add column if not exists category text check (category is null or category in ('gira', 'evento', 'lembranca')),
  add column if not exists likes_count integer not null default 0;

create index if not exists idx_gallery_media_tenant_category
  on public.gallery_media (tenant_id, category, created_at desc);
