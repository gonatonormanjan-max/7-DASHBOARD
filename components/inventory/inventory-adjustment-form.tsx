"use client";

import { useActionState } from "react";
import {
  initialInventoryAdjustmentState,
  type InventoryAdjustmentState,
} from "@/lib/validators/inventory";
import { SubmitButton } from "@/components/ui/submit-button";

type InventoryAdjustmentFormProps = {
  action: (
    state: InventoryAdjustmentState,
    formData: FormData
  ) => Promise<InventoryAdjustmentState>;
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
};

function fieldValue(
  state: InventoryAdjustmentState,
  key: string,
  fallback = ""
) {
  return state.values?.[key] ?? fallback;
}

export function InventoryAdjustmentForm({
  action,
  products,
  locations,
}: InventoryAdjustmentFormProps) {
  const [state, formAction] = useActionState(action, initialInventoryAdjustmentState);
  const isReady = products.length > 0 && locations.length > 0;

  return (
    <form
      action={formAction}
      className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Manual adjustment</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Correct stock counts with a documented reason and a note for future audit review.
          </p>
        </div>
      </div>

      {state.message ? (
        <div className="mt-4 rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      {!isReady ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-500">
          At least one active warehouse and one active or inactive product are required before an
          adjustment can be recorded.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
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
                {location.name} ({location.code})
              </option>
            ))}
          </select>
          {state.fieldErrors?.locationId ? (
            <p className="text-sm text-destructive">{state.fieldErrors.locationId[0]}</p>
          ) : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Direction</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
              defaultValue={fieldValue(state, "direction", "increase")}
              disabled={!isReady}
              name="direction"
            >
              <option value="increase">Increase stock</option>
              <option value="decrease">Decrease stock</option>
            </select>
            {state.fieldErrors?.direction ? (
              <p className="text-sm text-destructive">{state.fieldErrors.direction[0]}</p>
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
              placeholder="10"
              type="number"
            />
            {state.fieldErrors?.quantity ? (
              <p className="text-sm text-destructive">{state.fieldErrors.quantity[0]}</p>
            ) : null}
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Reason</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            defaultValue={fieldValue(state, "reason")}
            disabled={!isReady}
            name="reason"
            placeholder="Cycle count correction"
            type="text"
          />
          {state.fieldErrors?.reason ? (
            <p className="text-sm text-destructive">{state.fieldErrors.reason[0]}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            defaultValue={fieldValue(state, "notes")}
            disabled={!isReady}
            name="notes"
            placeholder="Document what changed and why."
          />
          {state.fieldErrors?.notes ? (
            <p className="text-sm text-destructive">{state.fieldErrors.notes[0]}</p>
          ) : null}
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <SubmitButton disabled={!isReady} pendingLabel="Recording...">
          Record adjustment
        </SubmitButton>
      </div>
    </form>
  );
}
