"use client";

import { useActionState, useState } from "react";
import {
  initialSupplierReceiptState,
  type SupplierReceiptState,
} from "@/lib/validators/inventory";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type SupplierReceiptLine = {
  productId: string;
  quantity: string;
};

type SupplierReceiptFormProps = {
  action: (
    state: SupplierReceiptState,
    formData: FormData
  ) => Promise<SupplierReceiptState>;
  suppliers: Array<{
    id: string;
    name: string;
  }>;
  warehouses: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  allProducts: Array<{
    id: string;
    name: string;
    sku: string;
  }>;
  supplierProductLinks: Array<{
    supplierId: string;
    productId: string;
  }>;
};

function createEmptyLine(): SupplierReceiptLine {
  return {
    productId: "",
    quantity: "1",
  };
}

function itemFieldError(
  state: SupplierReceiptState,
  index: number,
  field: "productId" | "quantity"
) {
  return state.fieldErrors?.[`items.${index}.${field}`]?.[0];
}

export function SupplierReceiptForm({
  action,
  suppliers,
  warehouses,
  allProducts,
  supplierProductLinks,
}: SupplierReceiptFormProps) {
  const [state, formAction] = useActionState(action, initialSupplierReceiptState);
  const [supplierId, setSupplierId] = useState(state.values?.supplierId ?? "");
  const [locationId, setLocationId] = useState(state.values?.locationId ?? "");
  const [referenceNumber, setReferenceNumber] = useState(
    state.values?.referenceNumber ?? ""
  );
  const [notes, setNotes] = useState(state.values?.notes ?? "");
  const [items, setItems] = useState<SupplierReceiptLine[]>(
    state.values?.items.length ? state.values.items : [createEmptyLine()]
  );
  const isReady = suppliers.length > 0 && warehouses.length > 0 && allProducts.length > 0;
  const linkedProductIds = new Set(
    supplierProductLinks
      .filter((link) => link.supplierId === supplierId)
      .map((link) => link.productId)
  );
  const supplierProducts = allProducts.filter((product) => linkedProductIds.has(product.id));
  const selectedProductIds = new Set(
    items.map((item) => item.productId).filter((productId) => productId.length > 0)
  );
  const canAddLine =
    supplierId.length > 0 &&
    supplierProducts.length > 0 &&
    selectedProductIds.size < supplierProducts.length;

  function updateLine(index: number, nextLine: SupplierReceiptLine) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) => (itemIndex === index ? nextLine : item))
    );
  }

  function addLine() {
    setItems((currentItems) => [...currentItems, createEmptyLine()]);
  }

  function removeLine(index: number) {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return [createEmptyLine()];
      }

      return currentItems.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      {!isReady ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-500">
          Supplier receipts need at least one active supplier, one active warehouse, and one
          active or inactive product linked through supplier relationships.
        </div>
      ) : null}

      <div className="space-y-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Supplier receipt</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Receive stock from a supplier directly into an active warehouse while preserving a
            clear movement record for every line.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Supplier</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
              disabled={!isReady}
              name="supplierId"
              onChange={(event) => {
                const nextSupplierId = event.target.value;
                const nextLinkedProductIds = new Set(
                  supplierProductLinks
                    .filter((link) => link.supplierId === nextSupplierId)
                    .map((link) => link.productId)
                );

                setSupplierId(nextSupplierId);
                setItems((currentItems) => {
                  const nextItems = currentItems.map((item) =>
                    item.productId && !nextLinkedProductIds.has(item.productId)
                      ? { ...item, productId: "" }
                      : item
                  );

                  return nextItems.length > 0 ? nextItems : [createEmptyLine()];
                });
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
            {supplierId.length > 0 && supplierProducts.length === 0 ? (
              <p className="text-sm text-slate-500">
                This supplier has no linked products yet in the catalog.
              </p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Warehouse</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
              disabled={!isReady}
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
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Reference number</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            disabled={!isReady}
            name="referenceNumber"
            onChange={(event) => setReferenceNumber(event.target.value)}
            placeholder="PO# or delivery receipt"
            type="text"
            value={referenceNumber}
          />
          {state.fieldErrors?.referenceNumber ? (
            <p className="text-sm text-destructive">{state.fieldErrors.referenceNumber[0]}</p>
          ) : null}
        </label>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-700">Products received</h3>
              <p className="text-sm text-slate-500">
                Products are limited to the supplier links already configured on each product.
              </p>
            </div>
            <Button
              disabled={!canAddLine}
              onClick={addLine}
              size="sm"
              type="button"
              variant="outline"
            >
              Add line
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => {
              const selectedInOtherRows = new Set(
                items
                  .filter((_, itemIndex) => itemIndex !== index)
                  .map((row) => row.productId)
                  .filter((productId) => productId.length > 0)
              );
              const availableProducts = supplierProducts.filter(
                (product) =>
                  product.id === item.productId || !selectedInOtherRows.has(product.id)
              );

              return (
                <div
                  key={`receipt-line-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_auto]">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Product</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
                        disabled={!isReady || supplierId.length === 0}
                        name={`items[${index}].productId`}
                        onChange={(event) =>
                          updateLine(index, {
                            ...item,
                            productId: event.target.value,
                          })
                        }
                        value={item.productId}
                      >
                        <option value="">Select a product</option>
                        {availableProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </option>
                        ))}
                      </select>
                      {itemFieldError(state, index, "productId") ? (
                        <p className="text-sm text-destructive">
                          {itemFieldError(state, index, "productId")}
                        </p>
                      ) : null}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Quantity</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
                        disabled={!isReady}
                        min={1}
                        name={`items[${index}].quantity`}
                        onChange={(event) =>
                          updateLine(index, {
                            ...item,
                            quantity: event.target.value,
                          })
                        }
                        placeholder="1"
                        type="number"
                        value={item.quantity}
                      />
                      {itemFieldError(state, index, "quantity") ? (
                        <p className="text-sm text-destructive">
                          {itemFieldError(state, index, "quantity")}
                        </p>
                      ) : null}
                    </label>

                    <div className="flex items-end">
                      <button
                        className="rounded-2xl px-3 py-2 text-sm font-medium text-destructive transition hover:bg-white"
                        onClick={() => removeLine(index)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {state.fieldErrors?.items ? (
            <p className="text-sm text-destructive">{state.fieldErrors.items[0]}</p>
          ) : null}
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            disabled={!isReady}
            name="notes"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional receiving notes for this delivery."
            value={notes}
          />
          {state.fieldErrors?.notes ? (
            <p className="text-sm text-destructive">{state.fieldErrors.notes[0]}</p>
          ) : null}
        </label>
      </div>

      <div className="flex justify-end">
        <SubmitButton disabled={!isReady} pendingLabel="Recording...">
          Record Receipt
        </SubmitButton>
      </div>
    </form>
  );
}
