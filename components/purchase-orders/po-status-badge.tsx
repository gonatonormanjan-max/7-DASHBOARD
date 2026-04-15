import type { PurchaseOrderStatus } from "@prisma/client";
import {
  formatPurchaseOrderStatus,
  getPurchaseOrderStatusBadgeClass,
} from "@/lib/purchase-orders";
import { cn } from "@/lib/utils";

export function PurchaseOrderStatusBadge({
  status,
}: {
  status: PurchaseOrderStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        getPurchaseOrderStatusBadgeClass(status)
      )}
    >
      {formatPurchaseOrderStatus(status)}
    </span>
  );
}
