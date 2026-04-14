import Link from "next/link";
import type { MovementType } from "@prisma/client";
import { formatSignedQuantity, getMovementTypeLabel } from "@/lib/inventory";
import { formatDatePH, formatTimePH } from "@/lib/timezone";

type MovementRow = {
  id: string;
  type: MovementType;
  quantityChange: number;
  notes: string | null;
  createdAt: Date;
  location: {
    id: string;
    name: string;
    code: string;
  };
  product: {
    id: string;
    name: string;
    sku: string;
  };
  performedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type InventoryMovementTableProps = {
  movements: MovementRow[];
};

export function InventoryMovementTable({ movements }: InventoryMovementTableProps) {
  if (movements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No movement records found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Expand the filters or record a stock adjustment or transfer to populate the ledger.
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
              <th className="px-5 py-4">When</th>
              <th className="px-5 py-4">Product</th>
              <th className="px-5 py-4">Location</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Change</th>
              <th className="px-5 py-4">Performed by</th>
              <th className="px-5 py-4">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {movements.map((movement) => (
              <tr key={movement.id} className="align-top">
                <td className="px-5 py-4 text-sm text-slate-500">
                  {formatDatePH(movement.createdAt)}
                  <p className="mt-1 text-xs text-slate-400">
                    {formatTimePH(movement.createdAt)}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <Link
                    className="font-semibold text-slate-950 transition hover:text-primary"
                    href={`/dashboard/products/${movement.product.id}`}
                  >
                    {movement.product.name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">{movement.product.sku}</p>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {movement.location.name}
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {movement.location.code}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {getMovementTypeLabel(movement.type)}
                </td>
                <td
                  className={`px-5 py-4 text-sm font-medium ${
                    movement.quantityChange < 0 ? "text-destructive" : "text-[#11664b]"
                  }`}
                >
                  {formatSignedQuantity(movement.quantityChange)}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {movement.performedBy.firstName} {movement.performedBy.lastName}
                </td>
                <td className="px-5 py-4 text-sm leading-6 text-slate-500">
                  {movement.notes ?? "No notes provided."}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
