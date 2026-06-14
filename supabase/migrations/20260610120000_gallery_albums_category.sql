alter table public.gallery_albums
  add column if not exists category text check (category is null or category in ('gira', 'evento', 'lembranca'));

create index if not exists idx_gallery_albums_tenant_category
  on public.gallery_albums (tenant_id, category, created_at desc);
