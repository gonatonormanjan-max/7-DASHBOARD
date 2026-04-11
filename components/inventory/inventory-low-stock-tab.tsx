import Link from "next/link";
import { cn } from "@/lib/utils";
import type { InventoryStockRow } from "@/lib/dal/inventory";

type InventoryLowStockTabProps = {
  lowStockRows: InventoryStockRow[];
};

export function InventoryLowStockTab({ lowStockRows }: InventoryLowStockTabProps) {
  if (lowStockRows.length === 0) {
    return (
      <div className="rounded-lg border border-[#c5e7db] bg-[#edf8f4] px-6 py-12">
        <h2 className="text-lg font-semibold text-slate-950">No low-stock alerts</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Every visible stock row is currently above its reorder level.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/70">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <th className="px-5 py-4">Product</th>
              <th className="px-5 py-4">SKU</th>
              <th className="px-5 py-4">On Hand</th>
              <th className="px-5 py-4">Reserved</th>
              <th className="px-5 py-4">Available</th>
              <th className="px-5 py-4">Reorder Level</th>
              <th className="px-5 py-4">Shortage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {lowStockRows.map((row) => {
              const isOutOfStock = row.availableQty <= 0;
              const shortage = Math.max(row.product.reorderLevel - row.availableQty, 0);

              return (
                <tr
                  key={row.id}
                  className={cn("align-top", isOutOfStock ? "bg-red-50/60" : "bg-amber-50/60")}
                >
                  <td className="px-5 py-4">
                    <Link
                      className="font-semibold text-slate-950 transition hover:text-primary"
                      href={`/dashboard/products/${row.product.id}`}
                    >
                      {row.product.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{row.product.sku}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">
                    {row.quantity.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.reservedQty.toLocaleString("en-US")}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-4 text-sm font-semibold",
                      isOutOfStock ? "text-destructive" : "text-[#8a5610]"
                    )}
                  >
                    {row.availableQty.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.product.reorderLevel.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-destructive">
                    {shortage.toLocaleString("en-US")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
