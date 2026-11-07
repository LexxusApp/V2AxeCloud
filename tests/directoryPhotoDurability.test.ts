import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  googlePhotoUrlCandidates,
  isAllowedGooglePhotoUrl,
  isPublicDirectoryPhotoUrl,
} from '../api/lib/diretorioPhotoUrl';
import { resolveDiretorioCardPhotoUrl } from '../api/lib/diretorioPublicRoutes';

test('classifica fotos permanentes e temporárias do diretório', () => {
  const supabase = 'https://project.supabase.co/storage/v1/object/public/perfil_fotos/diretorio/a.jpg';
  const google = 'https://lh3.googleusercontent.com/gps-cs-s/abc=w1200-h900-k-no';
  const street = 'https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=abc&w=1200&h=800';

  assert.equal(isPublicDirectoryPhotoUrl(supabase), true);
  assert.equal(isAllowedGooglePhotoUrl(supabase), false);
  assert.equal(isAllowedGooglePhotoUrl(google), true);
  assert.equal(isAllowedGooglePhotoUrl(street), true);
  assert.equal(isPublicDirectoryPhotoUrl(google), false);
  assert.deepEqual(googlePhotoUrlCandidates(street), [street]);
});

test('card usa storage direto e proxy v3 somente para origem Google', () => {
  const permanent = 'https://project.supabase.co/storage/v1/object/public/perfil_fotos/diretorio/a.jpg';
  const google = 'https://lh3.googleusercontent.com/gps-cs-s/abc=w1200-h900-k-no';

  assert.equal(
    resolveDiretorioCardPhotoUrl({ owner_photo_url: permanent, foto_url: google }, 'casa-a'),
    permanent,
  );
  assert.equal(
    resolveDiretorioCardPhotoUrl({ foto_url: permanent }, 'casa-a'),
    permanent,
  );
  assert.equal(
    resolveDiretorioCardPhotoUrl({ foto_url: google }, 'casa-a'),
    '/api/v1/public/diretorio/foto/casa-a?v=3',
  );
  assert.equal(
    resolveDiretorioCardPhotoUrl({ foto_url: 'https://www.google.com/maps/place/x' }, 'casa-a'),
    null,
  );
});

test('vitrine pública não descarta mais o proxy de fotos', () => {
  const html = readFileSync('cinematic-site/terreiros.html', 'utf8');
  assert.doesNotMatch(html, /fotoCandidata\.includes\("\/api\/v1\/public\/diretorio\/foto\/"\)/);
  assert.doesNotMatch(html, /fotoUrl && !fotoUrl\.includes\('\/api\/v1\/public\/diretorio\/foto\/'\)/);
  assert.match(html, /loading="eager"/);
  assert.match(html, /onerror="this\.remove\(\)"/);
});

test('photo sweep migra casas que já possuem URL temporária mas não têm cópia permanente', () => {
  const worker = readFileSync('cloudflare/photo-sweep-worker/src/index.ts', 'utf8');
  assert.match(worker, /\.eq\("tipo", "terreiro"\)[\s\S]*?\.is\("owner_photo_url", null\)/);
  assert.doesNotMatch(worker, /\.is\("foto_url", null\)[\s\S]*?\.is\("owner_photo_url", null\)/);
  assert.match(worker, /owner_photo_url: storageUrl/);
  assert.match(worker, /storage retry/);
});
