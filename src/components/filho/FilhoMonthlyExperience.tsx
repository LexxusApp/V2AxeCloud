import { cn } from '../../lib/utils';
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
  pendingList?: MonthlyItem[];
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
  linkedTransactions?: (MonthlyItem & { tipo?: string; categoria?: string })[];
  receiptInputRef: RefObject<HTMLInputElement | null>;
  onOpenPix: () => void;
  onOpenPixItem?: (item: MonthlyItem) => void;
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
  const parsed = new Date(value.length === 10 ? value + 'T00:00:00' : value);
  if (Number.isNaN(parsed.getTime())) return 'Data não informada';
  return format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function formatMonthYear(dateStr?: string) {
  if (!dateStr) return 'Mês em aberto';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  if (Number.isNaN(d.getTime())) return 'Mês em aberto';
  const mes = format(d, "MMMM 'de' yyyy", { locale: ptBR });
  return mes.charAt(0).toUpperCase() + mes.slice(1);
}

function isDateOverdue(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export default function FilhoMonthlyExperience({
  active,
  pending,
  pendingList = [],
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
  linkedTransactions = [],
  receiptInputRef,
  onOpenPix,
  onOpenPixItem,
  onSelectReceipt,
  onTalkToHouse,
  onCpfDraftChange,
  onSaveCpf,
}: Props) {
  const pendingItems = pendingList && pendingList.length > 0 ? pendingList : (pending ? [pending as MonthlyItem] : []);
  const isPending = active && pendingItems.length > 0;
  const totalPending = pendingItems.reduce((acc, it) => acc + (Number(it.valor) || 0), 0);
  const currentValue = totalPending || (pending?.valor || configuredValue);
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
          <p>{!active ? 'Cobrança pausada' : isPending ? (pendingItems.length > 1 ? `${pendingItems.length} meses pendentes` : 'Situação deste mês') : 'Situação deste mês'}</p>
          <div>
            <span>{!active ? <ShieldCheck /> : isPending ? <Clock3 /> : <CheckCircle2 />}</span>
            <strong>{!active ? 'Não habilitada' : isPending ? (pendingItems.length > 1 ? `${pendingItems.length} pendências` : 'Aguardando pagamento') : 'Tudo em dia'}</strong>
          </div>
          <small>
            {!active
              ? 'A casa não utiliza mensalidade fixa neste momento.'
              : isPending
                ? (pendingItems.length > 1 ? `Total acumulado: ${money(totalPending)}.` : `Vencimento todo dia ${dueDay || 10}.`)
                : 'Você não possui mensalidades pendentes no momento.'}
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
                <p>{isPending ? (pendingItems.length > 1 ? 'Contribuições em aberto' : 'Contribuição em aberto') : 'Contribuição confirmada'}</p>
                <h2>{isPending ? money(currentValue) : 'Axé, está tudo certo.'}</h2>
                <span>
                  {isPending
                    ? (pendingItems.length > 1 ? 'Escolha o mês que deseja quitar via PIX ou envie o comprovante.' : 'Escolha PIX ou envie o comprovante caso já tenha realizado o pagamento.')
                    : 'Obrigado por contribuir com a manutenção e os caminhos da sua casa.'}
                </span>
              </div>
              <i>{isPending ? <AlertCircle /> : <Check />}</i>
            </div>

            {isPending && pendingItems.length > 0 && (
              <div className="filho-wallet-pending-multi space-y-2.5 my-3.5">
                {pendingItems.map((item, idx) => {
                  const overdue = isDateOverdue(item.data);
                  return (
                    <div
                      key={item.id || idx}
                      className="rounded-xl border border-amber-400/40 bg-black/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-amber-300 shrink-0" />
                          <span className="font-black text-[#F1F5F9] text-sm">{formatMonthYear(item.data)}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                              overdue ? "bg-rose-500/20 text-rose-300" : "bg-amber-400/20 text-amber-300"
                            )}
                          >
                            {overdue ? "Em atraso" : "A vencer"}
                          </span>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-1 truncate">{item.descricao || "Mensalidade do terreiro"}</p>
                        <p className="text-sm font-black text-amber-200 mt-0.5">{money(item.valor)}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenPixItem ? onOpenPixItem(item) : onOpenPix()}
                          disabled={pixUnavailable}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-black text-[#080A0D] hover:bg-amber-300 transition shadow-xs"
                        >
                          <QrCode className="h-3.5 w-3.5" /> Pagar PIX
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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

      {linkedTransactions.length > 0 && <section className="filho-wallet-history">
        <header><div><p>Registros da zeladoria</p><h2>Outros lançamentos vinculados a você</h2></div></header>
        <div className="filho-wallet-history__list">{linkedTransactions.map(item => <article key={item.id}>
          <div className="filho-wallet-history__icon"><ReceiptText /></div>
          <div className="filho-wallet-history__copy"><span>{item.tipo === 'saida' ? 'Saída do caixa' : 'Entrada no caixa'} · {item.categoria}</span><h3>{item.descricao}</h3><p><CalendarDays /> {safeDate(item.data)}</p></div>
          <div className="filho-wallet-history__value"><strong>{money(item.valor)}</strong></div>
        </article>)}</div>
      </section>}
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
