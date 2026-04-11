"use client";

import { useActionState } from "react";
import {
  initialInventoryTransferState,
  type InventoryTransferState,
} from "@/lib/validators/inventory";
import { SubmitButton } from "@/components/ui/submit-button";

type InventoryTransferFormProps = {
  action: (
    state: InventoryTransferState,
    formData: FormData
  ) => Promise<InventoryTransferState>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
  }>;
  locations: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  initialFromLocationId?: string;
  returnTo?: string;
};

function fieldValue(state: InventoryTransferState, key: string, fallback = "") {
  return state.values?.[key] ?? fallback;
}

export function InventoryTransferForm({
  action,
  products,
  locations,
  initialFromLocationId,
  returnTo,
}: InventoryTransferFormProps) {
  const [state, formAction] = useActionState(action, initialInventoryTransferState);
  const isReady = products.length > 0 && locations.length > 1;

  return (
    <form
      action={formAction}
      className="rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}

      <div>
        <h2 className="text-lg font-semibold text-slate-950">Stock transfer</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Move available stock between active locations while preserving a clear movement trail.
        </p>
      </div>

      {state.message ? (
        <div className="mt-4 rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      {!isReady ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-500">
          Transfers need at least one active product and two active warehouses.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Product</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
            defaultValue={fieldValue(state, "productId")}
            disabled={!isReady}
            name="productId"
          >
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
          {state.fieldErrors?.productId ? (
            <p className="text-sm text-destructive">{state.fieldErrors.productId[0]}</p>
          ) : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">From location</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
              defaultValue={fieldValue(
                state,
                "fromLocationId",
                initialFromLocationId ?? ""
              )}
              disabled={!isReady}
              name="fromLocationId"
            >
              <option value="">Select source</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.code})
                </option>
              ))}
            </select>
            {state.fieldErrors?.fromLocationId ? (
              <p className="text-sm text-destructive">{state.fieldErrors.fromLocationId[0]}</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">To location</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
              defaultValue={fieldValue(state, "toLocationId")}
              disabled={!isReady}
              name="toLocationId"
            >
              <option value="">Select destination</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.code})
                </option>
              ))}
            </select>
            {state.fieldErrors?.toLocationId ? (
              <p className="text-sm text-destructive">{state.fieldErrors.toLocationId[0]}</p>
            ) : null}
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Quantity</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
            defaultValue={fieldValue(state, "quantity")}
            disabled={!isReady}
            min={1}
            name="quantity"
            placeholder="12"
            type="number"
          />
          {state.fieldErrors?.quantity ? (
            <p className="text-sm text-destructive">{state.fieldErrors.quantity[0]}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
            defaultValue={fieldValue(state, "notes")}
            disabled={!isReady}
            name="notes"
            placeholder="Describe why this stock is moving."
          />
          {state.fieldErrors?.notes ? (
            <p className="text-sm text-destructive">{state.fieldErrors.notes[0]}</p>
          ) : null}
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <SubmitButton disabled={!isReady}>Transfer stock</SubmitButton>
      </div>
    </form>
  );
}