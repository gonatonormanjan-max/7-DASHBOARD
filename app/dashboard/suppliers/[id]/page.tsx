import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getSupplierById } from "@/lib/dal/suppliers";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/ui/detail-field";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseOrderStatusBadge } from "@/components/purchase-orders/po-status-badge";

type SupplierDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SupplierDetailPage({
  params,
}: SupplierDetailPageProps) {
  const user = await requirePermission("suppliers", "read");
  const { id } = await params;
  const supplier = await getSupplierById(id);
  const canUpdate = hasPermission(user.role, "suppliers", "update");

  if (!supplier) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title={supplier.name}
        description="Supplier contact details, order history, and product link summary."
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/suppliers">
              <Button variant="outline">Back to suppliers</Button>
            </Link>
            {canUpdate ? (
              <Link href={`/dashboard/suppliers/${supplier.id}/edit`}>
                <Button>Edit Supplier</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                supplier.isActive
                  ? "bg-green-50 text-green-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {supplier.isActive ? "Active" : "Inactive"}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {supplier._count.purchaseOrders} purchase order
              {supplier._count.purchaseOrders !== 1 ? "s" : ""}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {supplier._count.productLinks} linked product
              {supplier._count.productLinks !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label="Contact name"
              value={supplier.contactName ?? "Not set"}
            />
            <DetailField
              label="Email"
              value={
                supplier.email ? (
                  <a className="hover:underline" href={`mailto:${supplier.email}`}>
                    {supplier.email}
                  </a>
                ) : (
                  "Not set"
                )
              }
            />
            <DetailField
              label="Phone"
              value={supplier.phone ?? "Not set"}
            />
            <DetailField
              label="Address"
              value={supplier.address ?? "Not set"}
            />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Supplier timeline</h2>
            <div className="mt-4 space-y-4">
              <DetailField
                label="Created"
                value={supplier.createdAt.toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
              <DetailField
                label="Last updated"
                value={supplier.updatedAt.toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
            </div>
          </div>

          {canUpdate ? (
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Actions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {supplier.isActive
                  ? "Edit this supplier's details or update their contact information."
                  : "This supplier is inactive and cannot be used on new purchase orders."}
              </p>
              <div className="mt-4">
                <Link href={`/dashboard/suppliers/${supplier.id}/edit`}>
                  <Button className="w-full" variant="outline">
                    Edit Supplier
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      {supplier.purchaseOrders.length > 0 ? (
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Recent purchase orders</h2>
          <p className="mt-1 text-sm text-slate-500">
            Last {supplier.purchaseOrders.length} order
            {supplier.purchaseOrders.length !== 1 ? "s" : ""} from this supplier.
          </p>

          <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {supplier.purchaseOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link
                        className="text-sm font-semibold text-primary hover:underline"
                        href={`/dashboard/purchase-orders/${order.id}`}
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <PurchaseOrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {formatCurrency(order.totalAmount.toString())}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {order.createdAt.toLocaleDateString("en-PH", {
                        dateStyle: "medium",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {supplier._count.purchaseOrders > 5 ? (
            <div className="mt-3 flex justify-end">
              <Link href={`/dashboard/purchase-orders?supplier=${supplier.id}`}>
                <Button size="sm" variant="ghost">
                  View all {supplier._count.purchaseOrders} orders →
                </Button>
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
