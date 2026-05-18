import { VaultTransactionType } from "@prisma/client";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<VaultTransactionType, string> = {
  [VaultTransactionType.SALE]: "Sale",
  [VaultTransactionType.VOID_REVERSAL]: "Void reversal",
  [VaultTransactionType.CASH_DROP]: "Cash drop",
  [VaultTransactionType.OPENING_FLOAT]: "Opening float",
  [VaultTransactionType.MANUAL_ADJUSTMENT]: "Manual adj.",
  [VaultTransactionType.CASH_OUT_PAYOUT]: "Cash out",
  [VaultTransactionType.CASH_OUT_VOID_REVERSAL]: "Cash-out reversal",
};

// Uses the existing theme token palette so colors stay consistent with the
// rest of the dashboard's status badges.
const TYPE_CLASSES: Record<VaultTransactionType, string> = {
  [VaultTransactionType.SALE]:
    "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]",
  [VaultTransactionType.VOID_REVERSAL]:
    "border-red-200 bg-red-50 text-red-700",
  [VaultTransactionType.CASH_DROP]:
    "border-amber-200 bg-amber-50 text-amber-800",
  [VaultTransactionType.OPENING_FLOAT]:
    "border-blue-200 bg-blue-50 text-blue-700",
  [VaultTransactionType.MANUAL_ADJUSTMENT]:
    "border-slate-200 bg-slate-50 text-slate-700",
  [VaultTransactionType.CASH_OUT_PAYOUT]:
    "border-[#f2d2a2] bg-[#fff4e4] text-[#8a5610]",
  [VaultTransactionType.CASH_OUT_VOID_REVERSAL]:
    "border-red-200 bg-red-50 text-red-700",
};

export function VaultTypePill({ type }: { type: VaultTransactionType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        TYPE_CLASSES[type]
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

export function formatVaultTypeLabel(type: VaultTransactionType) {
  return TYPE_LABELS[type];
}
