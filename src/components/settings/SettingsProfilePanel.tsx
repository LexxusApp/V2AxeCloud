import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Building2, Camera, CheckCircle, Loader2, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { TRADICAO_OPTIONS } from '../../lib/tradicaoModules';

const CARGO_OPTIONS = [
  'Zelador de Santo (Pai de Santo)',
  'Zeladora de Santo (Mãe de Santo)',
  'Babalorixá',
  'Ialorixá',
  'Babalaô',
  'Zelador Geral da Corrente',
] as const;

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256';

type SettingsProfilePanelProps = {
  user: { id: string; email?: string | null };
  tenantId?: string;
  profile: Record<string, unknown> | null;
  onProfileChange: (next: Record<string, unknown>) => void;
  onRefresh?: (data?: { nome_terreiro?: string; foto_url?: string; cargo?: string | null }) => void | Promise<void>;
};

export function SettingsProfilePanel({
  user,
  tenantId,
  profile,
  onProfileChange,
  onRefresh,
}: SettingsProfilePanelProps) {
  const [profileName, setProfileName] = useState('');
  const [profileTerreiro, setProfileTerreiro] = useState('');
  const [profileCargo, setProfileCargo] = useState<string>(CARGO_OPTIONS[0]);
  const [profileFoto, setProfileFoto] = useState('');
  const [tradicao, setTradicao] = useState('—');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setProfileName(String(profile.zelador || profile.cargo || ''));
    setProfileTerreiro(String(profile.nome_terreiro || ''));
    const cargo = String(profile.cargo || CARGO_OPTIONS[0]);
    setProfileCargo(CARGO_OPTIONS.includes(cargo as (typeof CARGO_OPTIONS)[number]) ? cargo : cargo || CARGO_OPTIONS[0]);
    setProfileFoto(String(profile.foto_url || ''));
  }, [profile]);

  useEffect(() => {
    void authFetch('/api/v1/settings/portal-consulente')
      .then((res) => res.json())
      .then((json) => {
        const key = String(json.tradicao || 'mista');
        const label = TRADICAO_OPTIONS.find((o) => o.value === key)?.label ?? 'Mista';
        setTradicao(label);
      })
      .catch(() => setTradicao('Mista'));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  function notify(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
  }

  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('Selecione uma imagem (JPG, PNG ou WebP).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('A imagem deve ter no máximo 5 MB.', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
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

      const response = await authFetch('/api/v1/profile/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileName,
          contentType: file.type,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar foto.');
      }

      setProfileFoto(String(data.publicUrl || ''));
      notify('Foto carregada! Clique em Salvar para confirmar no perfil.', 'info');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao enviar foto.', 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!profileName.trim()) {
      notify('O seu nome litúrgico não pode ficar em branco.', 'error');
      return;
    }
    if (!profileTerreiro.trim()) {
      notify('O nome do Terreiro é um campo obrigatório.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const response = await authFetch('/api/v1/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          tenantId,
          profile: {
            zelador: profileName.trim(),
            nome_terreiro: profileTerreiro.trim(),
            cargo: profileCargo,
            foto_url: profileFoto.trim() || null,
            email: user.email,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Falha ao salvar (${response.status})`);
      }

      onProfileChange({
        ...profile,
        zelador: profileName.trim(),
        nome_terreiro: profileTerreiro.trim(),
        cargo: profileCargo,
        foto_url: profileFoto.trim() || null,
      });

      if (onRefresh) {
        await onRefresh({
          nome_terreiro: profileTerreiro.trim(),
          foto_url: profileFoto.trim() || undefined,
          cargo: profileCargo,
        });
      }

      notify('Alterações de Perfil gravadas com sucesso! Nome e Cargo sincronizados nas abas Corrente e chats.', 'success');
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Erro ao salvar perfil.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="animate-fadeIn space-y-4">
      {toast && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs font-bold ${
            toast.type === 'error'
              ? 'border-red-500/30 bg-red-950/30 text-red-300'
              : toast.type === 'info'
                ? 'border-blue-500/30 bg-blue-950/30 text-blue-300'
                : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      <section className="settings-dark-surface overflow-hidden rounded-[1.75rem] border border-[#252C35] bg-[#11151A] shadow-[0_24px_60px_-38px_rgba(0,0,0,0.95)]">
        <div className="relative overflow-hidden border-b border-[#2A323D] bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.24),transparent_42%),linear-gradient(135deg,#171C23_0%,#101419_65%)] px-5 py-6 sm:px-7">
          <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full border border-blue-400/10" />
          <div className="absolute -right-3 -top-7 h-28 w-28 rounded-full border border-blue-400/10" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-400 to-primary opacity-80 blur-[2px]" />
                <div className="relative h-20 w-20 overflow-hidden rounded-3xl border-4 border-[#151A21] bg-[#0B0D11]">
                  <img
                    src={profileFoto || FALLBACK_PHOTO}
                    alt={profileName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_PHOTO;
                    }}
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-4 border-[#151A21] bg-emerald-500 text-[#07120D]">
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">
                    Perfil ativo
                  </span>
                  <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-blue-300">
                    {tradicao}
                  </span>
                </div>
                <h3 className="truncate font-display text-xl font-black text-[#F8FAFC] sm:text-2xl">
                  {profileTerreiro || 'Nome da sua casa'}
                </h3>
                <p className="mt-1 truncate text-sm font-semibold text-[#A8B4C4]">
                  {profileName || 'Nome do zelador'} · {profileCargo || 'Cargo sacerdotal'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/25 bg-blue-400/10 px-4 text-xs font-black text-blue-200 transition hover:bg-blue-400/15 disabled:opacity-60"
              >
                {isUploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {isUploadingPhoto ? 'Enviando…' : 'Trocar foto'}
              </button>
              {profileFoto ? (
                <button
                  type="button"
                  onClick={() => setProfileFoto('')}
                  className="min-h-11 rounded-xl px-3 text-[11px] font-black text-rose-300 transition hover:bg-rose-500/10"
                >
                  Remover foto
                </button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/heic,image/*"
                onChange={(e) => void handlePhotoUpload(e)}
              />
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <div className="flex flex-col p-5 sm:p-7 lg:border-r lg:border-[#252C35]">
            <div className="mb-5">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-300">
                <UserRound className="h-4 w-4" aria-hidden />
                Dados exibidos no sistema
              </p>
              <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
                Essas informações aparecem no painel, nos avisos e no perfil da casa.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#A8B4C4]">
                  Nome litúrgico do zelador(a)
                </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Ex: Pai Alexandre de Ogum"
                  className="min-h-11 w-full rounded-xl border border-[#303946] bg-[#0D1116] px-3 text-sm font-semibold text-[#F8FAFC] placeholder:text-[#667385] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#A8B4C4]">
                  Nome do terreiro
                </label>
            <input
              type="text"
              value={profileTerreiro}
              onChange={(e) => setProfileTerreiro(e.target.value)}
              placeholder="Ex: Humaitá Luz do Amanhã"
                  className="min-h-11 w-full rounded-xl border border-[#303946] bg-[#0D1116] px-3 text-sm font-semibold text-[#F8FAFC] placeholder:text-[#667385] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#A8B4C4]">
                  Tradição
                </label>
            <input
              type="text"
              readOnly
              value={tradicao}
                  className="min-h-11 w-full cursor-default rounded-xl border border-[#303946] bg-[#171C23] px-3 text-sm font-semibold text-[#CBD5E1]"
            />
                <p className="text-[10px] font-semibold text-[#7F8B9C]">A tradição segue a identidade cadastrada para a casa.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#A8B4C4]">
                  Cargo litúrgico
                </label>
            <select
              value={profileCargo}
              onChange={(e) => setProfileCargo(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#303946] bg-[#0D1116] px-3 text-sm font-semibold text-[#F8FAFC] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            >
              {CARGO_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              {profileCargo && !CARGO_OPTIONS.includes(profileCargo as (typeof CARGO_OPTIONS)[number]) && (
                <option value={profileCargo}>{profileCargo}</option>
              )}
            </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="mt-5 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:opacity-50 lg:mt-auto"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {isSaving ? 'Salvando…' : 'Salvar identidade'}
            </button>
          </div>

          <aside className="relative overflow-hidden bg-[#0B0E12] p-5 sm:p-7">
            <div className="absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-blue-600/10 blur-3xl" />
            <div className="relative">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                <Sparkles className="h-4 w-4" aria-hidden />
                Onde essa identidade aparece
              </p>
              <div className="mt-4 space-y-2">
                {[
                  { icon: Building2, color: 'text-cyan-300 bg-cyan-400/10', title: 'Menu e cabeçalho', body: 'Nome e foto identificam a casa em todas as páginas.' },
                  { icon: ShieldCheck, color: 'text-emerald-300 bg-emerald-400/10', title: 'Comunicações oficiais', body: 'Zelador e terreiro assinam avisos enviados à corrente.' },
                  { icon: UserRound, color: 'text-violet-300 bg-violet-400/10', title: 'Perfil público', body: 'A mesma identidade mantém a apresentação consistente.' },
                ].map(({ icon: Icon, color, title, body }) => (
                  <div key={title} className="flex items-center gap-3 rounded-xl border border-[#252C35] bg-[#141920] px-3 py-2.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${color}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#F8FAFC]">{title}</p>
                      <p className="truncate text-[9px] font-semibold text-[#94A3B8]">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-primary">Exemplo de assinatura</p>
                <p className="mt-2 text-[11px] font-medium italic leading-relaxed text-[#CBD5E1]">
                  “Com amor, <strong className="text-white">{profileName || 'Zelador'}</strong> do{' '}
                  <strong className="text-white">{profileTerreiro || 'Terreiro'}</strong>.”
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
