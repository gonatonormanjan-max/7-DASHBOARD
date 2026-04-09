import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatSignedQuantity, getMovementTypeLabel } from "@/lib/inventory";
import type { InventoryMovementRow } from "@/lib/dal/inventory";

type InventoryMovementsTabProps = {
  movements: InventoryMovementRow[];
  showLocation?: boolean;
};

function getMovementBadgeClass(type: InventoryMovementRow["type"]) {
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

export function InventoryMovementsTab({
  movements,
  showLocation = false,
}: InventoryMovementsTabProps) {
  if (movements.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/65 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No movement records found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Record adjustments, transfers, receipts, or sales-linked movement to populate the ledger.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/85 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/70">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <th className="px-5 py-4">Date / Time</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Product</th>
              <th className="px-5 py-4">SKU</th>
              <th className="px-5 py-4">Qty Change</th>
              {showLocation ? <th className="px-5 py-4">Location</th> : null}
              <th className="px-5 py-4">Performed By</th>
              <th className="px-5 py-4">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {movements.map((movement) => (
              <tr key={movement.id} className="align-top">
                <td className="px-5 py-4 text-sm text-slate-500">
                  {movement.createdAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  <p className="mt-1 text-xs text-slate-400">
                    {movement.createdAt.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                      getMovementBadgeClass(movement.type)
                    )}
                  >
                    {getMovementTypeLabel(movement.type)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <Link
                    className="font-semibold text-slate-950 transition hover:text-primary"
                    href={`/dashboard/products/${movement.product.id}`}
                  >
                    {movement.product.name}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{movement.product.sku}</td>
                <td
                  className={cn(
                    "px-5 py-4 text-sm font-semibold",
                    movement.quantityChange < 0 ? "text-destructive" : "text-[#11664b]"
                  )}
                >
                  {formatSignedQuantity(movement.quantityChange)}
                </td>
                {showLocation ? (
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {movement.location.name}
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {movement.location.code}
                    </p>
                  </td>
                ) : null}
                <td className="px-5 py-4 text-sm text-slate-600">
                  {movement.performedBy.firstName} {movement.performedBy.lastName}
                </td>
                <td className="px-5 py-4 text-sm leading-6 text-slate-500">
                  <p className="max-w-[22rem] truncate">
                    {movement.notes?.trim() ? movement.notes : "No notes provided."}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
