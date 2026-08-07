import type { RefObject } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  FileCheck2,
  Landmark,
  Loader2,
  MessageCircle,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Upload,
  WalletCards,
} from 'lucide-react';
import type { PixConfig } from '../PixPaymentModal';

type MonthlyItem = {
  id: string;
  descricao?: string;
  valor?: number | string;
  data?: string;
  status?: string;
};

type Props = {
  active: boolean;
  pending: { valor?: number | string } | null;
  configuredValue: number;
  dueDay: number;
  pixConfig: PixConfig | null;
  pixUnavailable: boolean;
  uploading: boolean;
  /** CPF com menos de 11 dígitos — comprovante automático exige completo. */
  needsFullCpf: boolean;
  cpfDraft: string;
  cpfSaving: boolean;
  cpfError: string | null;
  history: MonthlyItem[];
  receiptInputRef: RefObject<HTMLInputElement | null>;
  onOpenPix: () => void;
  onSelectReceipt: (file: File) => void;
  onTalkToHouse: () => void;
  onCpfDraftChange: (value: string) => void;
  onSaveCpf: () => void;
};

function money(value: number | string | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function safeDate(value?: string) {
  if (!value) return 'Data não informada';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data não informada';
  return format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export default function FilhoMonthlyExperience({
  active,
  pending,
  configuredValue,
  dueDay,
  pixConfig,
  pixUnavailable,
  uploading,
  needsFullCpf,
  cpfDraft,
  cpfSaving,
  cpfError,
  history,
  receiptInputRef,
  onOpenPix,
  onSelectReceipt,
  onTalkToHouse,
  onCpfDraftChange,
  onSaveCpf,
}: Props) {
  const isPending = active && Boolean(pending);
  const currentValue = pending?.valor || configuredValue;
  const receiptBlocked = needsFullCpf;

  return (
    <div className="filho-wallet-page">
      <header className={`filho-wallet-hero ${isPending ? 'is-pending' : 'is-clear'}`}>
        <div className="filho-wallet-hero__identity">
          <span><WalletCards /></span>
          <div>
            <p><Sparkles /> Contribuição da casa</p>
            <h1>Minha<br /><strong>mensalidade.</strong></h1>
          </div>
        </div>

        <div className="filho-wallet-hero__status">
          <p>{!active ? 'Cobrança pausada' : isPending ? 'Situação deste mês' : 'Situação deste mês'}</p>
          <div>
            <span>{!active ? <ShieldCheck /> : isPending ? <Clock3 /> : <CheckCircle2 />}</span>
            <strong>{!active ? 'Não habilitada' : isPending ? 'Aguardando pagamento' : 'Tudo em dia'}</strong>
          </div>
          <small>
            {!active
              ? 'A casa não utiliza mensalidade fixa neste momento.'
              : isPending
                ? `Vencimento todo dia ${dueDay || 10}.`
                : 'Sua contribuição deste mês já foi identificada.'}
          </small>
        </div>
      </header>

      {!active ? (
        <section className="filho-wallet-disabled">
          <div><ShieldCheck /></div>
          <span>
            <p>Nenhuma ação necessária</p>
            <h2>A mensalidade está desativada pela casa.</h2>
            <small>Se precisar confirmar alguma contribuição ou doação, converse diretamente com a zeladoria.</small>
          </span>
          <button type="button" onClick={onTalkToHouse}><MessageCircle /> Falar com a casa</button>
        </section>
      ) : (
        <section className="filho-wallet-grid">
          <article className={`filho-wallet-current ${isPending ? 'is-pending' : 'is-paid'}`}>
            <div className="filho-wallet-current__top">
              <div>
                <p>{isPending ? 'Contribuição em aberto' : 'Contribuição confirmada'}</p>
                <h2>{isPending ? money(currentValue) : 'Axé, está tudo certo.'}</h2>
                <span>
                  {isPending
                    ? 'Escolha PIX ou envie o comprovante caso já tenha realizado o pagamento.'
                    : 'Obrigado por contribuir com a manutenção e os caminhos da sua casa.'}
                </span>
              </div>
              <i>{isPending ? <AlertCircle /> : <Check />}</i>
            </div>

            {isPending ? (
              <>
                {needsFullCpf ? (
                  <div className="filho-wallet-cpf-gate">
                    <p>
                      Para validar o comprovante automático, complete seu CPF (11 dígitos). A senha de
                      login continua sendo só os 6 primeiros.
                    </p>
                    <div className="filho-wallet-cpf-gate__row">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={11}
                        value={cpfDraft}
                        onChange={(event) => onCpfDraftChange(event.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="CPF completo"
                        aria-label="CPF completo"
                      />
                      <button type="button" disabled={cpfSaving || cpfDraft.length !== 11} onClick={onSaveCpf}>
                        {cpfSaving ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                        {cpfSaving ? 'Salvando…' : 'Salvar CPF'}
                      </button>
                    </div>
                    {cpfError ? <small className="filho-wallet-cpf-gate__error">{cpfError}</small> : null}
                  </div>
                ) : null}
                <div className="filho-wallet-current__actions">
                  <button type="button" onClick={onOpenPix} disabled={pixUnavailable} data-filho-tour="mensalidade-pix">
                    <QrCode /> Pagar com PIX
                  </button>
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    hidden
                    disabled={uploading || receiptBlocked}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onSelectReceipt(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploading || receiptBlocked}
                    onClick={() => receiptInputRef.current?.click()}
                    data-filho-tour="mensalidade-comprovante"
                  >
                    {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                    {uploading ? 'Analisando...' : receiptBlocked ? 'Complete o CPF primeiro' : 'Enviar comprovante'}
                  </button>
                </div>
                {pixUnavailable ? <p className="filho-wallet-current__warning">A casa ainda não cadastrou uma chave PIX.</p> : null}
              </>
            ) : (
              <div className="filho-wallet-current__receipt">
                <FileCheck2 />
                <span><strong>Pagamento reconhecido</strong><small>O registro já aparece no seu histórico abaixo.</small></span>
              </div>
            )}
          </article>

          <aside className="filho-wallet-guide">
            <header><Landmark /><div><p>Como funciona</p><h2>Simples e reservado.</h2></div></header>
            <ol>
              <li><span>1</span><p><strong>Faça o PIX</strong><small>Use o QR Code gerado para a casa.</small></p></li>
              <li><span>2</span><p><strong>Envie o comprovante</strong><small>O AxéCloud confere os dados da imagem.</small></p></li>
              <li><span>3</span><p><strong>Acompanhe a confirmação</strong><small>O pagamento entra no histórico pessoal.</small></p></li>
            </ol>
            <p className="filho-wallet-guide__privacy"><ShieldCheck /> Sua contribuição não fica exposta para a corrente.</p>
          </aside>
        </section>
      )}

      {active && isPending && pixConfig ? (
        <section className="filho-wallet-pix-strip">
          <div><QrCode /><span><small>Chave PIX da casa</small><strong>{pixConfig.nome_beneficiario || 'Terreiro'}</strong></span></div>
          <code>{pixConfig.chave_pix}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(pixConfig.chave_pix);
            }}
          >
            <Copy /> Copiar chave
          </button>
        </section>
      ) : null}

      <section className="filho-wallet-history">
        <header>
          <div><p>Memória financeira</p><h2>Meus recibos</h2></div>
          <span>{history.length} {history.length === 1 ? 'registro' : 'registros'}</span>
        </header>

        {history.length ? (
          <div className="filho-wallet-history__list">
            {history.map((item) => (
              <article key={item.id}>
                <div className="filho-wallet-history__icon"><ReceiptText /></div>
                <div className="filho-wallet-history__copy">
                  <span>Contribuição confirmada</span>
                  <h3>{item.descricao || 'Mensalidade da casa'}</h3>
                  <p><CalendarDays /> {safeDate(item.data)}</p>
                </div>
                <div className="filho-wallet-history__value">
                  <strong>{money(item.valor)}</strong>
                  <span><Check /> Confirmado</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="filho-wallet-history__empty">
            <div aria-hidden><span /><span /><span /></div>
            <ReceiptText />
            <h3>Seus recibos aparecerão aqui.</h3>
            <p>Quando uma contribuição for confirmada, você terá um histórico simples e organizado.</p>
          </div>
        )}
      </section>
    </div>
  );
}
