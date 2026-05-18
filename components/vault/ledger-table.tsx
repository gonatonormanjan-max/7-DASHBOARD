import Link from "next/link";
import { VaultPaymentMethod } from "@prisma/client";
import { formatDateTimeMNL } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { VaultLedgerRow } from "@/lib/dal/vault";
import { VaultTypePill } from "@/components/vault/type-pill";

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

function formatAmount(amount: { toString(): string }) {
  const n = Number(amount.toString());
  return PHP.format(n);
}

function methodLabel(method: VaultPaymentMethod) {
  return method === VaultPaymentMethod.CASH ? "Cash" : "Online";
}

function referenceLabel(row: VaultLedgerRow) {
  if (row.referenceType === "sales_order" && row.referenceId) {
    return (
      <Link
        className="text-[#11664b] underline underline-offset-2 hover:opacity-80"
        href={`/dashboard/sales-orders/${row.referenceId}`}
      >
        Sales order
      </Link>
    );
  }
  if (row.referenceType === "cash_out_transaction" && row.referenceId) {
    return (
      <Link
        className="text-[#11664b] underline underline-offset-2 hover:opacity-80"
        href={`/dashboard/sales-orders/cash-out/${row.referenceId}`}
      >
        Cash out
      </Link>
    );
  }
  if (row.referenceType && row.referenceId) {
    return <span className="text-muted-foreground">{row.referenceType}</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

export function VaultLedgerTable({ rows }: { rows: VaultLedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No vault activity for the selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">Date / Time</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Method</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Reference</th>
            <th className="px-4 py-3 font-medium">Performed By</th>
            <th className="px-4 py-3 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const amountNum = Number(row.amount.toString());
            const isNegative = amountNum < 0;

            return (
              <tr
                key={row.id}
                className="border-t border-border align-top transition hover:bg-muted/30"
              >
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  {formatDateTimeMNL(row.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <VaultTypePill type={row.type} />
                </td>
                <td className="px-4 py-3 text-foreground">
                  {methodLabel(row.paymentMethod)}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums",
                    isNegative ? "text-red-600" : "text-foreground"
                  )}
                >
                  {formatAmount(row.amount)}
                </td>
                <td className="px-4 py-3">{referenceLabel(row)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  {row.performedBy.firstName} {row.performedBy.lastName}
                </td>
                <td className="max-w-xs px-4 py-3 text-muted-foreground">
                  {row.notes ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
