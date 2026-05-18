import type { CashOutTransactionStatus } from "@prisma/client";
import {
  formatCashOutStatus,
  getCashOutStatusBadgeClass,
} from "@/lib/cash-out";
import { cn } from "@/lib/utils";

export function CashOutStatusBadge({
  status,
}: {
  status: CashOutTransactionStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        getCashOutStatusBadgeClass(status)
      )}
    >
      {formatCashOutStatus(status)}
    </span>
  );
}
