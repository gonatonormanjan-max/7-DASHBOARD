"use client";

import { useActionState, useEffect, useEffectEvent, useState } from "react";
import { createPortal } from "react-dom";
import { createVaultAdjustmentAction } from "@/lib/actions/vault";
import { initialVaultFormState } from "@/lib/actions/vault-types";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "ONLINE", label: "Online" },
] as const;

type VaultAdjustmentModalProps = {
  branchId: string;
  branchName: string;
};

export function VaultAdjustmentModal({
  branchId,
  branchName,
}: VaultAdjustmentModalProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    createVaultAdjustmentAction,
    initialVaultFormState
  );

  const handleSuccess = useEffectEvent(() => {
    setOpen(false);
  });

  useEffect(() => {
    if (state.status === "success") {
      const timeoutId = window.setTimeout(() => {
        handleSuccess();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [state.status]);

  const modal = open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-lg rounded-[28px] border border-border bg-white p-6 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Vault adjustment
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Adjust balance — {branchName}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Use a positive amount to add funds, negative to deduct.
            </p>
          </div>
          <Button onClick={() => setOpen(false)} type="button" variant="ghost">
            Close
          </Button>
        </div>

        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="branchId" value={branchId} />

          {state.message && state.status === "error" ? (
            <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
              {state.message}
            </div>
          ) : null}

          {/* Payment method */}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Balance to adjust
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="paymentMethod"
              defaultValue="CASH"
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.paymentMethod ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.paymentMethod[0]}
              </p>
            ) : null}
          </label>

          {/* Signed amount */}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Amount (₱){" "}
              <span className="text-xs font-normal text-slate-400">
                positive to add · negative to deduct
              </span>
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="adjustmentAmount"
              placeholder="e.g. 500.00 or -200.00"
              required
              step="0.01"
              type="number"
            />
            {state.fieldErrors?.adjustmentAmount ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.adjustmentAmount[0]}
              </p>
            ) : null}
          </label>

          {/* Notes — mandatory for adjustments */}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Reason <span className="text-destructive">*</span>
            </span>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="notes"
              placeholder="Explain why this adjustment is needed (required)."
              required
            />
            {state.fieldErrors?.notes ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.notes[0]}
              </p>
            ) : null}
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving...">
              Save adjustment
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        className="shrink-0"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        Adjust Balance
      </Button>
      {modal && typeof document !== "undefined"
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
