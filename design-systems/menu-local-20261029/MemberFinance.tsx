import { useState } from "react";
import { Eye, Wallet } from "lucide-react";
import { WorkflowDialog } from "./WorkflowUI";
import {
  monthlyLabel,
  shortFinancialDate,
  type MonthlyCharge,
} from "./billing";
import { financialMoney as money, type LedgerEntry } from "./finance";
import { consumptionTotal, type CantinaState } from "./cantina";
import { shopOrderLabel, shopTotal, type LocalShop } from "./shopLogic";
import type { DemoPix } from "./PixSettingsPage";
type Props = {
  memberId: string;
  name: string;
  charges: MonthlyCharge[];
  ledger: LedgerEntry[];
  cantina: CantinaState;
  shop: LocalShop;
  pix: DemoPix | null;
};
export default function MemberFinance(props: Props) {
  const [preview, setPreview] = useState(false);
  const { memberId, name, charges, ledger, cantina, shop, pix } = props;
  const monthly = charges
    .filter((charge) => charge.memberId === memberId)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const sales = cantina.sales.filter((sale) => sale.memberId === memberId);
  const orders = shop.orders.filter((order) => order.memberId === memberId);
  const cash = ledger.filter(
    (entry) => entry.memberId === memberId && entry.source === "manual",
  );
  const debt =
    monthly
      .filter((charge) => charge.status === "pending")
      .reduce((sum, charge) => sum + charge.totalCents, 0) +
    sales
      .filter((sale) => !sale.settled)
      .reduce((sum, sale) => sum + consumptionTotal(sale), 0) +
    orders
      .filter((order) => order.status === "pending")
      .reduce((sum, order) => sum + shopTotal(order.lines), 0);
  const content = (
    <>
      <div className="member-finance-summary">
        <div>
          <span>Total em aberto</span>
          <strong>{money(debt)}</strong>
        </div>
        <Wallet size={24} />
      </div>
      <h3 className="member-finance-heading">Mensalidades</h3>
      {monthly.length ? (
        monthly.map((charge) => (
          <div
            className={`member-finance-record ${charge.status}`}
            key={charge.id}
          >
            <div>
              <strong>{monthlyLabel(charge.reference)}</strong>
              <small>Vencimento {shortFinancialDate(charge.dueDate)}</small>
              <small>{charge.description}</small>
              <small>
                Base {money(charge.baseCents)} + juros{" "}
                {money(charge.extraCents)}
              </small>
            </div>
            <span>
              <strong>{money(charge.totalCents)}</strong>
              <small style={{ display: "block", marginTop: 6 }}>
                {charge.status === "paid"
                  ? `Quitada · ${shortFinancialDate(charge.receivedDate!)}`
                  : "Em aberto"}
              </small>
            </span>
          </div>
        ))
      ) : (
        <p className="member-finance-reference">
          Nenhuma mensalidade lançada. Criar um membro não gera cobranças
          automaticamente.
        </p>
      )}
      <h3 className="member-finance-heading">Cantina</h3>
      {sales.length ? (
        sales.map((sale) => (
          <div
            className={`member-finance-record ${sale.settled ? "paid" : "pending"}`}
            key={sale.id}
          >
            <div>
              <strong>{sale.code}</strong>
              <small>
                {sale.lines
                  .map((line) => `${line.quantity} × ${line.name}`)
                  .join(", ")}
              </small>
            </div>
            <span>
              {money(consumptionTotal(sale))}
              <small style={{ display: "block", marginTop: 6 }}>
                {sale.settled ? "Quitado" : "Na caderneta"}
              </small>
            </span>
          </div>
        ))
      ) : (
        <p className="member-finance-reference">Nenhum consumo vinculado.</p>
      )}
      <h3 className="member-finance-heading">Loja</h3>
      {orders.length ? (
        orders.map((order) => (
          <div className="member-finance-record" key={order.id}>
            <div>
              <strong>{order.code}</strong>
              <small>{shopOrderLabel(order)}</small>
              <small>
                {order.lines
                  .map((line) => `${line.quantity} × ${line.name}`)
                  .join(", ")}
              </small>
            </div>
            <span>{money(shopTotal(order.lines))}</span>
          </div>
        ))
      ) : (
        <p className="member-finance-reference">Nenhum pedido vinculado.</p>
      )}
      {cash.length > 0 && (
        <>
          <h3 className="member-finance-heading">
            Outros movimentos vinculados
          </h3>
          {cash.map((entry) => (
            <div className="member-finance-record" key={entry.id}>
              <div>
                <strong>{entry.description}</strong>
                <small>
                  {shortFinancialDate(entry.date)} ·{" "}
                  {entry.kind === "income"
                    ? "Entrada recebida"
                    : "Despesa paga"}
                </small>
              </div>
              <span>{money(entry.cents)}</span>
            </div>
          ))}
          <p className="member-finance-reference">
            Movimentos do caixa identificados com este membro. Estes registros
            não são cobranças pendentes.
          </p>
        </>
      )}
    </>
  );
  return (
    <>
      <div className="m-inline-actions">
        <button className="m-button secondary" onClick={() => setPreview(true)}>
          <Eye size={17} />
          Prévia do financeiro do membro
        </button>
      </div>
      {content}
      <WorkflowDialog
        open={preview}
        onOpenChange={setPreview}
        title={`Financeiro de ${name.split(" ")[0]}`}
        description="Visualização do membro usando os mesmos registros da zeladoria. Não é uma sessão de login dele."
      >
        {content}
        {pix && (
          <section className="billing-note" style={{ marginTop: 24 }}>
            <div>
              <strong>Dados do Pix configurados para a casa</strong>
              <p>{pix.beneficiary}</p>
              <p style={{ overflowWrap: "anywhere" }}>{pix.key}</p>
              <p>Nenhuma cobrança Pix real é gerada aqui.</p>
            </div>
          </section>
        )}
      </WorkflowDialog>
    </>
  );
}
