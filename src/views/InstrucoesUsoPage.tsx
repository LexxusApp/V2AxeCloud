import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  ExternalLink,
  Flame,
  KeyRound,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { MarketingMockupFooter } from '../components/marketing/MarketingMockupFooter';
import { MatrizTopNav } from '../components/marketing/MatrizTopNav';
import { ROUTES } from '../lib/routes';
import { cn } from '../lib/utils';

type Audience = 'zelador' | 'membro';

interface StepCard {
  number: string;
  title: string;
  desc: string;
  badge?: string;
  highlight?: string;
  icon: React.ElementType;
}

const MEMBRO_STEPS: StepCard[] = [
  {
    number: '01',
    title: 'Acesse a tela de entrada',
    desc: 'Entre em axecloud.com.br/entrar no celular ou computador e selecione a aba Sou Membro(a).',
    badge: 'Acesso sem e-mail',
    highlight: 'axecloud.com.br/entrar',
    icon: Smartphone,
  },
  {
    number: '02',
    title: 'Informe sua Matrícula',
    desc: 'Digite o código de registro enviado pelo WhatsApp do AxéCloud (ex: AXC-2026-CFDB). Você pode digitar com ou sem hífens.',
    badge: 'Identificador do Terreiro',
    highlight: 'Ex: AXC-2026-CFDB',
    icon: KeyRound,
  },
  {
    number: '03',
    title: 'Senha = 6 primeiros dígitos do CPF',
    desc: 'Sua senha inicial de acesso são exclusivamente os 6 primeiros números do seu CPF, sem pontos nem traço.',
    badge: 'Exemplo: 123.456.789-00 → Senha: 123456',
    highlight: '6 primeiros dígitos',
    icon: ShieldCheck,
  },
];

const ZELADOR_STEPS: StepCard[] = [
  {
    number: '01',
    title: 'Cadastre seus Filhos de Santo',
    desc: 'Na aba Corrente, cadastre o Nome, WhatsApp e CPF de cada médium. O sistema gera automaticamente a matrícula AXC e as credenciais.',
    badge: 'Cadastro Rápido',
    highlight: 'Nome + WhatsApp + CPF',
    icon: Users,
  },
  {
    number: '02',
    title: 'Disparo Oficial pelo WhatsApp',
    desc: 'As credenciais saem pelo WhatsApp Business oficial da plataforma com link direto. Você não precisa parear o celular nem escanear QR Code.',
    badge: 'Meta Cloud API 100% Oficial',
    highlight: 'Sem QR Code no celular',
    icon: MessageCircle,
  },
  {
    number: '03',
    title: 'Controle de Giras e Mensalidades Pix',
    desc: 'Cadastre sua chave Pix para os membros pagarem com baixa automática e acompanhe presenças em giras e obrigações da casa em tempo real.',
    badge: 'Gestão Completa',
    highlight: 'Pix Automático + Giras',
    icon: Wallet,
  },
];

const MEMBRO_FEATURES = [
  {
    icon: CalendarDays,
    title: 'Giras & Calendário',
    desc: 'Confira datas, horários de toques e confirme sua presença antecipada na corrente.',
    tag: 'Presença',
  },
  {
    icon: Wallet,
    title: 'Mensalidades com Pix',
    desc: 'Acesse o QR Code Pix da casa, veja seus recibos e envie comprovantes num toque.',
    tag: 'Financeiro',
  },
  {
    icon: Flame,
    title: 'Obrigações Espirituais',
    desc: 'Orientações, preceitos e datas de confirmação alinhadas com a sua zeladoria.',
    tag: 'Preceito',
  },
  {
    icon: Megaphone,
    title: 'Mural de Avisos',
    desc: 'Fique por dentro das notícias, eventos, escalas e recados oficiais do terreiro.',
    tag: 'Comunicação',
  },
  {
    icon: MessageCircle,
    title: 'Canal Direto com a Casa',
    desc: 'Comunicação direta e segura com a administração e os dirigentes do terreiro.',
    tag: 'Privacidade',
  },
  {
    icon: BookOpen,
    title: 'Acervo & Biblioteca',
    desc: 'Pontos cantados, apostilas e materiais de estudo disponibilizados pela sua casa.',
    tag: 'Doutrina',
  },
];

const ZELADOR_FEATURES = [
  {
    icon: Users,
    title: 'Gestão da Corrente',
    desc: 'Fichas completas, padrinhos, cargos, mediunidade, aniversários e histórico dos médiuns.',
    tag: 'Corrente',
  },
  {
    icon: Wallet,
    title: 'Controle de Caixa & Pix',
    desc: 'Mensalidades dos membros, entradas, saídas, relatórios em PDF e conferência automática.',
    tag: 'Tesouraria',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Oficial sem Aparelho',
    desc: 'Avisos de gira, cobranças gentis e boas-vindas disparadas pelo canal verificado do AxéCloud.',
    tag: 'Automação',
  },
  {
    icon: CalendarDays,
    title: 'Calendário de Giras',
    desc: 'Chamadas de presença, controle de médiuns e consulentes com lista de espera.',
    tag: 'Giras',
  },
  {
    icon: ShieldCheck,
    title: 'Ambiente Seguro & Auditado',
    desc: 'LGPD rigorosa, dados isolados por casa e permissões bem definidas para cada dirigente.',
    tag: 'Segurança',
  },
  {
    icon: Sparkles,
    title: 'Site Público do Terreiro',
    desc: 'Página exclusiva para divulgação no Google com fotos, mapa, horários e chave Pix oficial.',
    tag: 'Visibilidade',
  },
];

export default function InstrucoesUsoPage({ audience: initialAudience = 'zelador' }: { audience?: Audience }) {
  const [activeAudience, setActiveAudience] = useState<Audience>(initialAudience);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    setActiveAudience(initialAudience);
  }, [initialAudience]);

  const isMembro = activeAudience === 'membro';
  const loginHref = isMembro ? `${ROUTES.login}?modo=filho` : `${ROUTES.login}?modo=zelador`;

  const handleTabChange = (target: Audience) => {
    setActiveAudience(target);
    const newPath = target === 'membro' ? ROUTES.instrucoesMembro : ROUTES.instrucoes;
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', newPath);
    }
  };

  const copyExample = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#faf8f4] text-[#1b1813] font-sans antialiased selection:bg-[#e5ae12]/30 selection:text-[#1b1813]">
      <MatrizTopNav />

      {/* HEADER HERO SECTION */}
      <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#1b1813]/8 bg-gradient-to-b from-[#f5f0e4]/80 via-[#faf8f4] to-[#faf8f4]">
        {/* Subtle Ambient Decorative Circles */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#c48a00]/8 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Breadcrumb / Back Link */}
          <div className="inline-flex items-center gap-2 mb-6">
            <a
              href={ROUTES.login}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#1b1813]/10 text-xs font-semibold text-[#1b1813]/70 hover:text-[#1b1813] hover:border-[#c48a00]/40 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Login</span>
            </a>
            <span className="text-xs font-bold uppercase tracking-wider text-[#c48a00] bg-[#c48a00]/10 px-2.5 py-1 rounded-full border border-[#c48a00]/20">
              Guia Oficial de Uso
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#1b1813] leading-[1.08] max-w-3xl mx-auto">
            {isMembro ? (
              <>
                Como acessar o portal do <span className="text-[#c48a00]">Filho de Santo</span>.
              </>
            ) : (
              <>
                Como gerenciar seu <span className="text-[#166534]">Terreiro</span> no AxéCloud.
              </>
            )}
          </h1>

          <p className="mt-4 md:mt-5 text-base sm:text-lg md:text-xl text-[#1b1813]/70 max-w-2xl mx-auto leading-relaxed font-medium">
            {isMembro
              ? 'Três passos simples. Sem precisar de e-mail e sem complicação de senhas difíceis.'
              : 'O guia essencial para dirigentes cadastrarem a corrente, gerenciarem finanças e avisarem a casa pelo WhatsApp oficial.'}
          </p>

          {/* INTERACTIVE SEGMENTED AUDIENCE SWITCHER */}
          <div className="mt-8 md:mt-10 inline-flex p-1.5 rounded-2xl bg-[#ebe4d4] border border-[#1b1813]/10 shadow-inner max-w-md w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleTabChange('zelador')}
              className={cn(
                'flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer',
                !isMembro
                  ? 'bg-white text-[#166534] shadow-md shadow-black/5 scale-[1.02]'
                  : 'text-[#1b1813]/60 hover:text-[#1b1813] hover:bg-white/40'
              )}
            >
              <Users className="w-4 h-4 text-[#166534]" />
              <span>Sou Zelador(a) / Gestão</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('membro')}
              className={cn(
                'flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer',
                isMembro
                  ? 'bg-white text-[#c48a00] shadow-md shadow-black/5 scale-[1.02]'
                  : 'text-[#1b1813]/60 hover:text-[#1b1813] hover:bg-white/40'
              )}
            >
              <Flame className="w-4 h-4 text-[#c48a00]" />
              <span>Sou Membro / Corrente</span>
            </button>
          </div>

          {/* Quick CTA to Login */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href={loginHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1b1813] text-[#faf8f4] text-sm font-bold shadow-lg shadow-black/10 hover:bg-[#2e2920] transition-all transform hover:-translate-y-0.5"
            >
              <span>Ir para a tela de login</span>
              <ArrowRight className="w-4 h-4 text-[#e5ae12]" />
            </a>
            <button
              type="button"
              onClick={() => handleTabChange(isMembro ? 'zelador' : 'membro')}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold text-[#1b1813]/70 hover:text-[#1b1813] hover:bg-white/60 transition-colors"
            >
              <span>{isMembro ? 'Ver instruções do Zelador' : 'Ver instruções do Membro'}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>

        </div>
      </section>

      {/* STEP BY STEP CARDS SECTION */}
      <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#c48a00]">Passo a Passo</span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1b1813] tracking-tight mt-1">
            {isMembro ? '3 Passos para Acessar' : 'Como Iniciar a Casa'}
          </h2>
          <p className="text-sm text-[#1b1813]/65 mt-2">
            {isMembro
              ? 'Tudo o que você precisa já foi gerado na confirmação do seu cadastro pelo terreiro.'
              : 'Configure os pontos principais em menos de 5 minutos sem complicações técnicas.'}
          </p>
        </div>

        {/* The 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(isMembro ? MEMBRO_STEPS : ZELADOR_STEPS).map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.article
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.1 }}
                className="relative flex flex-col bg-white rounded-2xl border border-[#1b1813]/10 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Step Pill & Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className="w-9 h-9 rounded-xl bg-[#1b1813] text-[#faf8f4] flex items-center justify-center font-black text-sm shadow-xs">
                    {step.number}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-[#c48a00]/10 text-[#c48a00] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-[#1b1813] mb-2 leading-snug">
                  {step.title}
                </h3>

                <p className="text-sm text-[#1b1813]/70 leading-relaxed flex-1">
                  {step.desc}
                </p>

                {step.badge && (
                  <div className="mt-5 pt-4 border-t border-[#1b1813]/6">
                    <span className="inline-block px-3 py-1.5 rounded-lg bg-[#f5f0e4] text-[#1b1813] font-mono text-xs font-semibold">
                      {step.badge}
                    </span>
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>

        {/* Interactive Example for Membro Password */}
        {isMembro && (
          <div className="mt-8 rounded-2xl bg-gradient-to-r from-[#164e3b] to-[#0f3427] text-white p-6 sm:p-8 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#fbbf24]">
                  Exemplo Prático de Senha
                </span>
                <h4 className="text-xl font-black">
                  Se o seu CPF for <span className="font-mono text-[#fbbf24]">123.456.789-00</span>
                </h4>
                <p className="text-sm text-emerald-100/80">
                  Sua senha inicial de acesso será simplesmente os 6 primeiros dígitos:
                </p>
              </div>

              <div className="flex items-center gap-3 bg-black/30 p-3.5 rounded-xl border border-white/10 self-start md:self-auto">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">
                    Sua Senha
                  </span>
                  <p className="text-2xl font-black font-mono tracking-widest text-[#fbbf24]">
                    123456
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyExample('123456')}
                  className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Copiar exemplo"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* UNLOCKED FEATURES GRID */}
      <section className="py-16 bg-[#f3ede1]/60 border-y border-[#1b1813]/8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#166534]">
              {isMembro ? 'No Portal do Membro' : 'Recursos da Plataforma'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1b1813] tracking-tight mt-1">
              {isMembro ? 'O que você encontra após entrar' : 'Tudo para o dia a dia do Terreiro'}
            </h2>
            <p className="text-sm text-[#1b1813]/65 mt-2">
              {isMembro
                ? 'Informações organizadas, seguras e com respeito às regras e hierarquia da sua casa.'
                : 'Módulos integrados projetados sob medida para a tradição e rotina das casas de axé.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(isMembro ? MEMBRO_FEATURES : ZELADOR_FEATURES).map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-white rounded-xl p-5 border border-[#1b1813]/8 shadow-2xs hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2.5 rounded-lg bg-[#c48a00]/10 text-[#c48a00]">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1b1813]/5 text-[#1b1813]/70 font-mono">
                      {feat.tag}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-[#1b1813] mb-1.5">{feat.title}</h4>
                  <p className="text-xs text-[#1b1813]/65 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ & HELP CENTER SECTION */}
      <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto">
        <div className="rounded-3xl bg-white border border-[#1b1813]/10 p-8 sm:p-10 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <span className="p-3 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
              <CircleHelp className="w-6 h-6" />
            </span>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-[#1b1813]">
                {isMembro ? 'Não consegue entrar no seu acesso?' : 'Dúvidas frequentes da Zeladoria'}
              </h3>
              <p className="text-sm text-[#1b1813]/65 mt-1">
                {isMembro
                  ? 'Veja os 3 motivos mais comuns que podem impedir o login do filho de santo:'
                  : 'Dicas importantes para garantir que a sua casa rode sem travamentos:'}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-[#1b1813]/80">
            {isMembro ? (
              <>
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#faf8f4] border border-[#1b1813]/6">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#1b1813] font-bold">1. Você selecionou a opção "Sou Membro(a)"?</strong>
                    <span>A tela padrão costuma abrir no login de Zelador. Certifique-se de clicar na aba <strong>Sou Membro(a)</strong> antes de digitar sua matrícula.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#faf8f4] border border-[#1b1813]/6">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#1b1813] font-bold">2. A matrícula está igual à recebida no WhatsApp?</strong>
                    <span>O código segue o padrão <code>AXC-2026-XXXX</code>. Caso tenha perdido o WhatsApp de boas-vindas, solicite ao seu dirigente para reenviar na lista da Corrente.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#faf8f4] border border-[#1b1813]/6">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#1b1813] font-bold">3. Você digitou os 6 primeiros números do CPF?</strong>
                    <span>A senha inicial não é a senha do seu e-mail nem do WhatsApp. São apenas os 6 primeiros dígitos do seu CPF cadastrado pelo terreiro.</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#faf8f4] border border-[#1b1813]/6">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#1b1813] font-bold">O membro disse que não recebeu o WhatsApp de boas-vindas?</strong>
                    <span>No painel da casa, vá em <strong>Médiuns</strong>, localize o filho e clique no botão de <strong>Reenviar Acesso</strong>. O envio é imediato via WhatsApp oficial.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#faf8f4] border border-[#1b1813]/6">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#1b1813] font-bold">Como funciona a confirmação de pagamentos Pix?</strong>
                    <span>Quando você cadastra a chave Pix em Configurações, o comprovante enviado pelo membro é conciliado automaticamente pelo CPF registrado.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#faf8f4] border border-[#1b1813]/6">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#1b1813] font-bold">Preciso de um chip exclusivo para o terreiro?</strong>
                    <span>Não. As mensagens da casa saem pelo canal verificado oficial do AxéCloud. Seu celular pessoal fica livre de conexões ou quedas de QR Code.</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Call to Action */}
          <div className="mt-8 pt-6 border-t border-[#1b1813]/8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold text-[#1b1813]">Ainda precisa de auxílio?</p>
              <p className="text-xs text-[#1b1813]/60">Nossa equipe de suporte responde diretamente pelo WhatsApp.</p>
            </div>
            <a
              href="https://wa.me/5515996959720?text=Ol%C3%A1!%20Estou%20com%20d%C3%BAvidas%20sobre%20o%20acesso%20ao%20Ax%C3%A9Cloud."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#166534] text-white text-xs font-bold hover:bg-[#14532d] transition-colors shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Falar com o Suporte</span>
            </a>
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION BANNER */}
      <section className="py-12 bg-[#1b1813] text-[#faf8f4] text-center px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
            Tudo pronto para entrar?
          </h3>
          <p className="text-sm text-[#faf8f4]/70">
            Acesse agora com suas credenciais e continue a caminhada na sua casa.
          </p>
          <div className="pt-2">
            <a
              href={loginHref}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#c48a00] text-white text-sm font-bold shadow-lg shadow-[#c48a00]/30 hover:bg-[#d99b00] transition-all transform hover:-translate-y-0.5"
            >
              <span>Acessar o AxéCloud</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* OFFICIAL FOOTER */}
      <MarketingMockupFooter />
    </div>
  );
}
