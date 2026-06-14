import React from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Coins,
  FileText,
  Flame,
  Info,
  Loader2,
  Lock,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  StickyNote,
  User,
  Camera,
} from 'lucide-react';
import Avatar from '../Avatar';
import { cn } from '../../lib/utils';

export type ChildProfileTab = 'info' | 'history' | 'finance' | 'notes';

export type ZeladorNoteItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type ChildProfileV3ViewProps = {
  child: Record<string, unknown>;
  isSelfView: boolean;
  activeTab: ChildProfileTab;
  onTabChange: (tab: ChildProfileTab) => void;
  onBack: () => void;
  onEditOpen: () => void;
  hasDebt: boolean;
  valorMensalidade: number;
  childObligations: Array<{ titulo?: string; data?: string; descricao?: string; status_confirmacao?: string }>;
  onAddObligation: () => void;
  sortedZeladorNotes: ZeladorNoteItem[];
  onNewNote: () => void;
  onOpenNote: (note: ZeladorNoteItem) => void;
  notesLocked: boolean;
  formatNoteDate: (iso: string) => string;
  cpf: string;
  endereco: string;
  contato: string;
  adjunto: string;
  dataFeitura: string;
  anosDeCasa: number | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPhotoClick: () => void;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploadingPhoto: boolean;
};

const EMPTY = 'Aguardando preenchimento';

function formatDate(value: unknown): string {
  if (!value || typeof value !== 'string') return EMPTY;
  try {
    return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return value;
  }
}

function quizilasText(child: Record<string, unknown>): string {
  const q = child.quizilas;
  if (Array.isArray(q)) return q.filter(Boolean).join(', ') || '';
  if (typeof q === 'string') return q;
  return '';
}

function whatsappHref(contato: string): string | null {
  const digits = contato.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}

function matricula(child: Record<string, unknown>): string {
  const id = String(child.id || '');
  const year = child.data_entrada
    ? new Date(String(child.data_entrada)).getFullYear()
    : new Date().getFullYear();
  return `AXC-${year}-${id.substring(0, 4).toUpperCase()}`;
}

function maturityPercent(anos: number | null): number {
  if (anos == null || anos <= 0) return 12;
  return Math.min(100, Math.round((anos / 7) * 100));
}

function InfoField({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }) {
  const filled = value && value !== EMPTY;
  return (
    <div className="space-y-1">
      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#94A3B8]">
        {Icon ? <Icon className="h-3 w-3 text-[#FACC15]" /> : null}
        {label}
      </span>
      <span
        className={cn(
          'block text-sm font-extrabold',
          filled ? 'font-display text-[#F1F5F9]' : 'italic font-normal text-gray-500 text-xs',
        )}
      >
        {filled ? value : EMPTY}
      </span>
    </div>
  );
}

export function ChildProfileV3View({
  child,
  isSelfView,
  activeTab,
  onTabChange,
  onBack,
  onEditOpen,
  hasDebt,
  valorMensalidade,
  childObligations,
  onAddObligation,
  sortedZeladorNotes,
  onNewNote,
  onOpenNote,
  notesLocked,
  formatNoteDate,
  cpf,
  endereco,
  contato,
  adjunto,
  dataFeitura,
  anosDeCasa,
  fileInputRef,
  onPhotoClick,
  onPhotoChange,
  isUploadingPhoto,
}: ChildProfileV3ViewProps) {
  const nome = String(child.nome || 'Filho de Santo');
  const cargo = String(child.cargo || 'Filho de Santo');
  const orixaFrente = String(child.orixa_frente || '');
  const status = String(child.status || 'Ativo');
  const fotoUrl = child.foto_url ? String(child.foto_url) : null;
  const userId = child.user_id ? String(child.user_id) : '';
  const quizilas = quizilasText(child);
  const waLink = whatsappHref(contato);
  const registro = matricula(child);
  const maturity = maturityPercent(anosDeCasa);
  const initials = nome.substring(0, 2).toUpperCase();

  const tabs: { id: ChildProfileTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'info', label: 'Dados Cadastrais', icon: User },
    { id: 'history', label: 'Evolução Espiritual', icon: Sparkles },
    { id: 'finance', label: 'Financeiro / Mensalidades', icon: Coins },
    { id: 'notes', label: 'Anotações Sacramentais', icon: FileText },
  ];

  return (
    <div className="animate-fadeIn space-y-6 text-[#F1F5F9]">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1E242B] bg-[#13171D] px-5 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex cursor-pointer items-center gap-1 font-bold text-[#94A3B8] transition-colors hover:text-[#FACC15]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para a Corrente
          </button>
          <span className="text-gray-600">/</span>
          <span className="font-medium text-gray-400">Perfil Sacerdotal</span>
          <span className="text-gray-600">/</span>
          <span className="font-black tracking-wider text-[#FACC15]">{nome.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-900 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Sessão Segura
          </span>
          {hasDebt && isSelfView && (
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Mensalidade pendente</span>
          )}
        </div>
      </div>

      {/* Passport header */}
      <div className="relative overflow-hidden rounded-2xl border border-[#222B36] bg-[#13171D] shadow-2xl before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-r before:from-[#FACC15]/5 before:to-transparent">
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-[#FACC15] to-amber-600" />
        <div className="relative flex flex-col items-center justify-between gap-6 p-6 md:flex-row md:p-8">
          <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:w-auto">
            <div className="group relative shrink-0">
              {fotoUrl ? (
                <div className="relative">
                  <Avatar
                    src={fotoUrl}
                    name={nome}
                    shape="square"
                    className="h-24 w-24 rounded-2xl border border-[#2B3545] shadow-xl md:h-28 md:w-28"
                    textSize="text-2xl"
                  />
                  {!isSelfView && (
                    <button
                      type="button"
                      onClick={onPhotoClick}
                      disabled={isUploadingPhoto}
                      className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-2xl bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      ) : (
                        <>
                          <Camera className="mb-1 h-5 w-5 text-white" />
                          <span className="text-[8px] font-bold uppercase tracking-wider text-white">Alterar</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-[#2B3545] bg-gradient-to-tr from-[#1E2530] via-[#12161E] to-[#1E2530] shadow-xl md:h-28 md:w-28">
                  <div className="pointer-events-none absolute inset-1 animate-[spin_12s_linear_infinite] rounded-xl border border-dashed border-[#FACC15]/25" />
                  <div className="pointer-events-none absolute inset-2.5 rounded-lg border border-[#FACC15]/10" />
                  <div className="relative text-center">
                    <span className="mb-1.5 block text-[9px] font-black uppercase leading-none tracking-widest text-[#FACC15]">
                      TERREIRO
                    </span>
                    <span className="block font-display text-2xl font-black tracking-widest text-white">{initials}</span>
                  </div>
                  {!isSelfView && (
                    <button
                      type="button"
                      onClick={onPhotoClick}
                      className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Camera className="h-5 w-5 text-white" />
                    </button>
                  )}
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={onPhotoChange} />
              <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-[#13171D] bg-[#10B981] px-3 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-[#080A0D] shadow-md">
                ● {status.toUpperCase()} NA CORRENTE
              </span>
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{nome}</h2>
                <span className="rounded-md border border-[#FACC15]/30 bg-amber-500/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#FACC15]">
                  {cargo.toUpperCase()}
                </span>
              </div>
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-400 sm:justify-start">
                <span>Consagrado sob a coroa de</span>
                <span className="font-semibold text-[#FACC15]">{orixaFrente || '—'}</span>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-xs text-[#94A3B8] sm:justify-start">
                <span className="rounded-md border border-[#222B36] bg-[#1C232E] px-2.5 py-1 font-mono text-[10.5px] tracking-wider">
                  REGISTRO: <span className="font-extrabold text-white">{registro}</span>
                </span>
                <span className="flex items-center gap-1 font-bold text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Ficha Integral Verificada
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full items-center justify-end gap-3 border-t border-[#222B36]/50 pt-4 sm:w-auto md:border-0 md:pt-0">
            <button
              type="button"
              onClick={onBack}
              className="group cursor-pointer rounded-xl border border-[#2B3645] bg-[#1C222B] p-3 text-gray-400 shadow-md transition-all hover:bg-[#252F3C] hover:text-white"
              title="Voltar"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </button>
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex cursor-pointer items-center rounded-xl border border-[#1E242B] bg-[#12161A] p-3 text-[#10B981] shadow-md transition-all hover:bg-[#1C222B] hover:text-emerald-400"
                title="Enviar WhatsApp"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={onEditOpen}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#FACC15] bg-[#FACC15]/5 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#FACC15] shadow-sm shadow-[#FACC15]/5 transition-all hover:bg-[#FACC15]/10"
            >
              <Pencil className="h-4 w-4" />
              Editar Informações
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#1E242B] bg-[#12161A] p-1.5">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          const locked = tab.id === 'notes' && notesLocked;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold transition-all',
                active ? 'bg-[#FACC15] font-black text-[#080A0D] shadow-md' : 'text-[#94A3B8] hover:bg-white/5 hover:text-white',
                locked && !active && 'opacity-50',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {locked && <Lock className="h-3 w-3 text-[#FACC15]" />}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px] animate-fadeIn">
        {activeTab === 'info' && (
          <>
            <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
              <div className="flex flex-col justify-between space-y-6 rounded-2xl border border-[#1E242B] bg-[#13171D] p-6 md:col-span-2">
                <div>
                  <div className="flex items-center justify-between border-b border-[#222B36] pb-3.5">
                    <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                      <Sparkles className="h-4 w-4 text-[#FACC15]" />
                      Coroa Espiritual e Sacerdócio
                    </h4>
                    <span className="font-mono text-[10px] uppercase text-gray-500">Liturgia nº {registro}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-6 pt-5 sm:grid-cols-2">
                    <div className="group relative overflow-hidden rounded-xl border border-[#2B3545] bg-gradient-to-br from-[#1E2530] to-[#12161E] p-4">
                      <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-500">
                        1º
                      </div>
                      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Orixá de Frente</span>
                      <span className="block font-display text-lg font-black tracking-tight text-[#FACC15]">
                        {orixaFrente || EMPTY}
                      </span>
                      <span className="mt-2 block text-[10px] font-light text-gray-500">Guia e regente primordial nos aspectos mentais e rituais.</span>
                    </div>
                    <div className="group relative overflow-hidden rounded-xl border border-[#2B3545] bg-gradient-to-br from-[#1E2530] to-[#12161E] p-4">
                      <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-xs font-bold text-[#FACC15]">
                        2º
                      </div>
                      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Orixá Adjuntó (Equilibrista)</span>
                      <span
                        className={cn(
                          'block font-display text-lg font-black',
                          adjunto && adjunto !== EMPTY ? 'text-white' : 'font-normal italic text-gray-500',
                        )}
                      >
                        {adjunto || EMPTY}
                      </span>
                      <span className="mt-2 block text-[10px] font-light text-gray-500">Atua em complementação de energia com o orixá de frente.</span>
                    </div>
                    <div className="space-y-1 rounded-xl border border-[#1E242B] bg-[#12161A]/65 p-4">
                      <InfoField label="Data de Entrada Oficial" value={formatDate(child.data_entrada)} icon={Calendar} />
                    </div>
                    <div className="space-y-1 rounded-xl border border-[#1E242B] bg-[#12161A]/65 p-4">
                      <InfoField label="Data de Feitura (Sagração)" value={dataFeitura ? formatDate(dataFeitura) : EMPTY} icon={ShieldCheck} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-[#1E242B]/80 bg-[#12161A] p-4 sm:flex-row">
                  <div className="space-y-1 text-center sm:text-left">
                    <span className="block text-[9px] font-bold uppercase leading-none tracking-widest text-[#94A3B8]">Maturação Litúrgica</span>
                    <span className="block text-xs font-black text-white">Tempo de Ritualística do Filho de Santo</span>
                  </div>
                  <div className="flex w-full items-center gap-3 sm:w-1/2">
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full border border-white/5 bg-[#1A222B]">
                      <div
                        className="absolute bottom-0 left-0 top-0 rounded-full bg-gradient-to-r from-amber-500 to-[#FACC15]"
                        style={{ width: `${maturity}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-black text-[#FACC15]">
                      {maturity}% {anosDeCasa != null ? `(${anosDeCasa} ${anosDeCasa === 1 ? 'Ano' : 'Anos'})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between space-y-6 rounded-2xl border border-[#1E242B] bg-[#13171D] p-6">
                <div className="space-y-5">
                  <h4 className="flex items-center gap-2 border-b border-[#222B36] pb-3.5 text-sm font-black uppercase tracking-wider text-white">
                    <User className="h-4 w-4 text-[#FACC15]" />
                    Cadastro Civil
                  </h4>
                  <div className="space-y-4">
                    <InfoField label="Nascimento" value={formatDate(child.data_nascimento)} />
                    <InfoField label="CPF Registrado" value={cpf || EMPTY} />
                    <InfoField label="Localização / Residência" value={endereco || EMPTY} />
                    <InfoField label="WhatsApp de Contato" value={contato || EMPTY} />
                  </div>
                </div>
                {!isSelfView && userId && (
                  <div className="space-y-1.5 border-t border-[#222B36] pt-4">
                    <span className="block text-[8px] font-bold uppercase tracking-widest text-gray-500">Token de Vínculo de Usuário</span>
                    <span className="block select-all break-all rounded-lg border border-[#1E242B] bg-[#0D0F12] p-2 font-mono text-[9px] font-semibold leading-none text-[#94A3B8]">
                      {userId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4 rounded-2xl border border-[#1E242B] bg-[#13171D] p-6">
              <h4 className="flex items-center gap-2 border-b border-[#222B36] pb-3.5 text-sm font-black uppercase tracking-wider text-white">
                <Flame className="h-4 w-4 text-[#FACC15]" />
                Quizilas, Interdições & Preceitos Litúrgicos de Cabeça
              </h4>
              <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-4">
                <div className="space-y-2 md:col-span-3">
                  <span className="block font-mono text-[9.5px] font-bold uppercase tracking-widest text-amber-500">
                    EW_S & RESTRIÇÕES ESPIRITUAIS
                  </span>
                  <p
                    className={cn(
                      'text-xs leading-relaxed',
                      quizilas ? 'font-medium text-gray-300' : 'italic text-gray-500',
                    )}
                  >
                    {quizilas || 'Nenhuma restrição registrada de preceito para o Filho de Santo.'}
                  </p>
                </div>
                <div className="flex h-full flex-col justify-center space-y-1 rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-center">
                  <span className="block text-xs font-black uppercase tracking-wider text-[#FACC15]">Atenção no Congá</span>
                  <span className="block text-[10px] font-light text-gray-400">Respeitar as restrições alimentares do Orixá nas datas festivas.</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 rounded-2xl border border-[#1E242B] bg-[#13171D] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                  <Flame className="h-4 w-4 text-[#FACC15]" />
                  Evolução & Deveres Litúrgicos
                </h4>
                <p className="mt-1 text-xs font-light text-[#94A3B8]">
                  Controle cronológico sacerdotal de obrigações sacramentais periódicas e confirmações internas.
                </p>
              </div>
              {!isSelfView && (
                <button
                  type="button"
                  onClick={onAddObligation}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#FACC15]/30 bg-[#FACC15]/5 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#FACC15] transition-colors hover:bg-[#FACC15]/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agendar Obrigação
                </button>
              )}
            </div>

            {childObligations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1E242B] bg-[#12161A] p-10 text-center text-xs italic text-gray-500">
                Nenhum registro de obrigação encontrado.
              </div>
            ) : (
              <div className="relative ml-4 space-y-8 border-l-2 border-[#1E242B] py-2 pl-8">
                {childObligations.map((ob, idx) => {
                  const done = ob.status_confirmacao === 'Confirmado' || ob.status_confirmacao === 'Concluído';
                  return (
                    <div key={idx} className="group relative">
                      <div
                        className={cn(
                          'absolute -left-[41px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-[#13171D] transition-colors',
                          done ? 'border-[#FACC15] text-[#FACC15]' : 'border-[#222B36] text-gray-700',
                        )}
                      >
                        {done ? <Check className="h-3 w-3 font-bold" /> : <Clock className="h-3 w-3" />}
                      </div>
                      <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#1E242B] bg-[#12161A] p-4 transition-all hover:border-[#FACC15]/20 hover:bg-[#1A222B]/35 sm:flex-row sm:items-center">
                        <div className="space-y-1">
                          <h5 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white">
                            {ob.titulo || 'Obrigação'}
                          </h5>
                          <p className="text-[11px] font-light text-gray-500">
                            {ob.data
                              ? `Registrada para: ${new Date(ob.data).toLocaleDateString('pt-BR')}`
                              : 'Aguardando data na corrente.'}
                          </p>
                          {ob.descricao ? (
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-400">{ob.descricao}</p>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            'rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wider',
                            done
                              ? 'border-amber-500/30 bg-amber-950/40 text-[#FACC15]'
                              : 'border-[#1E242B] bg-[#181C21] text-gray-600',
                          )}
                        >
                          {done ? 'Concluído' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-6 rounded-2xl border border-[#1E242B] bg-[#13171D] p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1 rounded-xl border border-[#1E242B] bg-[#12161A] p-4.5">
                <span className="block text-[8.5px] font-bold uppercase tracking-widest text-gray-500">MENSALIDADE FIXA</span>
                <span className="block font-display text-xl font-black text-[#FACC15]">
                  R$ {valorMensalidade.toFixed(2).replace('.', ',')}
                </span>
                <span className="block text-[10px] text-emerald-400">Contábil Litúrgico Ativo</span>
              </div>
              <div className="space-y-1 rounded-xl border border-[#1E242B] bg-[#12161A] p-4.5">
                <span className="block text-[8.5px] font-bold uppercase tracking-widest text-gray-500">SITUAÇÃO ATUAL</span>
                <span className={cn('block font-display text-xl font-black', hasDebt ? 'text-red-400' : 'text-emerald-400')}>
                  {hasDebt ? 'Pendente' : 'Em Dia'}
                </span>
                <span className="block text-[10px] text-gray-500">Status de contribuição do filho</span>
              </div>
              <div className="space-y-1 rounded-xl border border-[#1E242B] bg-[#12161A] p-4.5">
                <span className="block text-[8.5px] font-bold uppercase tracking-widest text-gray-500">REGULARIZAÇÃO</span>
                <span className="block font-display text-xl font-black text-white">{hasDebt ? 'Necessária' : 'Não requerida'}</span>
                <span className="block text-[10px] text-gray-400">
                  {hasDebt ? 'Há parcelas em aberto' : 'Contribuição regularizada'}
                </span>
              </div>
            </div>

            {hasDebt && isSelfView && (
              <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-5 text-sm text-gray-300">
                Para manter o equilíbrio e as atividades do terreiro, regularize sua mensalidade com o Zelador ou pelo portal de pagamentos.
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] p-4 text-[11px] leading-relaxed text-gray-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#FACC15]" />
              <span>
                <strong>Aviso Litúrgico de Tesouraria:</strong> O caixa da casa destina-se à aquisição de insumos comunitários de giras (velas, ervas, defumadores, flores e reformas estruturais). Filhos de santo com mensalidades pendentes devem contatar a Zeladoria diretamente.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'notes' && !notesLocked && (
          <div className="space-y-6 rounded-2xl border border-[#1E242B] bg-[#13171D] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                  <FileText className="h-4 w-4 text-[#FACC15]" />
                  Diário de Conduta e Apontamentos do Sacerdote
                </h4>
                <p className="mt-1 text-xs font-light text-[#94A3B8]">
                  Notas confidenciais sobre caridade, toques, comportamentos em gira e desenvolvimento mediúnico — apenas o Zelador acessa.
                </p>
              </div>
              {!isSelfView && (
                <button
                  type="button"
                  onClick={onNewNote}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#FACC15] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#080A0D] shadow-md transition-all hover:bg-[#FDE047]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova nota
                </button>
              )}
            </div>

            {sortedZeladorNotes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1E242B] bg-[#12161A] p-10 text-center text-xs italic text-gray-500">
                {isSelfView
                  ? `Nenhuma consideração pastoral registrada para ${nome}.`
                  : `Nenhuma consideração pastoral registrada. Crie a primeira nota sobre o desenvolvimento espiritual deste filho.`}
              </div>
            ) : (
              <div className="space-y-4">
                {sortedZeladorNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => onOpenNote(note)}
                    className="group relative w-full cursor-pointer space-y-2 overflow-hidden rounded-xl border border-[#1E242B] bg-[#12161A] p-4 text-left transition-all hover:border-[#FACC15]/25"
                  >
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#FACC15]" />
                    <div className="flex items-center justify-between font-mono text-[10px] text-gray-500">
                      <span className="font-extrabold uppercase tracking-wider text-[#FACC15]">{note.title || 'Sem título'}</span>
                      <span>{formatNoteDate(note.updatedAt)}</span>
                    </div>
                    <p className="line-clamp-3 text-xs font-light leading-relaxed text-gray-300">{note.content}</p>
                    {!isSelfView && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600 opacity-0 transition-opacity group-hover:opacity-100">
                        Clique para editar
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 rounded-xl border border-[#FACC15]/20 bg-[#FACC15]/5 p-4">
              <ShieldCheck className="h-5 w-5 text-[#FACC15]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-[#FACC15]">Espaço privado · acessível apenas pelo Zelador</p>
            </div>
          </div>
        )}

        {activeTab === 'notes' && notesLocked && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[#1E242B] bg-[#13171D] p-16 text-center">
            <Lock className="h-10 w-10 text-[#FACC15]" />
            <p className="text-sm font-bold text-white">Notas do Zelador disponíveis no plano Pro</p>
            <p className="max-w-md text-xs text-gray-500">Faça upgrade para registrar apontamentos confidenciais sobre o desenvolvimento espiritual dos filhos de santo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
