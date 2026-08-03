import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Headphones, Loader2, MessageSquareText, Phone, Send, UserRound, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AppDemoCard,
  AppPrimaryButton,
  appInputClass,
  appLabelClass,
} from '../components/ui/appDemoUi';
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
  const [mensagem, setMensagem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
    const body = mensagem.trim();

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

  if (loadingProfile) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="border-b border-[#D8D0C4] pb-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Ajuda da casa</p>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#DED8CB] bg-white text-[#8F7724]">
              <Headphones className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-black tracking-tight text-[#17130D] sm:text-3xl">Suporte</h1>
              <p className="mt-1.5 text-sm font-semibold leading-relaxed text-[#665F55]">
                Envie sua dúvida ou problema. Nossa equipe recebe no e-mail e retorna pelo WhatsApp informado.
              </p>
            </div>
          </div>
        </header>

        {sent ? (
          <AppDemoCard className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h2 className="text-lg font-black text-[#17130D]">Pedido enviado</h2>
            <p className="max-w-md text-sm font-semibold text-[#665F55]">
              Recebemos sua mensagem. Em breve entraremos em contato no WhatsApp {whatsapp || 'informado'}.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-2 text-sm font-bold text-[#8F7724] hover:underline"
            >
              Enviar outro pedido
            </button>
          </AppDemoCard>
        ) : (
          <AppDemoCard className="p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div>
                <label className={appLabelClass} htmlFor="support-zelador">
                  <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Nome do zelador(a)</span>
                </label>
                <input
                  id="support-zelador"
                  required
                  className={appInputClass}
                  value={nomeZelador}
                  onChange={(e) => setNomeZelador(e.target.value)}
                  placeholder="Ex: Pai João"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className={appLabelClass} htmlFor="support-terreiro">
                  <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Nome do terreiro</span>
                </label>
                <input
                  id="support-terreiro"
                  required
                  className={appInputClass}
                  value={nomeTerreiro}
                  onChange={(e) => setNomeTerreiro(e.target.value)}
                  placeholder="Ex: Terreiro Axé da Mata"
                  autoComplete="organization"
                />
              </div>

              <div>
                <label className={appLabelClass} htmlFor="support-whatsapp">
                  <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> WhatsApp <span className="text-rose-500">*</span></span>
                </label>
                <input
                  id="support-whatsapp"
                  required
                  inputMode="tel"
                  className={appInputClass}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 13))}
                  placeholder="DDD + número (obrigatório)"
                  autoComplete="tel"
                />
                <p className="mt-1.5 text-xs font-semibold text-[#8E9AAA]">Usamos este número para retornar o atendimento.</p>
              </div>

              <div>
                <label className={appLabelClass} htmlFor="support-mensagem">
                  <span className="inline-flex items-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5" /> Como podemos ajudar?</span>
                </label>
                <textarea
                  id="support-mensagem"
                  required
                  rows={6}
                  className={cn(appInputClass, 'min-h-32 resize-y text-sm')}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value.slice(0, 4000))}
                  placeholder="Descreva o problema, o que tentou fazer e em qual tela aconteceu..."
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800" role="alert">
                  {error}
                </p>
              ) : null}

              <AppPrimaryButton type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Enviando...' : 'Enviar para o suporte'}
              </AppPrimaryButton>
            </form>
          </AppDemoCard>
        )}
      </div>
    </AppPageShell>
  );
}
