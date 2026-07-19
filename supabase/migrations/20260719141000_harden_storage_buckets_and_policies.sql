-- Storage is written through server-authorized signed upload URLs.  Legacy
-- client policies unnecessarily exposed private library objects and allowed
-- direct writes that bypassed the API's tenant and file validation.

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['application/pdf']::text[]
where id = 'biblioteca_estudos';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ]::text[]
where id = 'loja_imagens';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif'
    ]::text[]
where id = 'perfil_fotos';

drop policy if exists "Admins podem fazer upload" on storage.objects;
drop policy if exists "Biblioteca Insert" on storage.objects;
drop policy if exists "Biblioteca Delete" on storage.objects;
drop policy if exists "Biblioteca Select" on storage.objects;

-- Public product images remain readable, but every write now goes through the
-- authenticated backend.  The private library is available only through
-- short-lived URLs/proxies issued after tenant authorization.
