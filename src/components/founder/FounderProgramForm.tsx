import { useState } from 'react';
import { Check, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  BRAZIL_UF,
  FOUNDER_PROGRAM,
  TRADICAO_OPTIONS,
  type TradicaoValue,
} from '../../constants/founderProgram';
import { useFounderProgramStats } from '../../hooks/useFounderProgramStats';

const fieldClass = cn(
  'w-full rounded-lg border border-neutral-800 bg-neutral-900/80 px-3.5 py-3',
  'text-base text-white placeholder:text-neutral-500',
  'outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15',
);

const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-zinc-400 sm:text-[13px]';

type FounderProgramFormProps = {
  className?: string;
  showSlotsBanner?: boolean;
};

export function FounderProgramForm({ className, showSlotsBanner = true }: FounderProgramFormProps) {
  const { stats, loading: statsLoading } = useFounderProgramStats();
  const [nomeCasa, setNomeCasa] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('SP');
  const [tradicao, setTradicao] = useState<TradicaoValue>('umbanda');
  const [nomeContato, setNomeContato] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [autorizaPerfil, setAutorizaPerfil] = useState(true);
  const [autorizaDepoimento, setAutorizaDepoimento] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/founder-program/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_casa: nomeCasa,
          cidade,
          estado,
          tradicao,
          nome_contato: nomeContato,
          whatsapp,
          email,
          mensagem,
          autoriza_perfil_publico: autorizaPerfil,
          autoriza_depoimento: autorizaDepoimento,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível enviar a inscrição.');

      setSuccess(data.message || 'Inscrição recebida! Entraremos em contato em breve.');
      setNomeCasa('');
      setCidade('');
      setNomeContato('');
      setWhatsapp('');
      setEmail('');
      setMensagem('');
      setAutorizaDepoimento(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar inscrição.');
    } finally {
      setSubmitting(false);
    }
  };

  const slotsClosed = !statsLoading && !stats.acceptingApplications;

  return (
    <div className={className}>
      {showSlotsBanner ? (
        <div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3.5 text-base text-zinc-300">
          {statsLoading ? (
            <span className="text-zinc-500">Carregando vagas…</span>
          ) : slotsClosed ? (
            <span>
              <strong className="text-primary">Vagas esgotadas.</strong> Inscreva-se na lista de espera pelo{' '}
              <a href={FOUNDER_PROGRAM.waComercial} className="font-bold text-primary hover:underline" target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              .
            </span>
          ) : (
            <span>
              Restam{' '}
              <strong className="text-primary">{stats.remainingSlots}</strong> de {stats.maxSlots} vagas no Programa
              Fundador · {FOUNDER_PROGRAM.pilotCity}
            </span>
          )}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-base text-emerald-100" role="status">
          <p className="flex items-start gap-2 font-semibold">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            {success}
          </p>
          <a
            href={FOUNDER_PROGRAM.waComercial}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary hover:underline"
          >
            <MessageCircle className="h-4 w-4" />
            Ou fale direto no WhatsApp
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fp-nome-casa" className={labelClass}>
              Nome da casa / terreiro *
            </label>
            <input
              id="fp-nome-casa"
              required
              value={nomeCasa}
              onChange={(e) => setNomeCasa(e.target.value)}
              className={fieldClass}
              placeholder="Ex.: Terreiro de Oxum Iyemanjá"
              disabled={slotsClosed || submitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fp-cidade" className={labelClass}>
                Cidade *
              </label>
              <input
                id="fp-cidade"
                required
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className={fieldClass}
                placeholder="Ex.: São Paulo"
                disabled={slotsClosed || submitting}
              />
            </div>
            <div>
              <label htmlFor="fp-estado" className={labelClass}>
                Estado (UF) *
              </label>
              <select
                id="fp-estado"
                required
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className={fieldClass}
                disabled={slotsClosed || submitting}
              >
                {BRAZIL_UF.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="fp-tradicao" className={labelClass}>
              Tradição *
            </label>
            <select
              id="fp-tradicao"
              required
              value={tradicao}
              onChange={(e) => setTradicao(e.target.value as TradicaoValue)}
              className={fieldClass}
              disabled={slotsClosed || submitting}
            >
              {TRADICAO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fp-contato" className={labelClass}>
                Nome do responsável
              </label>
              <input
                id="fp-contato"
                value={nomeContato}
                onChange={(e) => setNomeContato(e.target.value)}
                className={fieldClass}
                placeholder="Zelador(a) ou diretoria"
                disabled={slotsClosed || submitting}
              />
            </div>
            <div>
              <label htmlFor="fp-whatsapp" className={labelClass}>
                WhatsApp *
              </label>
              <input
                id="fp-whatsapp"
                required
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={fieldClass}
                placeholder="(11) 91234-5678"
                disabled={slotsClosed || submitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="fp-email" className={labelClass}>
              E-mail (opcional)
            </label>
            <input
              id="fp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              placeholder="contato@casadeaxe.com.br"
              disabled={slotsClosed || submitting}
            />
          </div>

          <div>
            <label htmlFor="fp-mensagem" className={labelClass}>
              Mensagem (opcional)
            </label>
            <textarea
              id="fp-mensagem"
              rows={3}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className={cn(fieldClass, 'resize-y min-h-[88px]')}
              placeholder="Conte um pouco sobre a casa, quantos filhos de santo, ou o que mais precisa organizar."
              disabled={slotsClosed || submitting}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <input
              type="checkbox"
              checked={autorizaPerfil}
              onChange={(e) => setAutorizaPerfil(e.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
              disabled={slotsClosed || submitting}
            />
            <span className="text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
              Autorizo a exibição futura de perfil público no portal AxéCloud (nome da casa, cidade, tradição e
              contato — sem endereço completo sem meu consentimento). *
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3.5">
            <input
              type="checkbox"
              checked={autorizaDepoimento}
              onChange={(e) => setAutorizaDepoimento(e.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
              disabled={slotsClosed || submitting}
            />
            <span className="text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
              Autorizo depoimento sobre o uso do AxéCloud em materiais do site (opcional).
            </span>
          </label>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={slotsClosed || submitting || !autorizaPerfil}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-base font-black uppercase tracking-wider text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {slotsClosed ? 'Vagas esgotadas' : 'Quero ser casa fundadora'}
          </button>

          <p className="text-center text-xs leading-relaxed text-zinc-600 sm:text-sm">
            Gratuito por {FOUNDER_PROGRAM.freeMonths} meses para casas selecionadas. Depois:{' '}
            {FOUNDER_PROGRAM.futurePriceLabel}. Sem cartão nesta etapa.
          </p>
        </form>
      )}
    </div>
  );
}
