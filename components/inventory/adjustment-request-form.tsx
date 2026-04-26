"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  submitAdjustmentRequestAction,
  initialAdjustmentRequestFormState,
  type AdjustmentRequestFormState,
} from "@/lib/actions/adjustment-requests";
import { SubmitButton } from "@/components/ui/submit-button";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  locationStock: Array<{ quantity: number; reservedQty: number }>;
};

type AdjustmentRequestFormProps = {
  products: ProductOption[];
  branchId: string;
  branchName: string;
};

const REASON_OPTIONS = [
  { value: "count_correction", label: "Count Correction" },
  { value: "damage_loss", label: "Damage / Loss" },
  { value: "expired", label: "Expired" },
  { value: "other", label: "Other" },
] as const;

function fieldValue(state: AdjustmentRequestFormState, key: string, fallback = "") {
  return state.values?.[key] ?? fallback;
}

export function AdjustmentRequestForm({
  products,
  branchId,
  branchName,
}: AdjustmentRequestFormProps) {
  const [state, formAction] = useActionState(
    submitAdjustmentRequestAction,
    initialAdjustmentRequestFormState
  );

  const initialReason = fieldValue(state, "reason", "count_correction");
  const [reason, setReason] = useState(initialReason);
  const [direction, setDirection] = useState(
    initialReason === "damage_loss" || initialReason === "expired"
      ? "decrease"
      : fieldValue(state, "direction", "increase")
  );
  const [selectedProductId, setSelectedProductId] = useState(
    fieldValue(state, "productId", "")
  );

  const directionLocked = reason === "damage_loss" || reason === "expired";

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const stockRow = selectedProduct?.locationStock[0];
  const onHand = stockRow?.quantity ?? 0;
  const reserved = stockRow?.reservedQty ?? 0;
  const available = onHand - reserved;

  return (
    <form
      action={formAction}
      className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-6"
    >
      {/* Hidden branch field — always scoped to manager's branch */}
      <input type="hidden" name="branchId" value={branchId} />

      {/* Error banner */}
      {state.status === "error" && state.message && !state.fieldErrors && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      {/* Branch (read-only display) */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Branch</label>
        <p className="mt-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-slate-600">
          {branchName}
        </p>
      </div>

      {/* Product selector */}
      <div>
        <label htmlFor="productId" className="block text-sm font-medium text-slate-700">
          Product <span className="text-destructive">*</span>
        </label>
        <select
          id="productId"
          name="productId"
          className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          required
        >
          <option value="">Select a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
        {state.fieldErrors?.productId && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.productId[0]}</p>
        )}

        {/* Stock summary */}
        {selectedProduct && (
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span>On hand: <strong className="text-slate-700">{onHand}</strong></span>
            <span>Reserved: <strong className="text-slate-700">{reserved}</strong></span>
            <span>
              Available:{" "}
              <strong className={available <= 0 ? "text-destructive" : "text-slate-700"}>
                {available}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Reason */}
      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
          Reason <span className="text-destructive">*</span>
        </label>
        <select
          id="reason"
          name="reason"
          className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={reason}
          onChange={(e) => {
            const next = e.target.value;
            setReason(next);
            if (next === "damage_loss" || next === "expired") {
              setDirection("decrease");
            }
          }}
          required
        >
          {REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.reason && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.reason[0]}</p>
        )}
      </div>

      {/* Direction */}
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Direction <span className="text-destructive">*</span>
        </label>
        <div className="mt-1.5 flex gap-3">
          {(["increase", "decrease"] as const).map((dir) => (
            <label
              key={dir}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm transition ${
                direction === dir
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border text-slate-600 hover:border-slate-300"
              } ${directionLocked && dir === "increase" ? "pointer-events-none opacity-40" : ""}`}
            >
              <input
                type="radio"
                name="direction"
                value={dir}
                checked={direction === dir}
                onChange={() => setDirection(dir)}
                className="sr-only"
                disabled={directionLocked && dir === "increase"}
              />
              {dir === "increase" ? "▲ Increase" : "▼ Decrease"}
            </label>
          ))}
        </div>
        {directionLocked && (
          <p className="mt-1 text-xs text-slate-500">
            Damage and expiry adjustments are always a decrease.
          </p>
        )}
        {state.fieldErrors?.direction && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.direction[0]}</p>
        )}
      </div>

      {/* Quantity */}
      <div>
        <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">
          Quantity <span className="text-destructive">*</span>
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          step={1}
          defaultValue={fieldValue(state, "quantity", "")}
          className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          required
        />
        {state.fieldErrors?.quantity && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.quantity[0]}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
          <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          defaultValue={fieldValue(state, "notes", "")}
          placeholder="Add context for the admin reviewing this request…"
          className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Link
          href="/dashboard/inventory/adjustment-requests"
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-muted transition"
        >
          Cancel
        </Link>
        <SubmitButton pendingLabel="Submitting…">
          Submit for Approval
        </SubmitButton>
      </div>
    </form>
  );
}
