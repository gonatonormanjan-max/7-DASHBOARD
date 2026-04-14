import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatSignedQuantity, getMovementTypeLabel } from "@/lib/inventory";
import type { DashboardRecentMovement } from "@/lib/dal/dashboard";
import { cn } from "@/lib/utils";
import { formatShortDatePH, formatTimePH } from "@/lib/timezone";

type RecentActivityProps = {
  movements: DashboardRecentMovement[];
};

function getMovementBadgeClass(type: DashboardRecentMovement["type"]) {
  switch (type) {
    case "PURCHASE_RECEIVED":
      return "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]";
    case "TRANSFER_OUT":
    case "TRANSFER_IN":
      return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
    case "SALES_FULFILLED":
    case "DAMAGED_LOST":
      return "border-red-200 bg-red-50 text-destructive";
    case "CUSTOMER_RETURN":
      return "border-[#dcccf8] bg-[#f5efff] text-[#5f3ca2]";
    case "MANUAL_ADJUSTMENT":
      return "border-amber-200 bg-amber-50 text-[#8a5610]";
    case "INITIAL_STOCK":
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function formatRelativeTime(date: Date) {
  const diffInMs = Date.now() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes <= 0) {
    return "just now";
  }

  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return formatShortDatePH(date);
}

export function RecentActivity({ movements }: RecentActivityProps) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-slate-200/80 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-950">Recent Activity</h2>
        <p className="mt-1 text-sm text-slate-500">
          The latest inventory movements across your visible scope.
        </p>
      </div>

      {movements.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-6 py-4">When</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Qty Change</th>
                <th className="px-6 py-4">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {movements.map((movement) => (
                <tr key={movement.id} className="align-top">
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">
                      {formatRelativeTime(movement.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatShortDatePH(movement.createdAt)}{" "}
                      at{" "}
                      {formatTimePH(movement.createdAt)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                        getMovementBadgeClass(movement.type)
                      )}
                    >
                      {getMovementTypeLabel(movement.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{movement.productName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {movement.productSku}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{movement.locationName}</td>
                  <td
                    className={cn(
                      "px-6 py-4 text-sm font-semibold",
                      movement.quantityChange < 0 ? "text-destructive" : "text-[#11664b]"
                    )}
                  >
                    {formatSignedQuantity(movement.quantityChange)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {movement.performedByName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <h3 className="text-lg font-semibold text-slate-900">No recent activity yet</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Inventory receipts, transfers, sales fulfillment, and adjustments will appear here.
          </p>
        </div>
      )}

      <div className="border-t border-slate-200/80 px-6 py-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-[#16304f]"
          href="/dashboard/inventory"
        >
          View all inventory
          <ArrowRight className="size-4" strokeWidth={2.2} />
        </Link>
      </div>
    </section>
  );
}
