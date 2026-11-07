import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Headphones,
  Loader2,
  MessageSquareText,
  Phone,
  Send,
  UserRound,
  Building2,
  Sparkles,
  HelpCircle,
  Clock3,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AxePageHeader,
  AxeMetricRail,
  AxeMetricCard,
  AxeCard,
  AxeButton,
} from '../components/shared/AxePageScaffold';
import { appInputClass, appLabelClass } from '../components/ui/appDemoUi';
import { cn } from '../lib/utils';

type SupportProps = {
  user: { id: string; email?: string | null };
  tenantData?: {
    nome?: string;
    tenant_id?: string;
    cargo?: string | null;
  } | null;
  setActiveTab: (tab: string) => void;
};

export default function Support({ user, tenantData }: SupportProps) {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [nomeZelador, setNomeZelador] = useState('');
  const [nomeTerreiro, setNomeTerreiro] = useState(tenantData?.nome || '');
  const [whatsapp, setWhatsapp] = useState('');
  const [assunto, setAssunto] = useState('duvida');
  const [mensagem, setMensagem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoadingProfile(true);
      try {
        const { data } = await supabase
          .from('perfil_lider')
          .select('zelador, nome_terreiro, whatsapp_publico, cargo')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        setNomeZelador(String(data?.zelador || data?.cargo || '').trim());
        setNomeTerreiro(String(data?.nome_terreiro || tenantData?.nome || '').trim());
        setWhatsapp(String(data?.whatsapp_publico || '').replace(/\D/g, ''));
      } catch {
        if (!cancelled) {
          setNomeTerreiro(tenantData?.nome || '');
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user.id, tenantData?.nome]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);

    const zelador = nomeZelador.trim();
    const terreiro = nomeTerreiro.trim();
    const phone = whatsapp.replace(/\D/g, '');
    const body = `[${assunto.toUpperCase()}] ${mensagem.trim()}`;

    if (!zelador) {
      setError('Informe o nome do zelador(a).');
      return;
    }
    if (!terreiro) {
      setError('Informe o nome do terreiro.');
      return;
    }
    if (phone.length < 10) {
      setError('WhatsApp obrigatório. Digite DDD + número.');
      return;
    }
    if (body.length < 10) {
      setError('Descreva o que precisa com pelo menos 10 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/v1/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeZelador: zelador,
          nomeTerreiro: terreiro,
          whatsapp: phone,
          mensagem: body,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Não foi possível enviar o pedido.');
      }
      setSent(true);
      setMensagem('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar pedido de suporte.');
    } finally {
      setSubmitting(false);
    }
  }

  const faqs = [
    {
      q: 'Como cadastrar novos médiuns na corrente?',
      a: 'Vá na aba Filhos de Santo e clique em "Novo Filho". Você pode preencher os dados ou enviar um link de convite direto pelo WhatsApp para que o médium complete o cadastro.',
    },
    {
      q: 'Os médiuns conseguem ver o saldo geral do caixa?',
      a: 'Não. O portal do filho é restrito: cada médium só visualiza as próprias mensalidades, comunicados do terreiro, biblioteca de estudos e escala de giras.',
    },
    {
      q: 'Como configurar o Pix da casa para receber mensalidades?',
      a: 'Acesse Financeiro > Configurações Pix. Informe sua chave Pix e o valor padrão. O sistema gera automaticamente o QR Code e o código copia-e-cola para cada cobrança.',
    },
    {
      q: 'O que fazer se o sistema estiver lento no dia da gira?',
      a: 'O AxéCloud conta com funcionamento resiliente para conferência de presença e leitura de caderneta. Se houver qualquer instabilidade de conexão, use nosso suporte emergencial.',
    },
  ];

  if (loadingProfile) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <div className="support-v6-page space-y-6">
        <AxePageHeader
          theme="liturgical"
          kicker="CENTRAL DE ATENDIMENTO & AJUDA FRATERNA"
          title="Suporte & Assistência do Terreiro"
          description="Canais prioritários para tirar dúvidas sobre a plataforma, solicitar configurações litúrgicas ou receber apoio técnico rápido."
          actions={
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20no%20Ax%C3%A9Cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-950/60 px-4 py-2.5 text-xs font-black text-emerald-200 shadow-md backdrop-blur-md transition hover:bg-emerald-900/80 hover:text-white hover:border-emerald-300"
            >
              <Phone className="h-4 w-4 text-[#25D366]" />
              WhatsApp Direto
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          }
        />

        <AxeMetricRail>
          <AxeMetricCard
            label="Atendimento Humano"
            value="Segunda a Sábado"
            icon={Headphones}
            tone="emerald"
            subtext="Das 8h às 20h pelo suporte"
          />
          <AxeMetricCard
            label="Plantão de Giras"
            value="Atendimento Prioritário"
            icon={Sparkles}
            tone="amber"
            subtext="Suporte dedicado nos dias de toque"
          />
          <AxeMetricCard
            label="Tempo de Resposta"
            value="~ 15 minutos"
            icon={Clock3}
            tone="blue"
            subtext="Média em horário comercial"
          />
          <AxeMetricCard
            label="Proteção Sagrada"
            value="Dados Seguros"
            icon={ShieldCheck}
            tone="purple"
            subtext="Privacidade total da sua casa"
          />
        </AxeMetricRail>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-5">
          {/* Coluna 1: Formulário de Ticket */}
          <div className="xl:col-span-3">
            <AxeCard className="p-6 sm:p-7">
              <div className="mb-6 flex items-start gap-3.5 border-b border-[#E6DFD3] pb-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37]/40 bg-[#17251D] text-[#F6C94C] shadow-sm">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-black text-[#17130D]">
                    Abrir Chamado de Atendimento
                  </h3>
                  <p className="mt-0.5 text-xs font-medium text-[#686054]">
                    Preencha os detalhes e entraremos em contato diretamente no seu WhatsApp.
                  </p>
                </div>
              </div>

              {sent ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="font-display text-xl font-black text-[#17130D]">
                    Chamado Enviado com Sucesso!
                  </h4>
                  <p className="max-w-md text-sm font-semibold text-[#665F55]">
                    Recebemos seu pedido. Nossa equipe técnica entrará em contato em breve no WhatsApp informado.
                  </p>
                  <AxeButton
                    variant="secondary"
                    onClick={() => setSent(false)}
                    className="mt-4"
                  >
                    Enviar Outro Chamado
                  </AxeButton>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs font-bold text-rose-700">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={appLabelClass} htmlFor="support-zelador">
                        <span className="inline-flex items-center gap-1.5 font-bold text-[#3E382E]">
                          <UserRound className="h-3.5 w-3.5 text-[#1F5942]" /> Nome do Zelador(a)
                        </span>
                      </label>
                      <input
                        id="support-zelador"
                        required
                        className={appInputClass}
                        value={nomeZelador}
                        onChange={(e) => setNomeZelador(e.target.value)}
                        placeholder="Ex: Pai João de Oxóssi"
                      />
                    </div>

                    <div>
                      <label className={appLabelClass} htmlFor="support-terreiro">
                        <span className="inline-flex items-center gap-1.5 font-bold text-[#3E382E]">
                          <Building2 className="h-3.5 w-3.5 text-[#1F5942]" /> Nome do Terreiro
                        </span>
                      </label>
                      <input
                        id="support-terreiro"
                        required
                        className={appInputClass}
                        value={nomeTerreiro}
                        onChange={(e) => setNomeTerreiro(e.target.value)}
                        placeholder="Ex: T.U. Caboclo das Sete Encruzilhadas"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={appLabelClass} htmlFor="support-whatsapp">
                        <span className="inline-flex items-center gap-1.5 font-bold text-[#3E382E]">
                          <Phone className="h-3.5 w-3.5 text-[#1F5942]" /> WhatsApp para Retorno <span className="text-rose-500">*</span>
                        </span>
                      </label>
                      <input
                        id="support-whatsapp"
                        required
                        inputMode="tel"
                        className={appInputClass}
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 13))}
                        placeholder="11999999999"
                      />
                    </div>

                    <div>
                      <label className={appLabelClass} htmlFor="support-assunto">
                        <span className="inline-flex items-center gap-1.5 font-bold text-[#3E382E]">
                          <HelpCircle className="h-3.5 w-3.5 text-[#1F5942]" /> Tipo de Solicitação
                        </span>
                      </label>
                      <select
                        id="support-assunto"
                        value={assunto}
                        onChange={(e) => setAssunto(e.target.value)}
                        className={appInputClass}
                      >
                        <option value="duvida">Dúvida sobre o uso</option>
                        <option value="financeiro">Financeiro / Chave Pix</option>
                        <option value="filhos">Cadastro de Filhos</option>
                        <option value="emergencia">Emergência no Dia da Gira</option>
                        <option value="sugestao">Sugestão de Nova Função</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={appLabelClass} htmlFor="support-mensagem">
                      <span className="inline-flex items-center gap-1.5 font-bold text-[#3E382E]">
                        <MessageSquareText className="h-3.5 w-3.5 text-[#1F5942]" /> O que está acontecendo?
                      </span>
                    </label>
                    <textarea
                      id="support-mensagem"
                      required
                      rows={5}
                      className={cn(appInputClass, 'min-h-[120px] resize-y py-3')}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Descreva sua dúvida, tela em que ocorreu ou o que você precisa que nossa equipe ajude a resolver..."
                    />
                  </div>

                  <AxeButton
                    type="submit"
                    variant="primary"
                    disabled={submitting}
                    className="w-full justify-center text-sm py-3"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Enviando chamado...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="h-4 w-4" /> Enviar Mensagem para o Suporte
                      </span>
                    )}
                  </AxeButton>
                </form>
              )}
            </AxeCard>
          </div>

          {/* Coluna 2: FAQ e Triage de Emergência */}
          <div className="space-y-5 xl:col-span-2">
            {/* Card Plantão */}
            <div className="rounded-lg border border-amber-500/35 bg-gradient-to-br from-[#1C170E] via-[#2A2113] to-[#1E190E] p-5 text-white shadow-md">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-black text-amber-200">
                    Sua Gira Começa Hoje?
                  </h4>
                  <p className="mt-1 text-xs text-amber-100/80 leading-relaxed">
                    Em dias de gira, nossa equipe prioriza atendimentos de emergência para garantir que portaria, chamada e cantina funcionem sem interrupção.
                  </p>
                </div>
              </div>
            </div>

            {/* Accordion FAQ */}
            <AxeCard className="p-5 sm:p-6">
              <h4 className="font-display text-base font-black text-[#17130D] mb-4">
                Dúvidas Frequentes da Casa
              </h4>
              <div className="space-y-3">
                {faqs.map((faq, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-[#E6DFD3] bg-[#FAF8F5] overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                        className="flex w-full items-center justify-between p-3.5 text-left text-xs font-black text-[#1E1A14] hover:bg-[#F3EFE8] transition"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-[#8F7724] transition-transform duration-200',
                            isOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {isOpen && (
                        <div className="border-t border-[#E6DFD3] px-3.5 py-3 text-xs leading-relaxed text-[#5F574B]">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </AxeCard>
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}
