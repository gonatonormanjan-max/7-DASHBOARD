"use client";

import { useActionState } from "react";
import {
  initialCashOutFormState,
  type CashOutFormState,
} from "@/lib/validators/cash-out";
import { Button } from "@/components/ui/button";

type VoidCashOutFormProps = {
  action: (
    state: CashOutFormState,
    formData: FormData
  ) => Promise<CashOutFormState>;
  transactionId: string;
};

export function VoidCashOutForm({
  action,
  transactionId,
}: VoidCashOutFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCashOutFormState
  );
  const error = state.fieldErrors?.voidReason?.[0];

  return (
    <form action={formAction} className="space-y-3">
      <input name="transactionId" type="hidden" value={transactionId} />
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Void reason</span>
        <textarea
          className="min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
          name="voidReason"
          placeholder="Explain why this cash-out transaction must be reversed."
        />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "text-sm text-emerald-700"
              : "text-sm text-red-600"
          }
        >
          {state.message}
        </p>
      ) : null}
      <Button disabled={pending} type="submit" variant="outline">
        {pending ? "Voiding..." : "Void transaction"}
      </Button>
    </form>
  );
}
