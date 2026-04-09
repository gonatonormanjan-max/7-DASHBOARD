import Link from "next/link";
import { cn } from "@/lib/utils";
import type { InventoryStockRow } from "@/lib/dal/inventory";
import type { InventoryStockSortField } from "@/lib/validators/inventory";

type InventoryStockTabProps = {
  stockRows: InventoryStockRow[];
  sortBy: InventoryStockSortField;
  sortOrder: "asc" | "desc";
  buildSortHref: (field: InventoryStockSortField) => string;
};

function SortHeader({
  field,
  label,
  sortBy,
  sortOrder,
  buildSortHref,
}: {
  field: InventoryStockSortField;
  label: string;
  sortBy: InventoryStockSortField;
  sortOrder: "asc" | "desc";
  buildSortHref: (field: InventoryStockSortField) => string;
}) {
  const indicator =
    sortBy === field ? (sortOrder === "asc" ? "Asc" : "Desc") : "Sort";

  return (
    <Link
      className="inline-flex items-center gap-2 text-inherit transition hover:text-primary"
      href={buildSortHref(field)}
    >
      <span>{label}</span>
      <span className={sortBy === field ? "text-slate-700" : "text-slate-300"}>
        {indicator}
      </span>
    </Link>
  );
}

export function InventoryStockTab({
  stockRows,
  sortBy,
  sortOrder,
  buildSortHref,
}: InventoryStockTabProps) {
  if (stockRows.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/65 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No stock rows found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Try adjusting the current filters or record stock movement to populate this view.
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
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="name"
                  label="Product Name"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="sku"
                  label="SKU"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="category"
                  label="Category"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="brand"
                  label="Brand"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="quantity"
                  label="On Hand"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="reservedQty"
                  label="Reserved"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="availableQty"
                  label="Available"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="reorderLevel"
                  label="Reorder Level"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {stockRows.map((row) => {
              const isOutOfStock = row.availableQty <= 0;
              const isLowStock =
                !isOutOfStock &&
                row.product.reorderLevel > 0 &&
                row.availableQty <= row.product.reorderLevel;
              const statusLabel = isOutOfStock
                ? "Out of stock"
                : isLowStock
                  ? "Low stock"
                  : "Healthy";

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "align-top",
                    isOutOfStock
                      ? "bg-red-50/60"
                      : isLowStock
                        ? "bg-amber-50/60"
                        : ""
                  )}
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
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.product.category.name}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.product.brand?.name ?? "Unbranded"}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">
                    {row.quantity.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.reservedQty.toLocaleString("en-US")}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-4 text-sm font-semibold",
                      isOutOfStock
                        ? "text-destructive"
                        : isLowStock
                          ? "text-[#8a5610]"
                          : "text-[#11664b]"
                    )}
                  >
                    {row.availableQty.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.product.reorderLevel.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                        isOutOfStock
                          ? "border-red-200 bg-red-50 text-destructive"
                          : isLowStock
                            ? "border-amber-200 bg-amber-50 text-[#8a5610]"
                            : "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]"
                      )}
                    >
                      {statusLabel}
                    </span>
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
