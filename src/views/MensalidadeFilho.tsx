import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Loader2, 
  Receipt,
  ArrowRight,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { cn } from '../lib/utils';
import PixPaymentModal, { PixConfig } from '../components/PixPaymentModal';
import { AppPageShell } from '../components/app/AppTopNav';
import { AppDemoCard, AppDemoPanelHeader, AppPrimaryButton } from '../components/ui/appDemoUi';
import { filhoKickerClass, filhoPanelClass, filhoPanelInsetClass } from '../lib/filhoUiTokens';
import { MensalidadeCardSkeleton } from '../components/Skeleton';
import { isPaidMensalidadeFinanceRow } from '../lib/mensalidadeFinanceRow';
import { readStaleCache, writeStaleCache, clearStaleCacheKey } from '../lib/staleCache';
import { format, setDate, addMonths, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MensalidadeFilhoProps {
  user: any;
  tenantData?: any;
  setActiveTab: (tab: string) => void;
}

const MENSALIDADE_VALOR_PADRAO = 89.9;

type MensalidadeCachePayload = {
  filho: any;
  valorMensalidadeConfig: number;
  pendingMensalidade: any;
  diaVencimento: number;
  pixConfig: PixConfig | null;
  pixFetched: boolean;
  mensalidades: any[];
};

export default function MensalidadeFilho({ user, tenantData, setActiveTab }: MensalidadeFilhoProps) {
  const [filho, setFilho] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mensalidades, setMensalidades] = useState<any[]>([]);
  const [pendingMensalidade, setPendingMensalidade] = useState<any>(null);
  const [valorMensalidadeConfig, setValorMensalidadeConfig] = useState(MENSALIDADE_VALOR_PADRAO);
  
  const [pixConfig, setPixConfig] = useState<PixConfig | null>(null);
  const [diaVencimento, setDiaVencimento] = useState<number>(10);
  const [loadingPix, setLoadingPix] = useState(false);
  const [pixFetched, setPixFetched] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [mensalidadeAtiva, setMensalidadeAtiva] = useState(true);

  const tenantId = tenantData?.tenant_id;
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !tenantId) {
      setLoading(true);
      return;
    }
    const cacheKey = `mensalidade_${userId}_${tenantId}`;
    const cached = readStaleCache<MensalidadeCachePayload>(cacheKey);
    if (cached) {
      setFilho(cached.filho);
      setValorMensalidadeConfig(cached.valorMensalidadeConfig);
      setPendingMensalidade(cached.pendingMensalidade);
      setDiaVencimento(cached.diaVencimento);
      setPixConfig(cached.pixConfig);
      setPixFetched(cached.pixFetched);
      setMensalidades(cached.mensalidades);
      setLoading(false);
    } else {
      setLoading(true);
    }
    void fetchData();
  }, [userId, tenantId]);

  async function fetchData() {
    if (!userId || !tenantId) return;
    const cacheKey = `mensalidade_${userId}_${tenantId}`;
    clearStaleCacheKey(cacheKey);

    let snapValor = MENSALIDADE_VALOR_PADRAO;
    let snapPending: any = null;
    let snapDia = 10;
    let snapPix: PixConfig | null = null;

    try {
      // 1. Buscar Perfil do Filho
      let { data: childData, error: childError } = await supabase
        .from('filhos_de_santo')
        .select('id, nome, tenant_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!childData && user?.email) {
        const byEmail = await supabase
          .from('filhos_de_santo')
          .select('id, nome, tenant_id')
          .eq('email', user.email)
          .maybeSingle();
        childData = byEmail.data;
        childError = byEmail.error;
      }

      if (childError) throw childError;
      
      setFilho(childData);

      // Buscar Configurações de Pix e Valor do Zelador via API (bypass RLS)
      try {
        const pixRes = await authFetch(`/api/v1/financial/pix-config?tenantId=${encodeURIComponent(tenantId)}`);
        if (!pixRes.ok) {
          const body = await pixRes.text().catch(() => '');
          throw new Error(`Pix config HTTP ${pixRes.status}: ${body}`);
        }

        const { data: pixData } = await pixRes.json();
        if (pixData) {
          const ativa = pixData.mensalidade_ativa !== false;
          setMensalidadeAtiva(ativa);
          const configuredValue = Number(pixData.valor_mensalidade);
          if (!Number.isNaN(configuredValue) && configuredValue > 0 && ativa) {
            snapValor = configuredValue;
            setValorMensalidadeConfig(configuredValue);
            snapPending = {
              id: `mensalidade-${childData?.id || userId}`,
              descricao: 'Mensalidade do terreiro',
              valor: configuredValue,
              status: 'pendente',
            };
            setPendingMensalidade(snapPending);
          } else if (!ativa) {
            snapPending = null;
            setPendingMensalidade(null);
          }
          if (pixData.dia_vencimento) {
            snapDia = Number(pixData.dia_vencimento);
            setDiaVencimento(snapDia);
          }
          if (pixData.chave_pix) {
            snapPix = {
              chave_pix: pixData.chave_pix,
              tipo_chave: pixData.tipo_chave,
              nome_beneficiario: pixData.nome_beneficiario,
              cidade: 'BRASIL'
            };
            setPixConfig(snapPix);
          } else {
            setPixConfig(null);
          }
        } else {
          setPixConfig(null);
        }
      } catch (err) {
        console.error('Erro ao carregar configuração Pix do filho:', err);
        setPixConfig(null);
      } finally {
        setPixFetched(true);
      }

      let mensalidadesList: any[] = [];
      try {
        if (childData?.id) {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          const txParams = new URLSearchParams({
            tenantId,
            userId,
            userRole: "filho",
            limit: "150",
          });
          const em = String(user?.email || "").trim();
          if (em) txParams.set("userEmail", em);
          const txHeaders: Record<string, string> = {};
          if (token) txHeaders.Authorization = `Bearer ${token}`;
          const txRes = await authFetch(`/api/transactions?${txParams.toString()}`, { headers: txHeaders });
          if (txRes.ok) {
            const { data: txRaw } = await txRes.json();
            const txs = (txRaw || []) as any[];
            const now = new Date();
            const y = now.getFullYear();
            const mo = now.getMonth();
            const paidThisMonth = txs.some((t) => {
              if (!isPaidMensalidadeFinanceRow(t)) return false;
              const d = new Date(t.data);
              if (d.getFullYear() !== y || d.getMonth() !== mo) return false;
              if (t.filho_id === childData.id) return true;
              return new RegExp(`\\(ID:${childData.id}\\)`).test(String(t.descricao || ""));
            });
            if (paidThisMonth) {
              snapPending = null;
              setPendingMensalidade(null);
            }
            mensalidadesList = txs
              .filter((t) => isPaidMensalidadeFinanceRow(t))
              .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
              .map((t) => ({
                id: t.id,
                descricao: t.descricao || "Mensalidade",
                valor: Number(t.valor) || 0,
                data: t.data,
                status: "pago",
              }));
            setMensalidades(mensalidadesList);
          } else {
            setMensalidades([]);
          }
        } else {
          setMensalidades([]);
        }
      } catch (e) {
        console.warn('MensalidadeFilho: histórico financeiro', e);
        setMensalidades([]);
      }

      writeStaleCache(cacheKey, {
        filho: childData,
        valorMensalidadeConfig: snapValor,
        pendingMensalidade: snapPending,
        diaVencimento: snapDia,
        pixConfig: snapPix,
        pixFetched: true,
        mensalidades: mensalidadesList,
      });
    } catch (error) {
      console.error('Erro ao carregar mensalidade do filho:', error);
    } finally {
      setLoading(false);
    }
  }

  const ensurePixConfig = async () => {
    if (pixFetched || !tenantId) return;
    setLoadingPix(true);
    try {
      const res = await authFetch(`/api/v1/financial/pix-config?tenantId=${encodeURIComponent(tenantId)}`);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Pix config HTTP ${res.status}: ${body}`);
      }
      const { data } = await res.json();
      if (data?.chave_pix) {
        setPixConfig({
          chave_pix: data.chave_pix,
          tipo_chave: data.tipo_chave,
          nome_beneficiario: data.nome_beneficiario,
          cidade: 'BRASIL'
        });
        if (data.dia_vencimento) setDiaVencimento(Number(data.dia_vencimento));
      } else {
        setPixConfig(null);
      }
    } catch (err) {
      console.error('Error fetching pix config:', err);
    } finally {
      setLoadingPix(false);
      setPixFetched(true);
    }
  };

  const openPixModal = async () => {
    setPixModalOpen(true);
    await ensurePixConfig();
  };

  if (loading && filho == null) {
    return (
      <AppPageShell>
        <AppDemoPanelHeader title="Minhas mensalidades" description="Controle suas contribuições com o terreiro." />
        <MensalidadeCardSkeleton />
      </AppPageShell>
    );
  }

  const pixNotConfigured = pixFetched && !loadingPix && !pixConfig?.chave_pix;

  if (!loading && pixFetched && !mensalidadeAtiva) {
    return (
      <AppPageShell>
        <AppDemoPanelHeader
          title="Minhas mensalidades"
          description="Seu terreiro não utiliza cobrança de mensalidade fixa no momento."
        />
        <AppDemoCard className="py-12 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" aria-hidden />
          <p className="text-sm font-bold text-[#F1F5F9]">Mensalidade não habilitada</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#94A3B8]">
            A zeladoria desativou a cobrança mensal neste terreiro. Se tiver dúvidas, fale diretamente com a diretoria da casa.
          </p>
        </AppDemoCard>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <AppDemoPanelHeader title="Minhas mensalidades" description="Controle suas contribuições com o terreiro." />

      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Payment Section */}
          <div className="lg:col-span-8 space-y-8">
            {/* Status Card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                filhoPanelClass,
                'relative overflow-hidden p-6 sm:p-8',
                pendingMensalidade ? 'border-amber-500/20' : 'border-emerald-500/20',
              )}
            >
              <div className="relative z-10 flex flex-col justify-between gap-8 md:flex-row md:items-center">
                <div className="space-y-4">
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest',
                      pendingMensalidade
                        ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                        : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
                    )}
                  >
                    {pendingMensalidade ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {pendingMensalidade ? 'Contribuição pendente' : 'Contribuição em dia'}
                  </div>
                  <h3 className="text-2xl font-bold text-[#F1F5F9] sm:text-3xl">
                    {pendingMensalidade
                      ? `R$ ${Number(pendingMensalidade.valor).toFixed(2).replace('.', ',')}`
                      : 'Mensalidade do mês quitada'}
                  </h3>
                  <p className="max-w-sm text-sm leading-relaxed text-[#94A3B8]">
                    {pendingMensalidade
                      ? 'Sua contribuição mensal ajuda a manter o axé da casa. Use o Pix para pagar com segurança.'
                      : 'Obrigado pela dedicação. Sua mensalidade está em dia — axé!'}
                  </p>
                  {diaVencimento > 0 ? (
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary/90">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Vencimento: dia {diaVencimento} de cada mês
                    </p>
                  ) : null}
                </div>

                {pendingMensalidade ? (
                  <div className="flex flex-col gap-3">
                    <AppPrimaryButton
                      type="button"
                      onClick={openPixModal}
                      disabled={pixNotConfigured && pixFetched}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 px-8 py-3.5 text-xs uppercase tracking-widest',
                        pixNotConfigured && pixFetched && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <Zap className="h-4 w-4 fill-current" />
                      Visualizar QR Code Pix
                    </AppPrimaryButton>
                    {pixNotConfigured ? (
                      <p className="text-center text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        Terreiro ainda não cadastrou chave Pix
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {pendingMensalidade && pixConfig ? (
                <div className="relative z-10 mt-8 space-y-4 border-t border-[#1E242B] pt-8">
                  <div className="flex items-center gap-2 text-primary">
                    <DollarSign className="h-5 w-5" />
                    <h4 className="text-sm font-bold uppercase tracking-widest">Dados de pagamento</h4>
                  </div>
                  <div className={cn(filhoPanelInsetClass, 'flex flex-col items-center gap-6 p-5 md:flex-row md:items-start')}>
                    <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border border-[#1E242B] bg-[#13171D] p-3 text-center text-[10px] font-bold uppercase leading-snug text-[#64748B]">
                      Use o botão acima para ver o QR Code
                    </div>
                    <div className="min-w-0 flex-1 space-y-4">
                      <div>
                        <p className={filhoKickerClass}>Favorecido</p>
                        <p className="mt-1 font-semibold text-[#F1F5F9]">{pixConfig.nome_beneficiario || 'Terreiro'}</p>
                      </div>
                      <div>
                        <p className={filhoKickerClass}>Chave Pix ({pixConfig.tipo_chave})</p>
                        <div className="mt-1 flex items-center gap-3">
                          <code className="break-all rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 font-mono text-xs text-primary">
                            {pixConfig.chave_pix}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(pixConfig.chave_pix);
                              alert('Chave Pix copiada!');
                            }}
                            className="shrink-0 rounded-lg border border-[#1E242B] bg-[#13171D] p-2 text-primary transition-colors hover:border-primary/30"
                            title="Copiar chave"
                          >
                            <Receipt className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>

            {/* History Table */}
            <div className="space-y-6">
              <h4 className="flex items-center gap-3 text-lg font-bold text-[#F1F5F9]">
                <Receipt className="h-5 w-5 text-primary" />
                Histórico de contribuições
              </h4>
              
              <div className="grid gap-4">
                {mensalidades.length > 0 ? (
                  mensalidades.map((item, idx) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(filhoPanelClass, 'flex flex-col justify-between gap-4 p-5 transition-colors hover:border-[#2F3643] md:flex-row md:items-center')}
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-lg",
                          item.status === 'pago' ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5" : "bg-primary/10 text-primary shadow-primary/5"
                        )}>
                          {item.status === 'pago' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-white font-bold">{item.descricao || 'Mensalidade'}</p>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                            {item.data ? format(new Date(item.data), "dd 'de' MMMM, yyyy", { locale: ptBR }) : 'Data não informada'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-10">
                        <div className="text-right">
                          <p className="text-lg font-black text-white">R$ {Number(item.valor).toFixed(2).replace('.', ',')}</p>
                          <p className={cn(
                            "text-[10px] font-black uppercase tracking-widest mt-0.5",
                            item.status === 'pago' ? "text-emerald-500" : "text-primary"
                          )}>
                            {item.status === 'pago' ? "Confirmado" : "Pendente"}
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-700 group-hover:text-primary transition-colors group-hover:translate-x-1" />
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <AppDemoCard className="text-center space-y-4">
                    <Wallet className="w-12 h-12 text-gray-700 mx-auto" />
                    <p className="text-gray-500 font-medium italic">Nenhuma mensalidade registrada até o momento.</p>
                  </AppDemoCard>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar / Info Section */}
          <div className="lg:col-span-4 space-y-8">
            <AppDemoCard className="space-y-6">
              <h4 className="text-base font-bold uppercase tracking-widest text-[#F1F5F9]">Informações</h4>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Pagamento via Pix</p>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed">O sistema gera um QR Code dinâmico para você pagar diretamente no app do seu banco. A baixa é realizada manualmente pelo zelador após a confirmação.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Manutenção do Axé</p>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed">Sua contribuição é fundamental para o aluguel, luz, água e materiais de ritual da nossa casa.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] text-center italic">
                  "Quem ajuda o terreiro, ajuda a si mesmo."
                </p>
              </div>
            </AppDemoCard>

            {/* Quick Action */}
            <button
              type="button"
              onClick={() => setActiveTab('store')}
              className={cn(
                filhoPanelClass,
                'group relative flex w-full items-center justify-between overflow-hidden p-5 text-left transition-colors hover:border-primary/25',
              )}
            >
              <div className="relative z-10">
                <p className={filhoKickerClass}>Loja do Axé</p>
                <p className="mt-1 text-sm font-bold text-[#F1F5F9]">Precisa de velas ou guias?</p>
              </div>
              <ArrowRight className="relative z-10 h-5 w-5 text-primary transition-transform group-hover:translate-x-1" />
            </button>
          </div>

        </div>
      </div>

      <PixPaymentModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        loading={loadingPix}
        pixConfig={pixConfig}
        valor={pendingMensalidade?.valor || valorMensalidadeConfig}
        descricao="Mensalidade Terreiro"
        txid={(filho?.id || user.id).slice(0, 16).replace(/-/g, '')}
        vencimento={(() => {
          const hoje = new Date();
          let venc = setDate(hoje, diaVencimento);
          if (isBefore(venc, hoje)) venc = setDate(addMonths(hoje, 1), diaVencimento);
          return format(venc, "dd/MM/yyyy");
        })()}
      />
    </AppPageShell>
  );
}
