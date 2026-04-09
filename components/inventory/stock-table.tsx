import Link from "next/link";
import { getAvailableQuantity } from "@/lib/inventory";

type StockRow = {
  id: string;
  quantity: number;
  reservedQty: number;
  updatedAt: Date;
  location: {
    id: string;
    name: string;
    code: string;
    type: string;
    isActive: boolean;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    reorderLevel: number;
    category: {
      id: string;
      name: string;
    };
    brand: {
      id: string;
      name: string;
    } | null;
  };
};

type InventoryStockTableProps = {
  stockRows: StockRow[];
};

export function InventoryStockTable({ stockRows }: InventoryStockTableProps) {
  if (stockRows.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/65 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No stock rows found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Adjust your filters, create warehouse stock through an adjustment, or transfer inventory
          into a location to start tracking rows here.
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
              <th className="px-5 py-4">Product</th>
              <th className="px-5 py-4">Location</th>
              <th className="px-5 py-4">On hand</th>
              <th className="px-5 py-4">Reserved</th>
              <th className="px-5 py-4">Available</th>
              <th className="px-5 py-4">Reorder</th>
              <th className="px-5 py-4">Supplier</th>
              <th className="px-5 py-4">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {stockRows.map((row) => {
              const availableQty = getAvailableQuantity(row.quantity, row.reservedQty);
              const isLowStock =
                row.product.reorderLevel > 0 && availableQty <= row.product.reorderLevel;

              return (
                <tr key={row.id} className="align-top">
                  <td className="px-5 py-4">
                    <Link
                      className="font-semibold text-slate-950 transition hover:text-primary"
                      href={`/dashboard/products/${row.product.id}`}
                    >
                      {row.product.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">
                      {row.product.sku} · {row.product.category.name}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.location.name}
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {row.location.code}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {row.location.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-700">
                    {row.quantity.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.reservedQty.toLocaleString("en-US")}
                  </td>
                  <td
                    className={`px-5 py-4 text-sm font-medium ${
                      availableQty <= 0
                        ? "text-destructive"
                        : isLowStock
                          ? "text-[#8a5610]"
                          : "text-[#11664b]"
                    }`}
                  >
                    {availableQty.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.product.reorderLevel.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.product.brand?.name ?? "Unbranded"}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {row.updatedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
