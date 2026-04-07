import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getSalesOrderById } from "@/lib/dal/sales-orders";
import { formatCurrency } from "@/lib/products";
import { formatSalesOrderStatus } from "@/lib/sales-orders";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/ui/detail-field";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { VoidSaleButton } from "@/components/sales-orders/void-sale-button";

type SalesOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SalesOrderDetailPage({
  params,
}: SalesOrderDetailPageProps) {
  const user = await requirePermission("sales_orders", "read");
  const { id } = await params;
  const order = await getSalesOrderById(id);
  const canCreate = hasPermission(user.role, "sales_orders", "create");
  const canUpdate = hasPermission(user.role, "sales_orders", "update");
  const isCancelled = order?.status === "CANCELLED";
  const isCompleted = order?.status === "COMPLETED";

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sales Order Detail"
        title={order.orderNumber}
        description={
          isCancelled
            ? "This record keeps the original sale details together with the later void that returned stock to inventory."
            : "This record shows the customer purchase that was entered into the system and the inventory effect it created."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/sales-orders">
              <Button variant="outline">Back to sales</Button>
            </Link>
            {canCreate && !isCancelled && (
              <>
                <Link href="/dashboard/sales-orders/new">
                  <Button variant="outline">Record another sale</Button>
                </Link>
                <Link href={`/dashboard/sales-orders/new?from=${order.id}`}>
                  <Button>Duplicate sale</Button>
                </Link>
              </>
            )}
          </div>
        }
      />

      {isCancelled && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">
            This sale is now voided
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            The original stock has already been returned to inventory. The line items below remain here as the historical record of what was first entered.
          </p>
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={formatSalesOrderStatus(order.status)} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {order.items.length} line{order.items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Customer" value={order.customerName} />
            <DetailField label="Customer email" value={order.customerEmail ?? "Not provided"} />
            <DetailField label="Total amount" value={formatCurrency(order.totalAmount.toString())} />
            <DetailField
              label="Entered by"
              value={`${order.createdBy.firstName} ${order.createdBy.lastName}`}
            />
            <DetailField
              label="Notes"
              value={order.notes?.trim() ? order.notes : "No additional note provided."}
            />
          </div>

          {isCancelled ? (
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
              These line items show the original completed sale before it was voided.
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Warehouse</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {order.items.map((item) => (
                  <tr key={item.id} className={isCancelled ? "bg-slate-50/50" : ""}>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{item.product.name}</p>
                      <p className="mt-1 text-slate-500">{item.product.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {item.location.name} ({item.location.code})
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {formatCurrency(item.unitPrice.toString())}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {formatCurrency((Number(item.unitPrice.toString()) * item.quantity).toFixed(2))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-6">
          {canUpdate && isCompleted && (
            <div className="rounded-[24px] border border-amber-100 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
              <h2 className="text-lg font-semibold text-slate-950">
                Need to void this sale?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use this when the sale should no longer count as completed. We will mark the order as voided and return the original stock to inventory while keeping the record for history.
              </p>
              <div className="mt-4">
                <VoidSaleButton orderId={order.id} />
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Inventory behavior</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {isCancelled ? (
                <>
                  <p>
                    This order was voided after completion, so its stock has already been returned to the original warehouses.
                  </p>
                  <p>
                    The audit trail keeps a return movement for each line so the reversal remains traceable later.
                  </p>
                </>
              ) : (
                <>
                  <p>This MVP records sales as completed immediately.</p>
                  <p>
                    Each line created a SALES_FULFILLED movement against the
                    selected warehouse.
                  </p>
                  <p>
                    Stock was deducted in the same database transaction as the
                    order creation.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Record activity</h2>
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
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
