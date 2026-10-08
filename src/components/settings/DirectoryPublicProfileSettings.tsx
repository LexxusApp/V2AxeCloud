import { useEffect, useState, type ChangeEvent } from 'react';
import { Camera, Eye, EyeOff, Images, Loader2, Save, Trash2 } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { TRADICAO_OPTIONS } from '../../lib/tradicaoModules';

type PublicationStatus = 'rascunho' | 'publicado' | 'oculto';
type PublicProfile = {
  coverPhotoUrl: string | null;
  galleryPhotoUrls: string[];
  descricaoPublica: string | null;
  orientacoesVisita: string | null;
  tradicao: string | null;
  publicacaoStatus: PublicationStatus;
};

const labelClass = 'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]';
const inputClass = 'min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15';

async function uploadImage(file: File, kind: 'cover' | 'gallery'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem JPG, PNG ou WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
  const fileData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '').split(',')[1];
      value ? resolve(value) : reject(new Error('Não foi possível ler a imagem.'));
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
  const response = await authFetch('/api/v1/settings/directory-profile/upload-photo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileData, fileName: file.name, contentType: file.type, kind }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.publicUrl) throw new Error(json.error || 'Erro ao enviar imagem.');
  return String(json.publicUrl);
}

export function DirectoryPublicProfileSettings() {
  const [claimed, setClaimed] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'cover' | 'gallery' | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    void authFetch('/api/v1/settings/directory-profile').then(async (response) => {
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar o perfil público.');
      setClaimed(Boolean(json.claimed));
      if (json.profile) setProfile({
        coverPhotoUrl: json.profile.coverPhotoUrl || null,
        galleryPhotoUrls: Array.isArray(json.profile.galleryPhotoUrls) ? json.profile.galleryPhotoUrls : [],
        descricaoPublica: json.profile.descricaoPublica || null,
        orientacoesVisita: json.profile.orientacoesVisita || null,
        tradicao: json.profile.tradicao || 'mista',
        publicacaoStatus: json.profile.publicacaoStatus || 'publicado',
      });
    }).catch((error: unknown) => setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar.' }))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>, kind: 'cover' | 'gallery') {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !profile) return;
    if (kind === 'gallery' && profile.galleryPhotoUrls.length >= 8) {
      setMessage({ kind: 'error', text: 'A galeria aceita até 8 fotos.' }); return;
    }
    setUploading(kind); setMessage(null);
    try {
      const url = await uploadImage(file, kind);
      setProfile(kind === 'cover'
        ? { ...profile, coverPhotoUrl: url }
        : { ...profile, galleryPhotoUrls: [...profile.galleryPhotoUrls, url] });
      setMessage({ kind: 'info', text: 'Imagem enviada. Clique em Salvar perfil público para confirmar.' });
    } catch (error: unknown) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Erro ao enviar imagem.' });
    } finally { setUploading(null); }
  }

  async function save() {
    if (!profile) return;
    setSaving(true); setMessage(null);
    try {
      const response = await authFetch('/api/v1/settings/directory-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Não foi possível salvar o perfil.');
      setProfile({
        ...profile,
        coverPhotoUrl: json.coverPhotoUrl ?? profile.coverPhotoUrl,
        galleryPhotoUrls: json.galleryPhotoUrls ?? profile.galleryPhotoUrls,
        descricaoPublica: json.descricaoPublica ?? profile.descricaoPublica,
        orientacoesVisita: json.orientacoesVisita ?? profile.orientacoesVisita,
        tradicao: json.tradicao ?? profile.tradicao,
        publicacaoStatus: json.publicacaoStatus ?? profile.publicacaoStatus,
      });
      setMessage({ kind: 'success', text: profile.publicacaoStatus === 'publicado' ? 'Perfil público atualizado.' : 'Alterações salvas sem exibir o perfil no diretório.' });
    } catch (error: unknown) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Erro ao salvar.' });
    } finally { setSaving(false); }
  }

  if (loading) return <div className="app-v5-panel grid min-h-40 place-items-center rounded-2xl"><Loader2 className="h-6 w-6 animate-spin text-[#526A55]" /></div>;
  if (!claimed || !profile) return null;

  const statusMeta = profile.publicacaoStatus === 'publicado'
    ? { icon: Eye, label: 'Publicado', copy: 'Visível no mapa e no perfil público.' }
    : { icon: EyeOff, label: profile.publicacaoStatus === 'oculto' ? 'Oculto' : 'Rascunho', copy: 'Não aparece no diretório público.' };
  const StatusIcon = statusMeta.icon;

  return <section className="app-v5-panel overflow-hidden rounded-2xl">
    <div className="flex flex-col gap-4 border-b border-[#DED6C8] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B08A22]">Identidade pública</p>
        <h3 className="mt-1 font-display text-xl font-black tracking-tight text-[#211D17]">Capa, história e galeria</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#70695F]">Tudo o que você salvar aqui aparece na página pública da casa.</p></div>
      <div className="flex items-center gap-2 rounded-xl border border-[#DED6C8] bg-white px-3 py-2">
        <StatusIcon className="h-4 w-4 text-[#526A55]" /><div><p className="text-xs font-black text-[#211D17]">{statusMeta.label}</p><p className="text-[10px] font-semibold text-[#70695F]">{statusMeta.copy}</p></div>
      </div>
    </div>

    <div className="space-y-6 p-5 sm:p-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3"><label className={labelClass}>Foto de capa</label><span className="text-[10px] font-semibold text-[#8A8174]">Horizontal · até 8 MB</span></div>
        <div className="relative min-h-48 overflow-hidden rounded-2xl border border-[#D8D2C4] bg-[#11251B]">
          {profile.coverPhotoUrl ? <img src={profile.coverPhotoUrl} alt="Prévia da capa" className="h-56 w-full object-cover opacity-90" /> : <div className="grid h-52 place-items-center text-center text-white/65"><span><Camera className="mx-auto h-7 w-7" /><strong className="mt-3 block text-sm">Adicione uma capa da casa</strong><small className="mt-1 block">Fachada, congá ou ambiente autorizado</small></span></div>}
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#F2C441] px-4 text-xs font-black text-[#17251D] shadow-lg">
              {uploading === 'cover' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{profile.coverPhotoUrl ? 'Trocar capa' : 'Adicionar capa'}
              <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={(event) => void handleUpload(event, 'cover')} />
            </label>
            {profile.coverPhotoUrl ? <button type="button" onClick={() => setProfile({ ...profile, coverPhotoUrl: null })} className="min-h-11 rounded-xl border border-white/30 bg-black/55 px-4 text-xs font-black text-white backdrop-blur">Remover</button> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={labelClass}>Tradição da casa</label><select value={profile.tradicao || 'mista'} onChange={(event) => setProfile({ ...profile, tradicao: event.target.value })} className={inputClass}>{TRADICAO_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div><label className={labelClass}>Visibilidade do perfil</label><select value={profile.publicacaoStatus} onChange={(event) => setProfile({ ...profile, publicacaoStatus: event.target.value as PublicationStatus })} className={inputClass}><option value="publicado">Publicado no diretório</option><option value="rascunho">Rascunho</option><option value="oculto">Oculto</option></select></div>
        <div className="sm:col-span-2"><label className={labelClass}>Biografia da casa</label><textarea rows={6} maxLength={2000} value={profile.descricaoPublica || ''} onChange={(event) => setProfile({ ...profile, descricaoPublica: event.target.value })} className={`${inputClass} resize-y`} placeholder="Conte a história, a tradição, a missão e como a casa acolhe a comunidade."/><p className="mt-1 text-right text-[10px] font-semibold text-[#8A8174]">{(profile.descricaoPublica || '').length}/2000</p></div>
        <div className="sm:col-span-2"><label className={labelClass}>Orientações para visitantes</label><textarea rows={4} maxLength={1500} value={profile.orientacoesVisita || ''} onChange={(event) => setProfile({ ...profile, orientacoesVisita: event.target.value })} className={`${inputClass} resize-y`} placeholder="Explique roupa indicada, antecedência, regras para fotos e como confirmar a visita."/><p className="mt-1 text-right text-[10px] font-semibold text-[#8A8174]">{(profile.orientacoesVisita || '').length}/1500</p></div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className={labelClass}>Galeria pública</p><p className="text-xs font-semibold text-[#70695F]">Até 8 fotos de ambientes, ritos e momentos autorizados.</p></div>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#C6AF78] bg-[#F8F1DF] px-4 text-xs font-black text-[#8A6200]">
            {uploading === 'gallery' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}Adicionar foto
            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading) || profile.galleryPhotoUrls.length >= 8} onChange={(event) => void handleUpload(event, 'gallery')} />
          </label>
        </div>
        {profile.galleryPhotoUrls.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{profile.galleryPhotoUrls.map((url, index) => <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-[#D8D2C4] bg-[#EEE7DC]"><img src={url} alt={`Foto ${index + 1} da galeria`} className="h-full w-full object-cover"/><button type="button" aria-label={`Remover foto ${index + 1}`} onClick={() => setProfile({ ...profile, galleryPhotoUrls: profile.galleryPhotoUrls.filter((item) => item !== url) })} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/65 text-white shadow-lg"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-[#D8D2C4] bg-[#FFFDF8] px-5 py-7 text-center text-xs font-semibold text-[#70695F]">A galeria ainda está vazia.</div>}
      </div>

      {message ? <p role="status" className={`rounded-xl border px-4 py-3 text-xs font-bold ${message.kind === 'success' ? 'border-[#526A55]/25 bg-[#E7EFE6] text-[#3F5A42]' : message.kind === 'error' ? 'border-[#B96545]/30 bg-[#B96545]/10 text-[#B96545]' : 'border-[#C6AF78] bg-[#F8F1DF] text-[#8A6200]'}`}>{message.text}</p> : null}
      <button type="button" onClick={() => void save()} disabled={saving || Boolean(uploading)} className="app-v5-primary-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-black disabled:opacity-55">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Salvando…' : 'Salvar perfil público'}</button>
    </div>
  </section>;
}
