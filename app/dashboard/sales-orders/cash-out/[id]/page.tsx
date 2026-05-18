import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { voidCashOutAction } from "@/lib/actions/cash-out";
import { canVoidCashOutTransaction } from "@/lib/cash-out";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getCashOutById } from "@/lib/dal/cash-out";
import { formatCurrency } from "@/lib/products";
import { formatDateTimeMNL } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CashOutStatusBadge } from "@/components/cash-out/cash-out-status-badge";
import { VoidCashOutForm } from "@/components/cash-out/void-cash-out-form";

type CashOutDetailPageProps = {
  params: Promise<{ id: string }>;
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="border-t border-slate-200 py-3 first:border-t-0">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm text-slate-800">{value}</div>
    </div>
  );
}

export default async function CashOutDetailPage({
  params,
}: CashOutDetailPageProps) {
  const { id } = await params;
  const user = await requirePermission("sales_orders", "read");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/sales-orders/cash-out/${id}`,
  });
  const transaction = await getCashOutById(id, user, {
    locationId: activeLocationId,
  });

  if (!transaction) {
    notFound();
  }

  const canVoid =
    transaction.status === "COMPLETED" && canVoidCashOutTransaction(user.role);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sales"
        title={transaction.transactionNumber}
        description="Cash-out service transaction detail and audit trail."
        action={
          <Link href="/dashboard/sales-orders/cash-out">
            <Button type="button" variant="outline">
              Back to Cash Out
            </Button>
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cash paid out"
          value={formatCurrency(transaction.cashOutAmount)}
          tone="warning"
          description="Physical cash deducted from the branch vault."
        />
        <StatCard
          label="Service fee"
          value={formatCurrency(transaction.feeAmount)}
          tone="success"
          description="Separate non-inventory service revenue."
        />
        <StatCard
          label="Online received"
          value={formatCurrency(transaction.onlineReceivedAmount)}
          tone="primary"
          description="Credited to the shared cash-out service vault."
        />
        <div className="rounded-lg border border-border border-t-2 border-t-info bg-card p-5">
          <p className="tracking-label text-[11px] text-muted-foreground">
            Status
          </p>
          <div className="mt-3">
            <CashOutStatusBadge status={transaction.status} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Transaction details
          </h2>
          <div className="mt-4">
            <DetailRow
              label="Branch"
              value={`${transaction.branchName} (${transaction.branchCode})`}
            />
            <DetailRow
              label="Online account"
              value={`${transaction.accountName}${transaction.accountProvider ? ` - ${transaction.accountProvider}` : ""}`}
            />
            <DetailRow
              label="Online reference"
              value={transaction.onlineReferenceNumber}
            />
            <DetailRow
              label="Customer"
              value={transaction.customerName || "Not provided"}
            />
            <DetailRow
              label="Customer contact"
              value={transaction.customerContact || "Not provided"}
            />
            <DetailRow
              label="Recorded by"
              value={`${transaction.createdByName} on ${formatDateTimeMNL(transaction.createdAt)}`}
            />
            <DetailRow label="Notes" value={transaction.notes || "None"} />
          </div>
        </div>

        <aside className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Audit state</h2>
          {transaction.status === "VOIDED" ? (
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <p>
                This cash-out transaction has been voided and its branch and
                service-vault balances were reversed.
              </p>
              <DetailRow
                label="Voided by"
                value={transaction.voidedByName || "Unknown"}
              />
              <DetailRow
                label="Voided at"
                value={
                  transaction.voidedAt
                    ? formatDateTimeMNL(transaction.voidedAt)
                    : "Unknown"
                }
              />
              <DetailRow
                label="Void reason"
                value={transaction.voidReason || "No reason provided"}
              />
            </div>
          ) : canVoid ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-600">
                Voiding reverses both sides: branch cash is restored and the
                shared online cash-out service vault is reduced.
              </p>
              <VoidCashOutForm
                action={voidCashOutAction}
                transactionId={transaction.id}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              Only Admin and System Manager can void a completed cash-out
              transaction.
            </p>
          )}
        </aside>
      </section>
    </div>
  );
}
