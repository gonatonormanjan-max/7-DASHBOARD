import type { SalesOrderStatus } from "@prisma/client";
import {
  formatSalesOrderStatus,
  getSalesOrderStatusBadgeClass,
} from "@/lib/sales-orders";
import { cn } from "@/lib/utils";

export function SalesOrderStatusBadge({
  status,
}: {
  status: SalesOrderStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        getSalesOrderStatusBadgeClass(status)
      )}
    >
      {formatSalesOrderStatus(status)}
    </span>
  );
}
