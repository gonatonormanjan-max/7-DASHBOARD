import Link from "next/link";
import { getAvailableQuantity } from "@/lib/inventory";

type LowStockRow = {
  id: string;
  quantity: number;
  reservedQty: number;
  location: {
    id: string;
    name: string;
    code: string;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    reorderLevel: number;
    brand: {
      id: string;
      name: string;
    } | null;
  };
};

type LowStockTableProps = {
  lowStockRows: LowStockRow[];
};

export function LowStockTable({ lowStockRows }: LowStockTableProps) {
  if (lowStockRows.length === 0) {
    return (
      <div className="rounded-[24px] border border-[#c5e7db] bg-[#edf8f4] px-6 py-12">
        <h2 className="text-lg font-semibold text-slate-950">No low-stock alerts</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Every visible stock row is currently above its reorder level.
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
              <th className="px-5 py-4">Warehouse</th>
              <th className="px-5 py-4">Available</th>
              <th className="px-5 py-4">Reorder level</th>
              <th className="px-5 py-4">Shortage</th>
              <th className="px-5 py-4">Supplier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {lowStockRows.map((row) => {
              const availableQty = getAvailableQuantity(row.quantity, row.reservedQty);
              const shortage = Math.max(row.product.reorderLevel - availableQty, 0);

              return (
                <tr key={row.id} className="align-top">
                  <td className="px-5 py-4">
                    <Link
                      className="font-semibold text-slate-950 transition hover:text-primary"
                      href={`/dashboard/products/${row.product.id}`}
                    >
                      {row.product.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">{row.product.sku}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.location.name}
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {row.location.code}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-[#8a5610]">
                    {availableQty.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.product.reorderLevel.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-destructive">
                    {shortage.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {row.product.brand?.name ?? "Unbranded"}
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
