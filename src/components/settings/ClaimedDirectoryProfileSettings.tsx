import { useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, Image, Instagram, Loader2, MapPinned, Save, Search, ShieldCheck } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { marketingHref } from '../../lib/appHref';

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

const inputClass =
  'mt-1.5 min-h-12 w-full rounded-xl border border-[#343D48] bg-[#0B1015] px-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-[#E5AE12] focus:ring-4 focus:ring-[#E5AE12]/10';

export function ClaimedDirectoryProfileSettings() {
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [profile, setProfile] = useState<DirectoryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [useIdentityPhoto, setUseIdentityPhoto] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  useEffect(() => {
    void authFetch('/api/v1/settings/directory-profile')
      .then(async (response) => {
        const json = (await response.json()) as DirectoryResponse & { error?: string };
        if (!response.ok) throw new Error(json.error || 'Erro ao carregar o perfil reivindicado.');
        setData(json);
        setProfile(json.profile);
        setUseIdentityPhoto(Boolean(json.profile?.ownerPhotoUrl));
      })
      .catch((error: unknown) => setMessage({ text: error instanceof Error ? error.message : 'Erro ao carregar.', kind: 'error' }))
      .finally(() => setLoading(false));
  }, []);

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
          useIdentityPhoto,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Não foi possível atualizar o perfil.');
      setProfile({ ...profile, ownerPhotoUrl: useIdentityPhoto ? data?.identityPhotoUrl || null : null, updatedAt: json.updatedAt || profile.updatedAt });
      setMessage({
        text: json.warning || 'Dados públicos atualizados. O perfil muda imediatamente e o mapa pode levar alguns minutos para renovar.',
        kind: json.warning ? 'error' : 'success',
      });
    } catch (error: unknown) {
      setMessage({ text: error instanceof Error ? error.message : 'Erro ao atualizar o perfil.', kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-40 place-items-center rounded-[1.75rem] border border-[#29313B] bg-[#10151A]"><Loader2 className="h-7 w-7 animate-spin text-[#E5AE12]" /></div>;
  }

  if (!data?.claimed || !profile) {
    return (
      <section className="overflow-hidden rounded-[1.75rem] border border-[#35302A] bg-[radial-gradient(circle_at_top_right,rgba(229,174,18,.13),transparent_38%),#11151A] p-6 text-white sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#E5AE12]/25 bg-[#E5AE12]/10 text-[#F7C94A]"><Search className="h-5 w-5" /></span>
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#F7C94A]">Diretório AxéCloud</p><h3 className="mt-1 text-xl font-black">Nenhum perfil reivindicado</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Encontre a página da sua casa no diretório e envie a reivindicação. Depois da aprovação, os dados do mapa poderão ser administrados aqui.</p></div>
          </div>
          <a href={marketingHref('/terreiros')} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#E5AE12] px-5 py-3 text-sm font-black text-[#17130D]"><Search className="h-4 w-4" /> Encontrar minha casa</a>
        </div>
        {message ? <p className="mt-4 text-xs font-bold text-rose-300">{message.text}</p> : null}
      </section>
    );
  }

  return (
    <section className="settings-dark-surface overflow-hidden rounded-[1.75rem] border border-[#314038] bg-[#0E1511] shadow-[0_28px_70px_-42px_rgba(0,0,0,.95)]">
      <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,.16),transparent_40%),linear-gradient(135deg,#13221A,#0D1410)] p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300"><MapPinned className="h-6 w-6" /></span>
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Perfil reivindicado</p><div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-white sm:text-2xl">Dados exibidos no mapa</h3>{profile.verificada ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-300"><BadgeCheck className="h-3 w-3" /> Verificado</span> : null}</div><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Estas informações aparecem na página pública, nas buscas por cidade e no mapa do AxéCloud.</p></div>
          </div>
          {profile.perfilUrl ? <a href={marketingHref(profile.perfilUrl)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:bg-white/10">Ver página pública <ExternalLink className="h-4 w-4" /></a> : null}
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-5 p-5 sm:p-7 lg:border-r lg:border-white/10">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 sm:col-span-2">Nome público da casa<input value={profile.nome || ''} maxLength={180} onChange={(event) => setProfile({ ...profile, nome: event.target.value })} className={inputClass} /></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 sm:col-span-2">Endereço completo<input value={profile.endereco || ''} maxLength={400} onChange={(event) => setProfile({ ...profile, endereco: event.target.value })} className={inputClass} /></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">WhatsApp público<input type="tel" value={profile.telefone || ''} maxLength={20} onChange={(event) => setProfile({ ...profile, telefone: event.target.value })} className={inputClass} placeholder="(15) 99999-9999" /></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bairro<input value={profile.bairro || ''} maxLength={120} onChange={(event) => setProfile({ ...profile, bairro: event.target.value })} className={inputClass} /></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cidade<input value={profile.cidade || ''} maxLength={120} onChange={(event) => setProfile({ ...profile, cidade: event.target.value })} className={inputClass} /></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Estado (UF)<input value={profile.estado || ''} maxLength={2} onChange={(event) => setProfile({ ...profile, estado: event.target.value.toUpperCase() })} className={inputClass} /></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 sm:col-span-2">Link do Google Maps<input type="url" value={profile.linkMaps || ''} onChange={(event) => setProfile({ ...profile, linkMaps: event.target.value })} className={inputClass} placeholder="https://www.google.com/maps/place/..." /></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 sm:col-span-2"><span className="flex items-center gap-2"><Instagram className="h-4 w-4 text-pink-400" />Instagram oficial</span><input type="url" value={profile.instagramUrl || ''} onChange={(event) => setProfile({ ...profile, instagramUrl: event.target.value })} className={inputClass} placeholder="https://www.instagram.com/sua.casa/" /></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Latitude<input type="number" step="any" value={profile.latitude ?? ''} onChange={(event) => setProfile({ ...profile, latitude: event.target.value ? Number(event.target.value) : null })} className={inputClass} /></label>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Longitude<input type="number" step="any" value={profile.longitude ?? ''} onChange={(event) => setProfile({ ...profile, longitude: event.target.value ? Number(event.target.value) : null })} className={inputClass} /></label>
          </div>
          {message ? <p className={`rounded-xl border px-4 py-3 text-xs font-bold ${message.kind === 'success' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`} role="status">{message.text}</p> : null}
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E5AE12] px-5 text-sm font-black text-[#17130D] transition hover:bg-[#F4C43A] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Publicando…' : 'Salvar dados do mapa'}</button>
        </div>

        <aside className="bg-[#0A100C] p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#F7C94A]"><ShieldCheck className="h-4 w-4" /> Controle do responsável</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#111A14]">
            <div className="aspect-[16/10] bg-[radial-gradient(circle_at_top,#244C38,#101812)]">
              {(useIdentityPhoto ? data.identityPhotoUrl : profile.ownerPhotoUrl) ? <img src={(useIdentityPhoto ? data.identityPhotoUrl : profile.ownerPhotoUrl) || ''} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-emerald-200/40"><Image className="h-10 w-10" /></div>}
            </div>
            <div className="p-4"><p className="font-black text-white">{profile.nome || 'Nome da casa'}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{profile.endereco || 'Endereço público'}</p><p className="mt-2 text-[10px] font-bold uppercase text-emerald-300">{profile.cidade || 'Cidade'} · {profile.estado || 'UF'}</p></div>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold leading-relaxed text-slate-300"><input type="checkbox" checked={useIdentityPhoto} onChange={(event) => setUseIdentityPhoto(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#E5AE12]" /><span>Usar no diretório a mesma foto cadastrada em <strong className="text-white">Conta e Casa</strong>.</span></label>
          <p className="mt-4 text-[10px] leading-relaxed text-slate-500">Por segurança, somente a conta aprovada pode alterar este registro. Mudanças de posição podem levar até cinco minutos para aparecer no mapa.</p>
        </aside>
      </div>
    </section>
  );
}
