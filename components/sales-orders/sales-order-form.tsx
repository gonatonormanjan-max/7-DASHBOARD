"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  initialSalesOrderFormState,
  type SalesOrderFormState,
} from "@/lib/validators/sales-orders";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unitPrice: string;
};

type LocationOption = {
  id: string;
  name: string;
};

type SalesOrderRow = {
  id: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

type SalesOrderFormProps = {
  action: (
    state: SalesOrderFormState,
    formData: FormData
  ) => Promise<SalesOrderFormState>;
  products: ProductOption[];
  locations: LocationOption[];
  initialValues?: {
    locationId?: string;
    customerName?: string;
    customerEmail?: string;
    notes?: string;
    items?: Array<{
      productId: string;
      quantity: number;
      unitPrice: string;
    }>;
  };
};

function createRow(id: string, overrides: Partial<SalesOrderRow> = {}): SalesOrderRow {
  return {
    id,
    productId: "",
    quantity: "1",
    unitPrice: "0.00",
    ...overrides,
  };
}

function parseAmount(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function SalesOrderForm({
  action,
  products,
  locations,
  initialValues,
}: SalesOrderFormProps) {
  const [state, formAction] = useActionState(action, initialSalesOrderFormState);
  const [nextRowId, setNextRowId] = useState(
    (initialValues?.items?.length ?? 1) + 1
  );
  const [locationId, setLocationId] = useState(
    initialValues?.locationId ?? locations[0]?.id ?? ""
  );
  const [customerName, setCustomerName] = useState(initialValues?.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState(
    initialValues?.customerEmail ?? ""
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [rows, setRows] = useState<SalesOrderRow[]>(
    initialValues?.items?.length
      ? initialValues.items.map((item, index) =>
          createRow(`row-${index + 1}`, {
            productId: item.productId,
            quantity: String(item.quantity),
            unitPrice: item.unitPrice,
          })
        )
      : [createRow("row-1")]
  );

  const isReady = products.length > 0 && locations.length > 0;
  const serializedItems = JSON.stringify(
    rows
      .filter((row) => row.productId)
      .map((row) => ({
        productId: row.productId,
        quantity: parseAmount(row.quantity),
        unitPrice: parseAmount(row.unitPrice),
      }))
  );
  const runningTotal = rows.reduce(
    (sum, row) => sum + parseAmount(row.quantity) * parseAmount(row.unitPrice),
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

      <div className="grid gap-6 rounded-lg border border-border bg-card p-6 shadow-sm lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Branch</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
            disabled={!isReady}
            name="locationId"
            onChange={(event) => setLocationId(event.target.value)}
            value={locationId}
          >
            <option value="">Select a branch</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.locationId ? (
            <p className="text-sm text-destructive">{state.fieldErrors.locationId[0]}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Customer name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            name="customerName"
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Acme Retail"
            required
            type="text"
            value={customerName}
          />
          {state.fieldErrors?.customerName ? (
            <p className="text-sm text-destructive">{state.fieldErrors.customerName[0]}</p>
          ) : null}
        </label>

        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Customer email</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            name="customerEmail"
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="buyer@acme.com"
            type="email"
            value={customerEmail}
          />
          {state.fieldErrors?.customerEmail ? (
            <p className="text-sm text-destructive">{state.fieldErrors.customerEmail[0]}</p>
          ) : null}
        </label>
      </div>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Line items</h2>
            <p className="text-sm leading-6 text-slate-500">
              Choose products, adjust quantities, and fine-tune prices before saving the
              order as a draft.
            </p>
          </div>
          <Button
            disabled={!isReady || products.length === 0}
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
            Sales orders need at least one active branch and one active product before
            they can be drafted.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {rows.map((row, index) => {
              const selectedProductIds = rows
                .filter((candidate) => candidate.id !== row.id && candidate.productId)
                .map((candidate) => candidate.productId);
              const availableProducts = products.filter(
                (product) =>
                  product.id === row.productId ||
                  !selectedProductIds.includes(product.id)
              );
              const subtotal = parseAmount(row.quantity) * parseAmount(row.unitPrice);

              return (
                <div
                  key={row.id}
                  className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_150px_170px_150px_auto]">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Product</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                        onChange={(event) => {
                          const nextProduct = products.find(
                            (product) => product.id === event.target.value
                          );

                          setRows((current) =>
                            current.map((candidate) =>
                              candidate.id === row.id
                                ? {
                                    ...candidate,
                                    productId: event.target.value,
                                    unitPrice: nextProduct?.unitPrice ?? "0.00",
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
                      <span className="text-sm font-medium text-slate-700">Unit price</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                        min="0"
                        onChange={(event) => {
                          setRows((current) =>
                            current.map((candidate) =>
                              candidate.id === row.id
                                ? { ...candidate, unitPrice: event.target.value }
                                : candidate
                            )
                          );
                        }}
                        step="0.01"
                        type="number"
                        value={row.unitPrice}
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
                            current.filter((candidate) => candidate.id !== row.id)
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
            All items in this draft will be assigned to the selected branch.
          </p>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Running total
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {formatCurrency(runningTotal)}
            </p>
          </div>
        </div>
      </section>

      <label className="block space-y-2 rounded-lg border border-border bg-card p-6 shadow-sm">
        <span className="text-sm font-medium text-slate-700">Notes</span>
        <textarea
          className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
          name="notes"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Delivery notes, payment reminders, or internal context."
          value={notes}
        />
        {state.fieldErrors?.notes ? (
          <p className="text-sm text-destructive">{state.fieldErrors.notes[0]}</p>
        ) : null}
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link href="/dashboard/sales-orders">
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
