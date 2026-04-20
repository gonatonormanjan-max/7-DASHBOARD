"use client";

import { useActionState, useEffect, useEffectEvent, useState } from "react";
import { createPortal } from "react-dom";
import {
  createCashDropAction,
  initialCashDropFormState,
} from "@/lib/actions/vault";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

const DESTINATIONS = [
  { value: "SAFE", label: "Safe" },
  { value: "BANK_DEPOSIT", label: "Bank deposit" },
  { value: "HANDED_TO_ADMIN", label: "Handed to admin" },
  { value: "OTHERS", label: "Others (specify)" },
] as const;

type CashDropModalProps = {
  branchId: string;
  branchName: string;
};

export function CashDropModal({ branchId, branchName }: CashDropModalProps) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<string>("SAFE");
  const [state, formAction] = useActionState(
    createCashDropAction,
    initialCashDropFormState
  );

  const handleSuccess = useEffectEvent(() => {
    setOpen(false);
    setDestination("SAFE");
  });

  useEffect(() => {
    if (state.status === "success") {
      handleSuccess();
    }
  }, [state]);

  const modal = open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-lg rounded-[28px] border border-border bg-white p-6 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Cash drop
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Record cash drop — {branchName}
            </h2>
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

          {/* Cash amount */}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Amount (₱)
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              min="0.01"
              name="cashAmount"
              placeholder="0.00"
              required
              step="0.01"
              type="number"
            />
            {state.fieldErrors?.cashAmount ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.cashAmount[0]}
              </p>
            ) : null}
          </label>

          {/* Destination */}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Destination
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="destination"
              onChange={(e) => setDestination(e.target.value)}
              value={destination}
            >
              {DESTINATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.destination ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.destination[0]}
              </p>
            ) : null}
          </label>

          {/* Destination note — shown only when OTHERS is selected */}
          {destination === "OTHERS" ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Describe the destination{" "}
                <span className="text-destructive">*</span>
              </span>
              <textarea
                className="min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                name="destinationNote"
                placeholder="Where did this cash go?"
                required
              />
              {state.fieldErrors?.destinationNote ? (
                <p className="text-sm text-destructive">
                  {state.fieldErrors.destinationNote[0]}
                </p>
              ) : null}
            </label>
          ) : null}

          {/* Notes — always optional */}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Notes{" "}
              <span className="text-xs font-normal text-slate-400">
                (optional)
              </span>
            </span>
            <textarea
              className="min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="notes"
              placeholder="Additional context about this cash drop."
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
            <SubmitButton pendingLabel="Recording...">
              Record cash drop
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
        Cash Drop
      </Button>
      {modal && typeof document !== "undefined"
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
