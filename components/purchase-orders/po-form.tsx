"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  initialPurchaseOrderFormState,
  type PurchaseOrderFormState,
} from "@/lib/validators/purchase-orders";
import {
  initialInlineSupplierState,
  type InlineSupplierState,
} from "@/lib/validators/suppliers";
import { createInlineSupplierAction } from "@/lib/actions/suppliers";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type SupplierOption = {
  id: string;
  name: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  costPrice: string;
};

type SupplierProductLink = {
  supplierId: string;
  productId: string;
  costPrice: string;
};

type PurchaseOrderRow = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
};

type PurchaseOrderFormProps = {
  action: (
    state: PurchaseOrderFormState,
    formData: FormData
  ) => Promise<PurchaseOrderFormState>;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  products: ProductOption[];
  supplierProductLinks: SupplierProductLink[];
};

function mergeSupplierOptions(
  baseSuppliers: SupplierOption[],
  inlineSuppliers: SupplierOption[]
) {
  const merged = new Map<string, SupplierOption>();

  for (const supplier of baseSuppliers) {
    merged.set(supplier.id, supplier);
  }

  for (const supplier of inlineSuppliers) {
    if (!merged.has(supplier.id)) {
      merged.set(supplier.id, supplier);
    }
  }

  return [...merged.values()];
}

function createRow(id: string, overrides: Partial<PurchaseOrderRow> = {}): PurchaseOrderRow {
  return {
    id,
    productId: "",
    quantity: "1",
    unitCost: "0.00",
    ...overrides,
  };
}

function parseAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PurchaseOrderForm({
  action,
  suppliers,
  warehouses,
  products,
  supplierProductLinks,
}: PurchaseOrderFormProps) {
  const [state, formAction] = useActionState(action, initialPurchaseOrderFormState);
  const [inlineSupplierState, inlineSupplierAction] = useActionState<InlineSupplierState, FormData>(
    createInlineSupplierAction,
    initialInlineSupplierState
  );

  const [nextRowId, setNextRowId] = useState(2);
  const [supplierId, setSupplierId] = useState(state.values?.supplierId ?? "");
  const [locationId, setLocationId] = useState(state.values?.locationId ?? "");
  const [expectedDate, setExpectedDate] = useState(state.values?.expectedDate ?? "");
  const [notes, setNotes] = useState(state.values?.notes ?? "");
  const [rows, setRows] = useState<PurchaseOrderRow[]>([createRow("row-1")]);

  // Quick-create supplier modal state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [extraSuppliers, setExtraSuppliers] = useState<SupplierOption[]>([]);
  const processedInlineIdRef = useRef<string | null>(null);

  const syncCreatedSupplier = useEffectEvent((newSupplier: SupplierOption) => {
    if (processedInlineIdRef.current === newSupplier.id) {
      return;
    }

    processedInlineIdRef.current = newSupplier.id;
    setExtraSuppliers((prev) =>
      prev.some((supplier) => supplier.id === newSupplier.id)
        ? prev
        : [...prev, newSupplier]
    );
    setSupplierId(newSupplier.id);
    setIsSupplierModalOpen(false);
  });

  // Watch for successful inline supplier creation.
  useEffect(() => {
    if (inlineSupplierState.status === "success" && inlineSupplierState.createdSupplier) {
      syncCreatedSupplier(inlineSupplierState.createdSupplier);
    }
  }, [inlineSupplierState.createdSupplier, inlineSupplierState.status]);

  const allSuppliers = useMemo(
    () => mergeSupplierOptions(suppliers, extraSuppliers),
    [suppliers, extraSuppliers]
  );

  // Filter products for the search - show ALL products regardless of supplier
  // Cost is auto-populated from supplier link if one exists, else product default
  const isReady = allSuppliers.length > 0 && warehouses.length > 0 && products.length > 0;
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});

  const serializedItems = JSON.stringify(
    rows
      .filter((row) => row.productId)
      .map((row) => ({
        productId: row.productId,
        quantity: parseAmount(row.quantity),
        unitCost: parseAmount(row.unitCost),
      }))
  );

  const runningTotal = rows.reduce(
    (sum, row) => sum + parseAmount(row.quantity) * parseAmount(row.unitCost),
    0
  );

  function getCostForProduct(productId: string, currentSupplierId: string) {
    const link = supplierProductLinks.find(
      (l) => l.supplierId === currentSupplierId && l.productId === productId
    );
    const product = products.find((p) => p.id === productId);
    return link?.costPrice ?? product?.costPrice ?? "0.00";
  }

  return (
    <>
      <form action={formAction} className="space-y-6">
        <input name="itemsPayload" type="hidden" value={serializedItems} />

        {state.message ? (
          <div className="rounded-2xl border border-[#f2d2a2] bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
            {state.message}
          </div>
        ) : null}

        <div className="grid gap-6 rounded-lg border border-border bg-card p-6 shadow-sm lg:grid-cols-2">
          {/* Supplier field with Quick Add button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Supplier</span>
              <button
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setIsSupplierModalOpen(true)}
                type="button"
              >
                + Add new supplier
              </button>
            </div>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="supplierId"
              onChange={(event) => {
                const nextSupplierId = event.target.value;
                setSupplierId(nextSupplierId);
                setRows((currentRows) =>
                  currentRows.map((row) => {
                    if (!row.productId) return row;
                    return {
                      ...row,
                      unitCost: getCostForProduct(row.productId, nextSupplierId),
                    };
                  })
                );
              }}
              value={supplierId}
            >
              <option value="">Select a supplier</option>
              {allSuppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.supplierId ? (
              <p className="text-sm text-destructive">{state.fieldErrors.supplierId[0]}</p>
            ) : null}
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Warehouse</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="locationId"
              onChange={(event) => setLocationId(event.target.value)}
              value={locationId}
            >
              <option value="">Select a warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            {state.fieldErrors?.locationId ? (
              <p className="text-sm text-destructive">{state.fieldErrors.locationId[0]}</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Expected date</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="expectedDate"
              onChange={(event) => setExpectedDate(event.target.value)}
              type="date"
              value={expectedDate}
            />
            {state.fieldErrors?.expectedDate ? (
              <p className="text-sm text-destructive">{state.fieldErrors.expectedDate[0]}</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Delivery window, supplier remarks, or receiving context."
              value={notes}
            />
            {state.fieldErrors?.notes ? (
              <p className="text-sm text-destructive">{state.fieldErrors.notes[0]}</p>
            ) : null}
          </label>
        </div>

        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Line items</h2>
              <p className="text-sm leading-6 text-slate-500">
                Add products to this order. Select a supplier first to auto-fill known costs.
              </p>
            </div>
            <Button
              disabled={!isReady || supplierId.length === 0}
              onClick={() => {
                setRows((current) => [...current, createRow(`row-${nextRowId}`)]);
                setNextRowId((current) => current + 1);
              }}
              type="button"
              variant="outline"
            >
              Add item
            </Button>
          </div>

          {!isReady ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm text-slate-500">
              Purchase orders need at least one active supplier, warehouse, and product.
            </div>
          ) : supplierId.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm text-slate-500">
              Select a supplier above to begin adding line items.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {rows.map((row, index) => {
                const selectedProductIds = rows
                  .filter((candidate) => candidate.id !== row.id && candidate.productId)
                  .map((candidate) => candidate.productId);

                const search = productSearch[row.id] ?? "";
                const filteredProducts = products.filter((product) => {
                  const isNotTakenElsewhere =
                    product.id === row.productId ||
                    !selectedProductIds.includes(product.id);
                  if (!search.trim()) return isNotTakenElsewhere;
                  const q = search.toLowerCase();
                  return (
                    isNotTakenElsewhere &&
                    (product.name.toLowerCase().includes(q) ||
                      product.sku.toLowerCase().includes(q))
                  );
                });

                const selectedProduct = products.find((p) => p.id === row.productId);
                const subtotal = parseAmount(row.quantity) * parseAmount(row.unitCost);

                return (
                  <div
                    key={row.id}
                    className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_150px_170px_150px_auto]">
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Product</span>
                        {/* Searchable product picker */}
                        <input
                          className="w-full rounded-t-2xl border border-b-0 border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-1 focus-visible:ring-ring/30"
                          onChange={(e) =>
                            setProductSearch((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                          placeholder={
                            selectedProduct
                              ? `${selectedProduct.name} (${selectedProduct.sku})`
                              : "Search by name or SKU..."
                          }
                          type="text"
                          value={search}
                        />
                        <select
                          className="w-full rounded-b-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                          onChange={(event) => {
                            const nextProductId = event.target.value;
                            setProductSearch((prev) => ({ ...prev, [row.id]: "" }));
                            setRows((current) =>
                              current.map((candidate) =>
                                candidate.id === row.id
                                  ? {
                                      ...candidate,
                                      productId: nextProductId,
                                      unitCost: nextProductId
                                        ? getCostForProduct(nextProductId, supplierId)
                                        : "0.00",
                                    }
                                  : candidate
                              )
                            );
                          }}
                          value={row.productId}
                        >
                          <option value="">
                            {search
                              ? `${filteredProducts.length} result${filteredProducts.length !== 1 ? "s" : ""}`
                              : "Select a product"}
                          </option>
                          {filteredProducts.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} - {product.sku}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Quantity</span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                          min="1"
                          onChange={(event) => {
                            setRows((current) =>
                              current.map((candidate) =>
                                candidate.id === row.id
                                  ? { ...candidate, quantity: event.target.value }
                                  : candidate
                              )
                            );
                          }}
                          step="1"
                          type="number"
                          value={row.quantity}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Unit cost</span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                          min="0"
                          onChange={(event) => {
                            setRows((current) =>
                              current.map((candidate) =>
                                candidate.id === row.id
                                  ? { ...candidate, unitCost: event.target.value }
                                  : candidate
                              )
                            );
                          }}
                          step="0.01"
                          type="number"
                          value={row.unitCost}
                        />
                      </label>

                      <div className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Subtotal</span>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">
                          {formatCurrency(subtotal)}
                        </div>
                      </div>

                      <div className="flex items-end justify-end">
                        <Button
                          className="text-slate-600"
                          onClick={() => {
                            setProductSearch((prev) => {
                              const next = { ...prev };
                              delete next[row.id];
                              return next;
                            });
                            setRows((current) =>
                              current.length === 1
                                ? [createRow("row-1")]
                                : current.filter((candidate) => candidate.id !== row.id)
                            );
                          }}
                          type="button"
                          variant="ghost"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {state.itemErrors?.[index] ? (
                      <p className="mt-3 text-sm text-destructive">
                        {state.itemErrors[index]}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {state.fieldErrors?.items ? (
            <p className="mt-4 text-sm text-destructive">{state.fieldErrors.items[0]}</p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Warehouse selection is captured during the receiving workflow.
            </p>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Estimated total
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {formatCurrency(runningTotal)}
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link href="/dashboard/purchase-orders">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <SubmitButton disabled={!isReady} pendingLabel="Saving draft...">
            Save as Draft
          </SubmitButton>
        </div>
      </form>

      {/* Quick-create supplier modal */}
      {isSupplierModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsSupplierModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Add new supplier</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Quick-add a supplier to use immediately. Edit full details later.
                </p>
              </div>
              <button
                className="ml-4 mt-0.5 text-slate-400 hover:text-slate-600"
                onClick={() => setIsSupplierModalOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            {inlineSupplierState.message &&
            inlineSupplierState.status === "error" ? (
              <div className="mb-4 rounded-2xl border border-[#f2d2a2] bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
                {inlineSupplierState.message}
              </div>
            ) : null}

            <form action={inlineSupplierAction} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Supplier name <span className="text-destructive">*</span>
                </span>
                <input
                  autoFocus
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                  defaultValue={inlineSupplierState.values?.name ?? ""}
                  name="name"
                  placeholder="e.g. Metro Supplies Corp."
                  type="text"
                />
                {inlineSupplierState.fieldErrors?.name ? (
                  <p className="text-sm text-destructive">
                    {inlineSupplierState.fieldErrors.name[0]}
                  </p>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Contact name</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                  defaultValue={inlineSupplierState.values?.contactName ?? ""}
                  name="contactName"
                  placeholder="Primary contact person"
                  type="text"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                  defaultValue={inlineSupplierState.values?.email ?? ""}
                  name="email"
                  placeholder="supplier@example.com"
                  type="email"
                />
                {inlineSupplierState.fieldErrors?.email ? (
                  <p className="text-sm text-destructive">
                    {inlineSupplierState.fieldErrors.email[0]}
                  </p>
                ) : null}
              </label>

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => setIsSupplierModalOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <SubmitButton className="flex-1" pendingLabel="Creating...">
                  Create Supplier
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

