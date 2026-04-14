import Link from "next/link";
import type { SalesOrderStatus } from "@prisma/client";
import { formatCurrency } from "@/lib/products";
import { canArchiveSalesOrder, formatSalesOrderStatus } from "@/lib/sales-orders";
import { formatDateTimePH } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArchiveOrderButton, UnarchiveOrderButton } from "@/components/sales-orders/archive-actions";

type SalesOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  status: SalesOrderStatus;
  totalAmount: { toString(): string };
  createdAt: Date;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  _count: {
    items: number;
  };
};

type SalesOrdersTableProps = {
  orders: SalesOrderRow[];
  canCreate: boolean;
  canManageArchive?: boolean;
  hasFilters?: boolean;
  isArchiveView?: boolean;
};

export function SalesOrdersTable({
  orders,
  canCreate,
  canManageArchive = false,
  hasFilters = false,
  isArchiveView = false,
}: SalesOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">
          {hasFilters ? "No matching sales found" : "No sales recorded yet"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {hasFilters
            ? "Try a broader search or clear the filters to see more recent sales."
            : "Record the first customer sale to start updating inventory from daily transactions."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <th className="px-5 py-4">Order</th>
              <th className="px-5 py-4">Customer</th>
              <th className="px-5 py-4">Lines</th>
              <th className="px-5 py-4">Total</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Created</th>
              <th className="px-5 py-4">Entered By</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {orders.map((order) => (
              <tr key={order.id} className="align-top">
                <td className="px-5 py-4">
                  <Link
                    className="font-semibold text-slate-950 transition hover:text-primary"
                    href={`/dashboard/sales-orders/${order.id}`}
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  <p>{order.customerName}</p>
                  <p className="mt-1 text-slate-500">{order.customerEmail ?? "No email"}</p>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{order._count.items}</td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {formatCurrency(order.totalAmount.toString())}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={formatSalesOrderStatus(order.status)} />
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {formatDateTimePH(order.createdAt)}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {order.createdBy.firstName} {order.createdBy.lastName}
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/dashboard/sales-orders/${order.id}`}>
                        <Button variant="outline">View</Button>
                      </Link>
                      {canCreate && order.status !== "CANCELLED" ? (
                        <Link href={`/dashboard/sales-orders/create/new?from=${order.id}`}>
                          <Button>Duplicate</Button>
                        </Link>
                      ) : null}
                      {canManageArchive && isArchiveView ? (
                        <UnarchiveOrderButton orderId={order.id} />
                      ) : null}
                      {canManageArchive && !isArchiveView && canArchiveSalesOrder(order.status) ? (
                        <ArchiveOrderButton orderId={order.id} />
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
