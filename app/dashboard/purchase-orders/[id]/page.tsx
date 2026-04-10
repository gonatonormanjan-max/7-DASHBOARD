import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getPurchaseOrderById } from "@/lib/dal/purchase-orders";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/ui/detail-field";
import { PurchaseOrderStatusBadge } from "@/components/purchase-orders/po-status-badge";
import { PurchaseOrderWorkflowActions } from "@/components/purchase-orders/po-workflow-actions";
import { PageHeader } from "@/components/ui/page-header";

type PurchaseOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseOrderDetailPage({
  params,
}: PurchaseOrderDetailPageProps) {
  const user = await requirePermission("purchase_orders", "read");
  const { id } = await params;
  const order = await getPurchaseOrderById(id);
  const canApprove = hasPermission(user.role, "purchase_orders", "approve");
  const canUpdate = hasPermission(user.role, "purchase_orders", "update");

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title={order.orderNumber}
        description="Review supplier details, receiving progress, and the next valid workflow action for this order."
        action={
          <Link href="/dashboard/purchase-orders">
            <Button variant="outline">Back to purchase orders</Button>
          </Link>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
          <div className="flex flex-wrap items-center gap-3">
            <PurchaseOrderStatusBadge status={order.status} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {order.items.length} item{order.items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Supplier" value={order.supplier.name} />
            <DetailField label="Total amount" value={formatCurrency(order.totalAmount.toString())} />
            <DetailField
              label="Expected date"
              value={
                order.expectedDate
                  ? order.expectedDate.toLocaleDateString("en-PH", { dateStyle: "medium" })
                  : "Not set"
              }
            />
            <DetailField
              label="Created by"
              value={`${order.createdBy.firstName} ${order.createdBy.lastName}`}
            />
            <DetailField
              label="Notes"
              value={order.notes?.trim() ? order.notes : "No additional note provided."}
            />
          </div>

          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Ordered</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {order.items.map((item) => {
                  const progressLabel =
                    item.receivedQty >= item.quantity
                      ? "Complete"
                      : item.receivedQty > 0
                        ? "Partial"
                        : "Pending";

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {item.product.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.product.sku}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="flex flex-col">
                          <span>
                            {item.receivedQty} / {item.quantity}
                          </span>
                          <span className="text-xs text-slate-500">{progressLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatCurrency(item.unitCost.toString())}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatCurrency(item.unitCost.mul(item.quantity).toString())}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50/70">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900" colSpan={5}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                    {formatCurrency(order.totalAmount.toString())}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Workflow actions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Approve this order, receive inventory into a warehouse, or cancel it if it will
              no longer be fulfilled.
            </p>
            <div className="mt-4">
              <PurchaseOrderWorkflowActions
                canApprove={canApprove}
                canUpdate={canUpdate}
                orderId={order.id}
                status={order.status}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Order timeline</h2>
            <div className="mt-4 space-y-4">
              <DetailField
                label="Created"
                value={order.createdAt.toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
              <DetailField
                label="Last updated"
                value={order.updatedAt.toLocaleString("en-PH", {
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
