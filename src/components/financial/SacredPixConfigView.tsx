import { PixQrCode } from '../PixQrCode';
import React, { useState } from 'react';
import {
  Smartphone,
  Save,
  Loader2,
  Copy,
  ShieldCheck,
  DollarSign,
  QrCode,
  CheckCircle2,
  Sparkles,
  Printer,
  Share2,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  Building,
  Key,
  Calendar,
  CreditCard
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { showHouseToast } from '../../lib/houseToast';

interface SacredPixConfigViewProps {
  pixConfig: {
    valor_mensalidade: string;
    chave_pix: string;
    tipo_chave: string;
    nome_beneficiario: string;
    dia_vencimento: string;
  };
  setPixConfig: React.Dispatch<React.SetStateAction<{
    valor_mensalidade: string;
    chave_pix: string;
    tipo_chave: string;
    nome_beneficiario: string;
    dia_vencimento: string;
  }>>;
  handleSavePixConfig: (e: React.FormEvent) => void;
  isSavingPix: boolean;
  formatBRL: (v: number) => string;
  terreiroNome?: string;
}

export const SacredPixConfigView: React.FC<SacredPixConfigViewProps> = ({
  pixConfig,
  setPixConfig,
  handleSavePixConfig,
  isSavingPix,
  formatBRL,
  terreiroNome = 'Terreiro Sagrado',
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'impressao' | 'whatsapp'>('terminal');

  const handleCopyKey = () => {
    if (!pixConfig.chave_pix) return;
    navigator.clipboard?.writeText(pixConfig.chave_pix);
    setCopiedKey(true);
    showHouseToast('Chave Pix copiada para a área de transferência!', 'success');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const keyTypeLabels: Record<string, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    email: 'E-mail',
    celular: 'Celular / WhatsApp',
    aleatoria: 'Chave Aleatória (EVP)',
  };

  const isConfigured = Boolean(pixConfig.chave_pix && pixConfig.nome_beneficiario && Number(pixConfig.valor_mensalidade) > 0);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Status */}
      <div className="relative overflow-hidden rounded-lg border border-[#D4AF37]/30 bg-gradient-to-r from-[#0C1A14] via-[#142A20] to-[#0D1D16] p-6 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#D4AF37]/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/20 text-amber-300">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  Terminal Financeiro Digital
                </span>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase border",
                  isConfigured 
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                )}>
                  {isConfigured ? 'Pronto para Receber' : 'Configuração Pendente'}
                </span>
              </div>
              <h2 className="mt-1 text-xl font-black text-white">
                Configuração & Recepção Pix
              </h2>
              <p className="mt-1 text-xs text-white/75 max-w-xl leading-relaxed">
                Configure os dados bancários do terreiro para geração de cobranças automáticas no WhatsApp e cartazes impressos de balcão.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('terminal')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === 'terminal' 
                  ? "bg-amber-400 text-[#09140E] shadow-md font-black" 
                  : "bg-white/10 text-white/80 hover:bg-white/15"
              )}
            >
              Terminal & Dados
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === 'whatsapp' 
                  ? "bg-emerald-500 text-white shadow-md font-black" 
                  : "bg-white/10 text-white/80 hover:bg-white/15"
              )}
            >
              Prévia WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Grid: Form + Live Terminal Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulário Elegante de Configuração (7 colunas) */}
        <div className="lg:col-span-7 rounded-lg border border-[#E5DECF] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between border-b border-[#F0EAE0] pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-800">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#171A16]">Dados da Conta Litúrgica</h3>
                <p className="text-xs text-[#7A7265]">Defina os valores e chave para onde irão os dízimos e mensalidades.</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
              Instantâneo
            </span>
          </div>

          <form onSubmit={handleSavePixConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#4A4235]">
                  Mensalidade Padrão do Médium
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-amber-700">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={pixConfig.valor_mensalidade}
                    onChange={(e) => setPixConfig({ ...pixConfig, valor_mensalidade: e.target.value })}
                    className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] pl-10 pr-4 py-3 text-sm font-bold text-[#171A16] placeholder:text-[#9B9184] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-all"
                    placeholder="70,00"
                  />
                </div>
                <p className="mt-1 text-[10px] text-[#7A7265]">Valor sugerido para cobranças mensais da corrente.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#4A4235]">
                  Tipo de Chave Pix
                </label>
                <select
                  value={pixConfig.tipo_chave}
                  onChange={(e) => setPixConfig({ ...pixConfig, tipo_chave: e.target.value })}
                  className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3.5 py-3 text-sm font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-all"
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="celular">Celular / WhatsApp</option>
                  <option value="aleatoria">Chave Aleatória (EVP)</option>
                </select>
                <p className="mt-1 text-[10px] text-[#7A7265]">Identificação bancária da sua chave.</p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#4A4235]">
                Chave Pix Cadastrada
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A7265]" />
                <input
                  type="text"
                  value={pixConfig.chave_pix}
                  onChange={(e) => setPixConfig({ ...pixConfig, chave_pix: e.target.value })}
                  className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] pl-10 pr-4 py-3 text-sm font-bold text-[#171A16] placeholder:text-[#9B9184] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-all font-mono"
                  placeholder="Ex: financeiro@axecloud.com.br ou 00.000.000/0001-00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#4A4235]">
                  Nome do Titular / Terreiro
                </label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A7265]" />
                  <input
                    type="text"
                    value={pixConfig.nome_beneficiario}
                    onChange={(e) => setPixConfig({ ...pixConfig, nome_beneficiario: e.target.value })}
                    className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] pl-10 pr-4 py-3 text-sm font-bold text-[#171A16] placeholder:text-[#9B9184] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-all"
                    placeholder="Nome completo ou Razão Social"
                  />
                </div>
                <p className="mt-1 text-[10px] text-[#7A7265]">Aparecerá para o filho confirmar o destinatário.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#4A4235]">
                  Dia de Vencimento Padrão
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A7265]" />
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={pixConfig.dia_vencimento}
                    onChange={(e) => setPixConfig({ ...pixConfig, dia_vencimento: e.target.value })}
                    className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] pl-10 pr-12 py-3 text-sm font-bold text-[#171A16] placeholder:text-[#9B9184] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-all"
                    placeholder="10"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A7265]">/ mês</span>
                </div>
                <p className="mt-1 text-[10px] text-[#7A7265]">Data limite sugerida para a cobrança mensal.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0EAE0] flex items-center justify-between">
              <span className="text-xs text-[#7A7265] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Dados criptografados e salvos com segurança.
              </span>
              <button
                type="submit"
                disabled={isSavingPix}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] px-6 py-3 text-xs font-black text-[#0A160F] shadow-md transition-all hover:brightness-105 active:scale-95 disabled:opacity-50"
              >
                {isSavingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingPix ? 'Salvando Alterações…' : 'Salvar Dados Pix'}
              </button>
            </div>
          </form>
        </div>

        {/* Live Terminal Virtual / QR Code Showcase (5 colunas) */}
        <div className="lg:col-span-5 space-y-4">
          {activeTab === 'terminal' ? (
            <div className="rounded-lg border border-[#D4AF37]/40 bg-gradient-to-br from-[#0F2218] via-[#142A20] to-[#0A1710] p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#D4AF37]/15 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    Terminal Virtual de Pagamento
                  </span>
                </div>
                <span className="text-[10px] font-bold text-white/60">
                  {keyTypeLabels[pixConfig.tipo_chave] || 'Pix'}
                </span>
              </div>

              {/* Dynamic QR Code Box */}
              <div className="my-5 flex flex-col items-center justify-center p-5 rounded-lg bg-white text-slate-900 shadow-inner">
                <PixQrCode config={{ ...pixConfig, cidade: 'BRASIL' }} value={Number(pixConfig.valor_mensalidade)} description="Contribuicao da casa" />
                <p className="mt-2 text-xs font-black text-slate-800">
                  {formatBRL(Number(pixConfig.valor_mensalidade) || 0)}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold truncate max-w-[200px]">
                  {pixConfig.nome_beneficiario || terreiroNome}
                </p>
              </div>

              {/* Chave Copia e Cola */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-white/70">Chave Registrada:</span>
                <div className="flex items-center gap-2 rounded-xl bg-white/10 p-2.5 border border-white/10">
                  <span className="flex-1 truncate font-mono text-xs font-bold text-amber-300">
                    {pixConfig.chave_pix || 'Chave ainda não informada'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    disabled={!pixConfig.chave_pix}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400 text-[#09140E] hover:bg-amber-300 transition-all disabled:opacity-40"
                    title="Copiar Chave"
                  >
                    {copiedKey ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/80">
                <span>Vencimento Mensal:</span>
                <span className="font-bold text-amber-300">Todo dia {pixConfig.dia_vencimento || 10}</span>
              </div>
            </div>
          ) : (
            /* WhatsApp Message Simulator */
            <div className="rounded-lg border border-emerald-600/30 bg-[#0B1E14] p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-500/20 text-emerald-400">
                <MessageCircle className="h-5 w-5" />
                <h4 className="text-xs font-black uppercase tracking-wider">Como o Médium Recebe no WhatsApp</h4>
              </div>
              <div className="rounded-lg bg-[#122B1E] p-4 border border-emerald-500/30 text-white font-sans text-xs space-y-2">
                <p className="font-bold text-amber-300">Olá, Irmão(ã)! Motumbá! 🙏</p>
                <p className="text-white/90 leading-relaxed">
                  Lembramos da sua mensalidade de manutenção do <strong className="text-white">{terreiroNome}</strong> deste mês.
                </p>
                <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1 font-mono text-[11px]">
                  <p><span className="text-white/60">Valor:</span> <strong className="text-emerald-400">{formatBRL(Number(pixConfig.valor_mensalidade) || 0)}</strong></p>
                  <p><span className="text-white/60">Vencimento:</span> Dia {pixConfig.dia_vencimento || '10'}</p>
                  <p><span className="text-white/60">Beneficiário:</span> {pixConfig.nome_beneficiario || 'Terreiro'}</p>
                  <p className="pt-1 text-amber-300 break-all"><span className="text-white/60 font-sans">Chave Pix:</span> {pixConfig.chave_pix || '—'}</p>
                </div>
                <p className="text-[11px] text-white/80 italic">
                  Obrigado por fortalecer nossa corrente e manter o sagrado vivo! Axé! ✨
                </p>
              </div>
            </div>
          )}

          {/* Quick Guidance Box */}
          <div className="rounded-lg border border-[#E5DECF] bg-[#FAF8F5] p-4 text-[#4A4235] text-xs space-y-2">
            <h5 className="font-black text-[#171A16] flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Dica da Zeladoria Financeira
            </h5>
            <p className="leading-relaxed text-[#6B6355]">
              Ao cadastrar uma chave CNPJ ou conta jurídica específica da associação do terreiro, você garante transparência total e separa as finanças pessoais da casa sagrada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
