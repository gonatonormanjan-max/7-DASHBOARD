"use client";

import { useActionState, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { StockSetupProduct } from "@/lib/dal/inventory";
import {
  initialBulkStockSetupState,
  type BulkStockSetupState,
} from "@/lib/validators/inventory";
import { SubmitButton } from "@/components/ui/submit-button";

type BulkStockSetupFormProps = {
  action: (
    state: BulkStockSetupState,
    formData: FormData
  ) => Promise<BulkStockSetupState>;
  products: StockSetupProduct[];
  locationId: string;
  locationName: string;
};

const REASON_OPTIONS = [
  { value: "new_branch_setup", label: "New Branch Setup" },
  { value: "warehouse_migration", label: "Warehouse Migration" },
  { value: "system_import", label: "System Import" },
  { value: "other", label: "Other" },
] as const;

export function BulkStockSetupForm({
  action,
  products,
  locationId,
  locationName,
}: BulkStockSetupFormProps) {
  const [state, formAction] = useActionState(action, initialBulkStockSetupState);
  const [searchQuery, setSearchQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    // Pre-fill with current quantities from the server
    const initial: Record<string, string> = {};
    for (const product of products) {
      initial[product.id] = String(product.currentQty);
    }
    return initial;
  });

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  const changedCount = useMemo(() => {
    let count = 0;
    for (const product of products) {
      const newQty = Number(quantities[product.id] ?? "0") || 0;
      if (newQty !== product.currentQty) {
        count++;
      }
    }
    return count;
  }, [products, quantities]);

  function handleQuantityChange(productId: string, value: string) {
    setQuantities((prev) => ({
      ...prev,
      [productId]: value,
    }));
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden location field */}
      <input type="hidden" name="locationId" value={locationId} />

      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      {/* Reason + Notes section */}
      <div className="grid gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Reason</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={state.values?.reason ?? ""}
              name="reason"
            >
              <option value="">Select a reason</option>
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.reason ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.reason[0]}
              </p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Notes <span className="text-slate-400">(optional)</span>
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={state.values?.notes ?? ""}
              maxLength={500}
              name="notes"
              placeholder="e.g. Initial stock for Cebu branch opening"
            />
            {state.fieldErrors?.notes ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.notes[0]}
              </p>
            ) : null}
          </label>
        </div>
      </div>

      {/* Product table */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        {/* Search bar */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                strokeWidth={2.1}
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, SKU, category, or brand..."
                type="text"
                value={searchQuery}
              />
            </div>
            <div className="shrink-0 text-sm text-slate-500">
              {filteredProducts.length} of {products.length} products
            </div>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_120px_100px_120px] items-center gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span>Product</span>
          <span className="text-right">Current Qty</span>
          <span className="text-center">Change</span>
          <span className="text-right">New Qty</span>
        </div>

        {/* Table body */}
        <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              No products match your search.
            </div>
          ) : (
            filteredProducts.map((product, index) => {
              const newQty = Number(quantities[product.id] ?? "0") || 0;
              const diff = newQty - product.currentQty;
              const hasChanged = diff !== 0;

              return (
                <div
                  className={`grid grid-cols-[1fr_120px_100px_120px] items-center gap-4 px-6 py-3 transition ${hasChanged ? "bg-blue-50/50" : "bg-white"}`}
                  key={product.id}
                >
                  {/* Hidden form fields */}
                  <input
                    type="hidden"
                    name={`items[${index}].productId`}
                    value={product.id}
                  />
                  <input
                    type="hidden"
                    name={`items[${index}].quantity`}
                    value={quantities[product.id] ?? "0"}
                  />

                  {/* Product info */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {product.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">
                        {product.sku}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">
                        {product.category}
                      </span>
                      {product.brand ? (
                        <>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-500">
                            {product.brand}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Current quantity */}
                  <div className="text-right font-mono text-sm text-slate-600">
                    {product.currentQty.toLocaleString("en-US")}
                  </div>

                  {/* Change indicator */}
                  <div className="text-center">
                    {hasChanged ? (
                      <span
                        className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${
                          diff > 0
                            ? "bg-[#edf8f4] text-[#11664b]"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toLocaleString("en-US")}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* New quantity input */}
                  <div>
                    <input
                      className={`w-full rounded-xl border bg-slate-50 px-3 py-2 text-right font-mono text-sm outline-none transition focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 ${
                        hasChanged
                          ? "border-blue-300 bg-blue-50/30"
                          : "border-slate-200"
                      }`}
                      min={0}
                      onChange={(e) =>
                        handleQuantityChange(product.id, e.target.value)
                      }
                      type="number"
                      value={quantities[product.id] ?? "0"}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Table footer / summary */}
        {state.fieldErrors?.items ? (
          <div className="border-t border-slate-100 px-6 py-3">
            <p className="text-sm text-destructive">
              {state.fieldErrors.items[0]}
            </p>
          </div>
        ) : null}
      </div>

      {/* Submit bar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-6 py-4 shadow-sm">
        <p className="text-sm text-slate-600">
          {changedCount > 0 ? (
            <>
              <span className="font-semibold text-slate-900">
                {changedCount}
              </span>{" "}
              product{changedCount === 1 ? "" : "s"} will be updated at{" "}
              <span className="font-semibold text-slate-900">
                {locationName}
              </span>
            </>
          ) : (
            "Change quantities above to update stock levels."
          )}
        </p>
        <SubmitButton
          disabled={changedCount === 0}
          pendingLabel="Saving..."
        >
          Save Stock Setup
        </SubmitButton>
      </div>
    </form>
  );
}
