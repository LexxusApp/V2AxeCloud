create table if not exists public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  description text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_gallery_albums_tenant_created
  on public.gallery_albums (tenant_id, created_at desc);

create table if not exists public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.gallery_albums(id) on delete cascade,
  tenant_id uuid not null,
  media_type text not null check (media_type in ('image', 'video')),
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  storage_key text not null unique,
  public_url text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_gallery_media_tenant_created
  on public.gallery_media (tenant_id, created_at desc);

create index if not exists idx_gallery_media_album_created
  on public.gallery_media (album_id, created_at desc);
