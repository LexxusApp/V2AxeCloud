import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, CheckCircle, Loader2 } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { TRADICAO_OPTIONS } from '../../lib/tradicaoModules';
import { FounderHouseBadge } from '../founder/FounderHouseBadge';
import { useFounderHouseStatus } from '../../hooks/useFounderHouseStatus';

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
  onOpenPortal?: () => void;
};

export function SettingsProfilePanel({
  user,
  tenantId,
  profile,
  onProfileChange,
  onRefresh,
  onOpenPortal,
}: SettingsProfilePanelProps) {
  const { isFounderHouse, status: founderStatus, loading: founderLoading } = useFounderHouseStatus();
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
    <div className="animate-fadeIn space-y-6 rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 sm:p-6">
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

      <div className="flex flex-col gap-2 border-b border-[#1E242B] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h6 className="font-display text-sm font-bold text-[#F1F5F9]">Perfil do Zelador e do Terreiro</h6>
          <p className="mt-0.5 text-[11px] font-light text-gray-400">
            Nome litúrgico, identidade da casa e foto que aparecem no mural, financeiro e WhatsApp.
          </p>
        </div>
        <span className="shrink-0 rounded border border-[#3B82F6]/20 bg-blue-950/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#3B82F6]">
          Perfil Ativo
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
        <div className="space-y-4 md:col-span-7">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Nome Litúrgico do Zelador(a)
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Ex: Pai Alexandre de Ogum"
              className="w-full rounded-lg border border-[#1E242B] bg-[#12161A] p-2.5 text-xs text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Nome do Terreiro / Templo de Fé
            </label>
            <input
              type="text"
              value={profileTerreiro}
              onChange={(e) => setProfileTerreiro(e.target.value)}
              placeholder="Ex: Humaitá Luz do Amanhã"
              className="w-full rounded-lg border border-[#1E242B] bg-[#12161A] p-2.5 text-xs text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Tradição / Linha Dominante
            </label>
            <input
              type="text"
              readOnly
              value={tradicao}
              className="w-full cursor-default rounded-lg border border-[#1E242B] bg-[#12161A]/60 p-2.5 text-xs text-gray-400"
            />
            <p className="text-[10px] font-light text-gray-500">
              Altere em{' '}
              {onOpenPortal ? (
                <button
                  type="button"
                  onClick={onOpenPortal}
                  className="font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  Portal do Consulente
                </button>
              ) : (
                <span className="font-semibold text-cyan-400">Portal do Consulente</span>
              )}
              .
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Cargo Litúrgico / Sacerdotal
            </label>
            <select
              value={profileCargo}
              onChange={(e) => setProfileCargo(e.target.value)}
              className="w-full rounded-lg border border-[#1E242B] bg-[#12161A] p-2.5 text-xs text-[#F1F5F9] accent-blue-500 focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
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

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Foto de Perfil
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#1E242B] bg-[#12161A] px-4 py-2.5 text-xs font-bold text-[#F1F5F9] transition-all hover:border-[#3B82F6]/50 hover:bg-[#1E2530] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#3B82F6]" />
                ) : (
                  <Camera className="h-4 w-4 text-[#3B82F6]" />
                )}
                {isUploadingPhoto ? 'Enviando foto…' : 'Escolher do celular ou computador'}
              </button>
              {profileFoto ? (
                <button
                  type="button"
                  onClick={() => setProfileFoto('')}
                  className="text-[11px] font-semibold text-gray-500 hover:text-red-400"
                >
                  Remover foto
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/heic,image/*"
              onChange={(e) => void handlePhotoUpload(e)}
            />
            <p className="text-[10px] font-light text-gray-500">
              Tire uma foto ou escolha da galeria · JPG, PNG ou WebP · máx. 5 MB
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/10 transition-all hover:bg-blue-500 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {isSaving ? 'Salvando…' : 'Salvar Configurações do Perfil'}
            </button>
          </div>
        </div>

        <div className="space-y-4 md:col-span-5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            Crachá Sacerdotal Ativo
          </span>

          <div className="group relative overflow-hidden rounded-2xl border border-[#1E242B] bg-gradient-to-b from-[#1E2530] to-[#12161A] p-4 text-center shadow-lg">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600" />

            <div className="relative space-y-3.5">
              <div className="relative mx-auto mt-2 h-20 w-20">
                <div className="absolute inset-0 animate-pulse rounded-full bg-blue-500/20 blur-md filter" />
                <div className="relative z-10 mx-auto h-20 w-20 overflow-hidden rounded-full border-2 border-[#3B82F6] bg-[#12161A] shadow-inner">
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
                <span className="absolute bottom-0 right-1 z-20 h-4 w-4 rounded-full border-2 border-[#1E252E] bg-emerald-500" />
              </div>

              <div>
                <h6 className="max-w-full truncate font-display text-sm font-black text-[#F1F5F9]">
                  {profileName || 'Seu Nome de Fé'}
                </h6>
                <p className="mt-0.5 max-w-full truncate text-[10px] font-bold text-blue-400">
                  {profileCargo || 'Cargo Sacerdotal'}
                </p>
                <span className="mt-1 inline-block max-w-full truncate rounded border border-cyan-500/10 bg-blue-950/40 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-cyan-400">
                  🏛️ {profileTerreiro || 'Nome do Templo'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-1 border-t border-[#1E242B]/80 pt-2.5 text-[9px] leading-normal text-[#94A3B8]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Sincronia com Corrente Sacerdotal Ativada
              </div>
            </div>
          </div>

          <div className="space-y-1 rounded-xl border border-[#1E242B]/70 bg-zinc-950/40 p-3">
            <span className="block text-[8px] font-extrabold uppercase tracking-wider text-blue-400">
              Assinatura no WhatsApp Automatizado:
            </span>
            <p className="text-[10px] font-light italic leading-relaxed text-gray-400">
              &quot;🕯️ Salve a Corrente! Lembra-se que hoje nossa sessão inicia às 20:00. Com amor,{' '}
              <strong>{profileName || 'Zelador'}</strong> do <strong>{profileTerreiro || 'Terreiro'}</strong>.&quot;
            </p>
          </div>

          {isFounderHouse && <FounderHouseBadge variant="panel" />}
          {!founderLoading && !isFounderHouse && founderStatus === 'pending' && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Programa Fundador</p>
              <p className="mt-2 text-sm font-bold text-zinc-300">Inscrição em análise</p>
            </div>
          )}
          {!founderLoading && !isFounderHouse && founderStatus === 'contacted' && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Programa Fundador</p>
              <p className="mt-2 text-sm font-bold text-zinc-300">Em contato</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
