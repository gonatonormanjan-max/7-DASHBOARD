import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getSalesOrderById } from "@/lib/dal/sales-orders";
import { formatCurrency } from "@/lib/products";
import { formatPaymentMode, formatSalesOrderVoidReason } from "@/lib/sales-orders";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/ui/detail-field";
import { PageHeader } from "@/components/ui/page-header";
import { SalesOrderStatusBadge } from "@/components/sales-orders/sales-order-status-badge";
import { SalesOrderWorkflowActions } from "@/components/sales-orders/sales-order-workflow-actions";

type SalesOrderDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesOrderDetailPage({
  params,
  searchParams,
}: SalesOrderDetailPageProps) {
  const { id } = await params;
  if (id === "new") {
    const resolvedSearchParams = await searchParams;
    const from = readParam(resolvedSearchParams.from);

    if (from) {
      redirect(`/dashboard/sales-orders/create/new?from=${encodeURIComponent(from)}`);
    }

    redirect("/dashboard/sales-orders/create/new");
  }
  const user = await requirePermission("sales_orders", "read");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/sales-orders/${id}`,
  });
  const order = await getSalesOrderById(id, { locationId: activeLocationId });
  const canUpdate = hasPermission(user.role, "sales_orders", "update");

  if (!order) {
    notFound();
  }

  const customerLabel = order.customerName.trim() || "Customer not set yet";
  const paymentLabel = order.paymentMode
    ? formatPaymentMode(order.paymentMode)
    : order.status === "DRAFT"
      ? "Payment pending until sale is recorded"
      : "Payment not captured";
  const paymentBreakdown = order.paymentMode
    ? `Cash ${formatCurrency(order.cashAmount ?? 0)} / Online ${formatCurrency(order.onlineAmount ?? 0)}`
    : "No payment breakdown yet";
  const voidReasonLabel = order.voidReason
    ? formatSalesOrderVoidReason(order.voidReason)
    : "Not documented";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sales"
        title={order.orderNumber}
        description="Review customer details, branch assignment, stock readiness, and the current workflow step for this order."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/sales-orders">
              <Button variant="outline">Back to sales</Button>
            </Link>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <SalesOrderStatusBadge status={order.status} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {order.items.length} item{order.items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Customer" value={customerLabel} />
            <DetailField label="Customer email" value={order.customerEmail ?? "Not provided"} />
            <DetailField
              label="Branch"
              value={order.items[0]?.location.name ?? "Branch not set yet"}
            />
            <DetailField label="Total amount" value={formatCurrency(order.totalAmount)} />
            <DetailField label="Payment mode" value={paymentLabel} />
            <DetailField label="Payment breakdown" value={paymentBreakdown} />
            <DetailField
              label="Created by"
              value={`${order.createdBy.firstName} ${order.createdBy.lastName}`}
            />
            <DetailField
              label="Notes"
              value={order.notes?.trim() ? order.notes : "No additional note provided."}
            />
            {order.status === "CANCELLED" ? (
              <>
                <DetailField label="Void reason" value={voidReasonLabel} />
                <DetailField
                  label="Void remarks"
                  value={order.voidRemarks?.trim() ? order.voidRemarks : "Not documented"}
                />
                <DetailField
                  label="Void documentation"
                  value={
                    order.voidDocumentation?.trim()
                      ? order.voidDocumentation
                      : "Not documented"
                  }
                />
                <DetailField
                  label="Voided by"
                  value={
                    order.voidedBy
                      ? `${order.voidedBy.firstName} ${order.voidedBy.lastName}`
                      : "Not documented"
                  }
                />
              </>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {item.product.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.product.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {formatCurrency(Number(item.unitPrice) * item.quantity)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50/70">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900" colSpan={4}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                    {formatCurrency(order.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {order.status === "CONFIRMED" ? (
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm text-slate-600">
                This order is confirmed and ready for delivery. Verify stock availability before marking as delivered.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Workflow actions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Move this order through its next valid status. Fulfilled sales can be voided with
              return documentation to restore stock accurately.
            </p>
            <div className="mt-4">
              <SalesOrderWorkflowActions
                canUpdate={canUpdate}
                orderId={order.id}
                status={order.status}
              />
            </div>
            {!canUpdate ? (
              <p className="mt-3 text-sm text-slate-500">
                You have read access to this order, but not permission to update it.
              </p>
            ) : null}
            {order.status === "COMPLETED" || order.status === "CANCELLED" ? (
              <p className="mt-3 text-sm text-slate-500">
                {order.status === "CANCELLED"
                  ? "This order is cancelled and no more workflow actions are available."
                  : "Completed orders can still be voided for return/refund cases with full documentation."}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Order timeline</h2>
            <div className="mt-4 space-y-4">
              <DetailField
                label="Created"
                value={order.createdAt.toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
              <DetailField
                label="Last updated"
                value={order.updatedAt.toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
              {order.voidedAt ? (
                <DetailField
                  label="Voided at"
                  value={order.voidedAt.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
              ) : null}
            </div>
          </div>

          <div className="pt-2">
            <Link href="/dashboard/sales-orders">
              <Button type="button" variant="ghost" className="w-full">
                Back to orders
              </Button>
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
