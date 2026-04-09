"use client";

import { useActionState } from "react";
import {
  initialInitialStockState,
  type InitialStockState,
} from "@/lib/validators/inventory";
import { SubmitButton } from "@/components/ui/submit-button";

type InitialStockFormProps = {
  action: (
    state: InitialStockState,
    formData: FormData
  ) => Promise<InitialStockState>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
  }>;
  locations: Array<{
    id: string;
    name: string;
    code: string;
    type: "WAREHOUSE" | "BRANCH";
  }>;
};

function fieldValue(
  state: InitialStockState,
  key: keyof NonNullable<InitialStockState["values"]>,
  fallback = ""
) {
  return state.values?.[key] ?? fallback;
}

export function InitialStockForm({
  action,
  products,
  locations,
}: InitialStockFormProps) {
  const [state, formAction] = useActionState(action, initialInitialStockState);
  const isReady = products.length > 0 && locations.length > 0;

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
        Use this tool only for loading opening stock during initial data migration. For regular
        stock changes, use Manual Adjustment or Supplier Receipt.
      </div>

      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      {!isReady ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-500">
          Opening stock needs at least one active product and one active inventory location.
        </div>
      ) : null}

      <div className="grid gap-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Product</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
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

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Location</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            defaultValue={fieldValue(state, "locationId")}
            disabled={!isReady}
            name="locationId"
          >
            <option value="">Select a location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.code}) - {location.type}
              </option>
            ))}
          </select>
          {state.fieldErrors?.locationId ? (
            <p className="text-sm text-destructive">{state.fieldErrors.locationId[0]}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Quantity</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            defaultValue={fieldValue(state, "quantity")}
            disabled={!isReady}
            min={1}
            name="quantity"
            placeholder="100"
            type="number"
          />
          {state.fieldErrors?.quantity ? (
            <p className="text-sm text-destructive">{state.fieldErrors.quantity[0]}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            defaultValue={fieldValue(state, "notes")}
            disabled={!isReady}
            name="notes"
            placeholder="Optional migration note or import reference."
          />
          {state.fieldErrors?.notes ? (
            <p className="text-sm text-destructive">{state.fieldErrors.notes[0]}</p>
          ) : null}
        </label>
      </div>

      <div className="flex justify-end">
        <SubmitButton disabled={!isReady} pendingLabel="Loading...">
          Load Opening Stock
        </SubmitButton>
      </div>
    </form>
  );
}
