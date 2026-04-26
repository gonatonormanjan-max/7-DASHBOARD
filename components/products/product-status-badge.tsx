import type { ProductStatus } from "@prisma/client";
import { PRODUCT_STATUS_LABELS } from "@/lib/products";
import { cn } from "@/lib/utils";

const statusClasses: Record<ProductStatus, string> = {
  ACTIVE: "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]",
  INACTIVE: "border-[#f2d2a2] bg-[#fff4e4] text-[#8a5610]",
  ARCHIVED: "border-slate-200 bg-slate-100 text-slate-600",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        statusClasses[status]
      )}
    >
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}
