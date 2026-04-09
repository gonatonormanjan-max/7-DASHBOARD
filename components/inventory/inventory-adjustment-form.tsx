"use client";

import { useActionState, useState } from "react";
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
  initialLocationId?: string;
  returnTo?: string;
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
  initialLocationId,
  returnTo,
}: InventoryAdjustmentFormProps) {
  const [state, formAction] = useActionState(action, initialInventoryAdjustmentState);
  const isReady = products.length > 0 && locations.length > 0;
  const initialReason = fieldValue(state, "reason", "count_correction");
  const [reason, setReason] = useState(initialReason);
  const [direction, setDirection] = useState(
    initialReason === "damage_loss" || initialReason === "expired"
      ? "decrease"
      : fieldValue(state, "direction", "increase")
  );
  const directionLocked = reason === "damage_loss" || reason === "expired";

  return (
    <form
      action={formAction}
      className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]"
    >
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}

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
            defaultValue={fieldValue(state, "locationId", initialLocationId ?? "")}
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
            {directionLocked ? <input name="direction" type="hidden" value="decrease" /> : null}
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
              disabled={!isReady || directionLocked}
              name="direction"
              onChange={(event) => setDirection(event.target.value)}
              value={directionLocked ? "decrease" : direction}
            >
              <option value="increase">Increase stock</option>
              <option value="decrease">Decrease stock</option>
            </select>
            {directionLocked ? (
              <p className="text-sm text-slate-500">
                Damage and expiry adjustments are always negative.
              </p>
            ) : null}
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
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            disabled={!isReady}
            name="reason"
            onChange={(event) => {
              const nextReason = event.target.value;

              setReason(nextReason);

              if (nextReason === "damage_loss" || nextReason === "expired") {
                setDirection("decrease");
              }
            }}
          >
            <option value="">Select a reason</option>
            <option value="count_correction">Count correction</option>
            <option value="damage_loss">Damage / loss</option>
            <option value="expired">Expired</option>
            <option value="other">Other</option>
          </select>
          {state.fieldErrors?.reason ? (
            <p className="text-sm text-destructive">{state.fieldErrors.reason[0]}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            defaultValue={state.values?.notes ?? ""}
            disabled={!isReady}
            name="notes"
            placeholder="Describe why the stock is being adjusted."
          />
          {state.fieldErrors?.notes ? (
            <p className="text-sm text-destructive">{state.fieldErrors.notes[0]}</p>
          ) : null}
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <SubmitButton disabled={!isReady}>Apply adjustment</SubmitButton>
      </div>
    </form>
  );
}