"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  initialPurchaseOrderFormState,
  type PurchaseOrderFormState,
} from "@/lib/validators/purchase-orders";
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
  const [nextRowId, setNextRowId] = useState(2);
  const [supplierId, setSupplierId] = useState(state.values?.supplierId ?? "");
  const [locationId, setLocationId] = useState(state.values?.locationId ?? "");
  const [expectedDate, setExpectedDate] = useState(state.values?.expectedDate ?? "");
  const [notes, setNotes] = useState(state.values?.notes ?? "");
  const [rows, setRows] = useState<PurchaseOrderRow[]>([createRow("row-1")]);

  const isReady = suppliers.length > 0 && warehouses.length > 0 && products.length > 0;
  const linkedProductIds = useMemo(
    () =>
      new Set(
        supplierProductLinks
          .filter((link) => link.supplierId === supplierId)
          .map((link) => link.productId)
      ),
    [supplierId, supplierProductLinks]
  );
  const supplierProducts = products.filter((product) => linkedProductIds.has(product.id));
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

  return (
    <form action={formAction} className="space-y-6">
      <input name="itemsPayload" type="hidden" value={serializedItems} />

      {state.message ? (
        <div className="rounded-2xl border border-[#f2d2a2] bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)] lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Supplier</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            name="supplierId"
            onChange={(event) => {
              const nextSupplierId = event.target.value;

              setSupplierId(nextSupplierId);
              setRows((currentRows) =>
                currentRows.map((row) => {
                  if (!row.productId) {
                    return row;
                  }

                  const matchingLink = supplierProductLinks.find(
                    (link) =>
                      link.supplierId === nextSupplierId && link.productId === row.productId
                  );

                  return matchingLink
                    ? { ...row, unitCost: matchingLink.costPrice }
                    : { ...row, productId: "", unitCost: "0.00" };
                })
              );
            }}
            value={supplierId}
          >
            <option value="">Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.supplierId ? (
            <p className="text-sm text-destructive">{state.fieldErrors.supplierId[0]}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Warehouse</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
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
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
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
            className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
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

      <section className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Line items</h2>
            <p className="text-sm leading-6 text-slate-500">
              Add products from the chosen supplier and capture the unit cost you expect to receive.
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
        ) : (
          <div className="mt-6 space-y-4">
            {rows.map((row, index) => {
              const selectedProductIds = rows
                .filter((candidate) => candidate.id !== row.id && candidate.productId)
                .map((candidate) => candidate.productId);
              const availableProducts = supplierProducts.filter(
                (product) =>
                  product.id === row.productId || !selectedProductIds.includes(product.id)
              );
              const subtotal = parseAmount(row.quantity) * parseAmount(row.unitCost);

              return (
                <div
                  key={row.id}
                  className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_150px_170px_150px_auto]">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Product</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
                        onChange={(event) => {
                          const nextProductId = event.target.value;
                          const supplierLink = supplierProductLinks.find(
                            (link) =>
                              link.supplierId === supplierId && link.productId === nextProductId
                          );
                          const product = products.find((item) => item.id === nextProductId);

                          setRows((current) =>
                            current.map((candidate) =>
                              candidate.id === row.id
                                ? {
                                    ...candidate,
                                    productId: nextProductId,
                                    unitCost:
                                      supplierLink?.costPrice ?? product?.costPrice ?? "0.00",
                                  }
                                : candidate
                            )
                          );
                        }}
                        value={row.productId}
                      >
                        <option value="">Select a product</option>
                        {availableProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Quantity</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
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
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
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
                    <p className="mt-3 text-sm text-destructive">{state.itemErrors[index]}</p>
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
            Warehouse selection is captured with the transaction context and receiving workflow.
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
  );
}
