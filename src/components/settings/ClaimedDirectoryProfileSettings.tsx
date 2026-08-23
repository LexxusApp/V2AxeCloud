import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  BadgeCheck,
  Camera,
  ExternalLink,
  Instagram,
  Loader2,
  MapPinned,
  Search,
} from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { marketingHref } from '../../lib/appHref';
import { AppPrimaryButton } from '../ui/appDemoUi';

type DirectoryProfile = {
  id: string;
  nome: string;
  endereco: string;
  telefone: string | null;
  ownerPhotoUrl: string | null;
  linkMaps: string | null;
  instagramUrl: string | null;
  cidade: string;
  estado: string;
  slug: string;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  verificada: boolean;
  updatedAt: string;
  perfilUrl: string | null;
};

type DirectoryResponse = {
  claimed: boolean;
  identityPhotoUrl?: string | null;
  profile: DirectoryProfile | null;
};

type PhotoSource = 'identity' | 'custom' | 'none';

const paperLabel =
  'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]';
const paperInput =
  'min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15';

function resolvePhotoSource(
  ownerPhotoUrl: string | null | undefined,
  identityPhotoUrl: string | null | undefined,
): PhotoSource {
  const owner = String(ownerPhotoUrl || '').trim();
  if (!owner) return 'none';
  const identity = String(identityPhotoUrl || '').trim();
  if (identity && owner === identity) return 'identity';
  return 'custom';
}

export function ClaimedDirectoryProfileSettings() {
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [profile, setProfile] = useState<DirectoryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoSource, setPhotoSource] = useState<PhotoSource>('none');
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void authFetch('/api/v1/settings/directory-profile')
      .then(async (response) => {
        const json = (await response.json()) as DirectoryResponse & { error?: string };
        if (!response.ok) throw new Error(json.error || 'Erro ao carregar o perfil reivindicado.');
        setData(json);
        setProfile(json.profile);
        setPhotoSource(resolvePhotoSource(json.profile?.ownerPhotoUrl, json.identityPhotoUrl));
      })
      .catch((error: unknown) =>
        setMessage({ text: error instanceof Error ? error.message : 'Erro ao carregar.', kind: 'error' }),
      )
      .finally(() => setLoading(false));
  }, []);

  const previewUrl =
    photoSource === 'identity'
      ? data?.identityPhotoUrl || null
      : photoSource === 'custom'
        ? profile?.ownerPhotoUrl || null
        : null;

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !profile) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Selecione uma imagem (JPG, PNG ou WebP).', kind: 'error' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: 'A imagem deve ter no máximo 5 MB.', kind: 'error' });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const encoded = result.split(',')[1];
          if (!encoded) reject(new Error('Falha ao ler a imagem.'));
          else resolve(encoded);
        };
        reader.onerror = () => reject(new Error('Erro ao processar a imagem.'));
        reader.readAsDataURL(file);
      });

      const response = await authFetch('/api/v1/settings/directory-profile/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: `diretorio.${fileExt}`,
          contentType: file.type,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Erro ao enviar foto.');

      const publicUrl = String(json.publicUrl || '').trim();
      if (!publicUrl) throw new Error('Upload concluído sem URL pública.');

      setPhotoSource('custom');
      setProfile({ ...profile, ownerPhotoUrl: publicUrl });
      setMessage({ text: 'Foto carregada. Clique em Salvar para publicar no mapa.', kind: 'info' });
    } catch (error: unknown) {
      setMessage({ text: error instanceof Error ? error.message : 'Erro ao enviar foto.', kind: 'error' });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await authFetch('/api/v1/settings/directory-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: profile.nome,
          endereco: profile.endereco,
          telefone: profile.telefone,
          cidade: profile.cidade,
          estado: profile.estado,
          bairro: profile.bairro,
          linkMaps: profile.linkMaps,
          instagramUrl: profile.instagramUrl,
          latitude: profile.latitude,
          longitude: profile.longitude,
          photoSource,
          ownerPhotoUrl: photoSource === 'custom' ? profile.ownerPhotoUrl : null,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Não foi possível atualizar o perfil.');
      const nextPhoto =
        (json.ownerPhotoUrl as string | null | undefined) ??
        (photoSource === 'identity'
          ? data?.identityPhotoUrl || null
          : photoSource === 'custom'
            ? profile.ownerPhotoUrl
            : null);
      setProfile({ ...profile, ownerPhotoUrl: nextPhoto, updatedAt: json.updatedAt || profile.updatedAt });
      setPhotoSource(resolvePhotoSource(nextPhoto, data?.identityPhotoUrl));
      setMessage({
        text: json.warning || 'Dados públicos atualizados.',
        kind: json.warning ? 'error' : 'success',
      });
    } catch (error: unknown) {
      setMessage({ text: error instanceof Error ? error.message : 'Erro ao atualizar o perfil.', kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="app-v5-panel grid min-h-40 place-items-center rounded-2xl">
        <Loader2 className="h-6 w-6 animate-spin text-[#526A55]" />
      </div>
    );
  }

  if (!data?.claimed || !profile) {
    return (
      <section className="app-v5-panel rounded-2xl p-6 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B08A22]">Diretório</p>
        <h3 className="mt-1 font-display text-xl font-black text-[#211D17]">Nenhum perfil reivindicado</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#70695F]">
          Encontre a página da sua casa no diretório e envie a reivindicação. Depois da aprovação, os dados do mapa
          ficam aqui.
        </p>
        <a
          href={marketingHref('/terreiros')}
          target="_blank"
          rel="noreferrer"
          className="app-v5-primary-button mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-black"
        >
          <Search className="h-4 w-4" /> Encontrar minha casa
        </a>
        {message ? <p className="mt-4 text-xs font-bold text-[#B96545]">{message.text}</p> : null}
      </section>
    );
  }

  return (
    <section className="app-v5-panel overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-5 border-b border-[#DED6C8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative h-[4.5rem] w-[4.5rem] shrink-0">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              aria-label={previewUrl ? 'Trocar foto do diretório' : 'Enviar foto do diretório'}
              className="h-full w-full overflow-hidden rounded-2xl border border-[#DED6C8] bg-[#EEE7DC]"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-[#9B9184]">
                  <Camera className="h-6 w-6" />
                </span>
              )}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Enviar foto"
              className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-[#FFFDF8] bg-[#E8C767] text-[#17251D] shadow-sm transition hover:bg-[#F0D47A] disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/*"
              onChange={(event) => void handlePhotoUpload(event)}
            />
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#F3E7C4] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#8A6200]">
                Perfil reivindicado
              </span>
              {profile.verificada ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E7EFE6] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#3F5A42]">
                  <BadgeCheck className="h-3 w-3" /> Verificado
                </span>
              ) : null}
            </div>
            <h3 className="truncate font-display text-xl font-black tracking-tight text-[#211D17]">
              {profile.nome || 'Nome da casa'}
            </h3>
            <p className="mt-0.5 truncate text-sm font-semibold text-[#70695F]">
              {profile.cidade || 'Cidade'} · {profile.estado || 'UF'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {data.identityPhotoUrl && photoSource !== 'identity' ? (
            <button
              type="button"
              onClick={() => setPhotoSource('identity')}
              className="min-h-10 rounded-xl border border-[#DED6C8] bg-white px-3 text-xs font-black text-[#526A55] transition hover:bg-[#F7F1E7]"
            >
              Usar foto da conta
            </button>
          ) : null}
          {previewUrl ? (
            <button
              type="button"
              onClick={() => {
                setProfile({ ...profile, ownerPhotoUrl: null });
                setPhotoSource('none');
              }}
              className="min-h-10 rounded-xl px-3 text-[11px] font-black text-[#B96545] transition hover:bg-[#B96545]/10"
            >
              Remover foto
            </button>
          ) : null}
          {profile.perfilUrl ? (
            <a
              href={marketingHref(profile.perfilUrl)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#DED6C8] bg-white px-3 text-xs font-black text-[#211D17] transition hover:bg-[#F7F1E7]"
            >
              Ver página pública <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#B08A22]">
          <MapPinned className="h-4 w-4" /> Dados do mapa
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={paperLabel}>Nome público da casa</label>
            <input
              value={profile.nome || ''}
              maxLength={180}
              onChange={(event) => setProfile({ ...profile, nome: event.target.value })}
              className={paperInput}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={paperLabel}>Endereço completo</label>
            <input
              value={profile.endereco || ''}
              maxLength={400}
              onChange={(event) => setProfile({ ...profile, endereco: event.target.value })}
              className={paperInput}
            />
          </div>
          <div>
            <label className={paperLabel}>WhatsApp público</label>
            <input
              type="tel"
              value={profile.telefone || ''}
              maxLength={20}
              onChange={(event) => setProfile({ ...profile, telefone: event.target.value })}
              className={paperInput}
              placeholder="(15) 99999-9999"
            />
          </div>
          <div>
            <label className={paperLabel}>Bairro</label>
            <input
              value={profile.bairro || ''}
              maxLength={120}
              onChange={(event) => setProfile({ ...profile, bairro: event.target.value })}
              className={paperInput}
            />
          </div>
          <div>
            <label className={paperLabel}>Cidade</label>
            <input
              value={profile.cidade || ''}
              maxLength={120}
              onChange={(event) => setProfile({ ...profile, cidade: event.target.value })}
              className={paperInput}
            />
          </div>
          <div>
            <label className={paperLabel}>Estado (UF)</label>
            <input
              value={profile.estado || ''}
              maxLength={2}
              onChange={(event) => setProfile({ ...profile, estado: event.target.value.toUpperCase() })}
              className={paperInput}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={paperLabel}>Link do Google Maps</label>
            <input
              type="url"
              value={profile.linkMaps || ''}
              onChange={(event) => setProfile({ ...profile, linkMaps: event.target.value })}
              className={paperInput}
              placeholder="https://www.google.com/maps/place/..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className={`${paperLabel} flex items-center gap-2`}>
              <Instagram className="h-3.5 w-3.5" /> Instagram oficial
            </label>
            <input
              type="url"
              value={profile.instagramUrl || ''}
              onChange={(event) => setProfile({ ...profile, instagramUrl: event.target.value })}
              className={paperInput}
              placeholder="https://www.instagram.com/sua.casa/"
            />
          </div>
          <div>
            <label className={paperLabel}>Latitude</label>
            <input
              type="number"
              step="any"
              value={profile.latitude ?? ''}
              onChange={(event) =>
                setProfile({ ...profile, latitude: event.target.value ? Number(event.target.value) : null })
              }
              className={paperInput}
            />
          </div>
          <div>
            <label className={paperLabel}>Longitude</label>
            <input
              type="number"
              step="any"
              value={profile.longitude ?? ''}
              onChange={(event) =>
                setProfile({ ...profile, longitude: event.target.value ? Number(event.target.value) : null })
              }
              className={paperInput}
            />
          </div>
        </div>

        {message ? (
          <p
            className={`mt-4 rounded-xl border px-3 py-2 text-xs font-bold ${
              message.kind === 'error'
                ? 'border-[#B96545]/30 bg-[#B96545]/10 text-[#B96545]'
                : message.kind === 'info'
                  ? 'border-[#347A8C]/25 bg-[#347A8C]/8 text-[#2A5F6C]'
                  : 'border-[#526A55]/25 bg-[#E7EFE6] text-[#3F5A42]'
            }`}
            role="status"
          >
            {message.text}
          </p>
        ) : null}

        <AppPrimaryButton
          className="app-v5-primary-button mt-5 inline-flex w-full items-center justify-center gap-2"
          onClick={() => void save()}
          disabled={saving || uploading}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          {saving ? 'Salvando…' : 'Salvar dados do mapa'}
        </AppPrimaryButton>
      </div>
    </section>
  );
}
