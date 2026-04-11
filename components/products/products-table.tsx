import Link from "next/link";
import type { ProductStatus } from "@prisma/client";
import {
  archiveProductAction,
  deactivateProductAction,
  restoreProductAction,
} from "@/lib/actions/products";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { ProductStatusBadge } from "@/components/products/product-status-badge";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  unitPrice: { toString(): string };
  costPrice: { toString(): string };
  status: ProductStatus;
  updatedAt: Date;
  locationStock: {
    quantity: number;
  }[];
  category: {
    id: string;
    name: string;
  };
  brand: {
    id: string;
    name: string;
  } | null;
};

type ProductsTableProps = {
  products: ProductRow[];
  canManage: boolean;
  canViewCost: boolean;
  returnTo: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  buildSortHref: (field: string) => string;
};

function SortHeader({
  field,
  label,
  sortBy,
  sortOrder,
  buildSortHref,
}: {
  field: string;
  label: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  buildSortHref: (field: string) => string;
}) {
  const indicator =
    sortBy === field ? (sortOrder === "asc" ? "↑" : "↓") : "↕";

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

export function ProductsTable({
  products,
  canManage,
  canViewCost,
  returnTo,
  sortBy,
  sortOrder,
  buildSortHref,
}: ProductsTableProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No products found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Try adjusting your filters or create a new product to start building the shared catalog.
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
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="name"
                  label="Product"
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
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Supplier</th>
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="unitPrice"
                  label="Unit Price"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              {canViewCost ? <th className="px-5 py-4">Cost</th> : null}
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="status"
                  label="Status"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4">Stock</th>
              <th className="px-5 py-4">
                <SortHeader
                  buildSortHref={buildSortHref}
                  field="updatedAt"
                  label="Updated"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              </th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {products.map((product) => {
              const archiveAction = archiveProductAction.bind(null, product.id, returnTo);
              const deactivateAction = deactivateProductAction.bind(null, product.id, returnTo);
              const restoreAction = restoreProductAction.bind(null, product.id, returnTo);
              const totalStock = product.locationStock.reduce(
                (sum, location) => sum + location.quantity,
                0
              );

              return (
                <tr key={product.id} className="align-top">
                  <td className="px-5 py-4">
                    <Link
                      className="font-semibold text-slate-950 transition hover:text-primary"
                      href={`/dashboard/products/${product.id}`}
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{product.sku}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{product.category.name}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {product.brand?.name ?? "Unbranded"}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {formatCurrency(product.unitPrice.toString())}
                  </td>
                  {canViewCost ? (
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatCurrency(product.costPrice.toString())}
                    </td>
                  ) : null}
                  <td className="px-5 py-4">
                    <ProductStatusBadge status={product.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {totalStock.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {product.updatedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      {!canManage ? (
                        <Link href={`/dashboard/products/${product.id}`}>
                          <Button variant="outline">View</Button>
                        </Link>
                      ) : (
                        <>
                          {product.status !== "ARCHIVED" ? (
                            <Link href={`/dashboard/products/${product.id}/edit`}>
                              <Button variant="outline">Edit</Button>
                            </Link>
                          ) : null}

                          <details className="relative inline-block">
                            <summary className="cursor-pointer list-none rounded-2xl border border-slate-200 bg-card px-3 py-2 text-sm font-semibold text-slate-600 transition select-none hover:bg-slate-50">
                              ...
                            </summary>
                            <div className="absolute right-0 z-10 mt-1 w-44 rounded-2xl border border-slate-200 bg-card py-1 shadow-lg">
                              {product.status === "ACTIVE" ? (
                                <form action={deactivateAction}>
                                  <ConfirmSubmitButton
                                    className="w-full justify-start rounded-none border-0 bg-transparent px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                    confirmMessage={`Deactivate ${product.name}?`}
                                    pendingLabel="Deactivating..."
                                    variant="ghost"
                                  >
                                    Deactivate
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}

                              {product.status !== "ARCHIVED" ? (
                                <form action={archiveAction}>
                                  <ConfirmSubmitButton
                                    className="w-full justify-start rounded-none border-0 bg-transparent px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                    confirmMessage={`Archive ${product.name}? Archived products stay hidden from default lists.`}
                                    pendingLabel="Archiving..."
                                    variant="ghost"
                                  >
                                    Archive
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}

                              {product.status === "ARCHIVED" ? (
                                <form action={restoreAction}>
                                  <ConfirmSubmitButton
                                    className="w-full justify-start rounded-none border-0 bg-transparent px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                    confirmMessage={`Restore ${product.name} to Active status?`}
                                    pendingLabel="Restoring..."
                                    variant="ghost"
                                  >
                                    Restore
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                            </div>
                          </details>
                        </>
                      )}
                    </div>
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
