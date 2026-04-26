"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  voidSalesOrderAction,
  type VoidSalesOrderState,
} from "@/lib/actions/sales-orders";

const initialVoidState: VoidSalesOrderState = { status: "idle" };

export function VoidSaleButton({ orderId }: { orderId: string }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction] = useActionState(
    voidSalesOrderAction,
    initialVoidState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="orderId" type="hidden" value={orderId} />

      {state.status === "error" && state.message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.message}
        </div>
      ) : null}

      {!isConfirming ? (
        <Button
          className="border-amber-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50"
          onClick={() => setIsConfirming(true)}
          type="button"
          variant="outline"
        >
          Void sale
        </Button>
      ) : (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">Confirm void</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This will mark the sale as voided and return the original stock to its
            warehouse locations. The change cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => setIsConfirming(false)}
              type="button"
              variant="ghost"
            >
              Keep sale
            </Button>
            <SubmitButton
              className="bg-slate-900 text-white hover:bg-slate-800"
              pendingLabel="Voiding sale..."
            >
              Confirm void
            </SubmitButton>
          </div>
        </div>
      )}
    </form>
  );
}
