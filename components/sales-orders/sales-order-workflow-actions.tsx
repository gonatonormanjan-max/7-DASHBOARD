"use client";

import {
  cancelSalesOrderAction,
  completeSalesOrderAction,
  confirmSalesOrderAction,
  deliverSalesOrderAction,
  voidSalesOrderWithReturnAction,
} from "@/lib/actions/sales-orders";
import { SubmitButton } from "@/components/ui/submit-button";
import type { SalesOrderStatus } from "@prisma/client";
import { useActionState } from "react";
import { initialSalesOrderVoidFormState } from "@/lib/validators/sales-orders";

type WorkflowState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const initialWorkflowState: WorkflowState = {
  status: "idle",
};

const voidReasonOptions: Array<{ value: string; label: string }> = [
  { value: "DEFECT", label: "DEFECT" },
  { value: "RETURNED_REFUND", label: "RETURNED/REFUND" },
  { value: "REPLACE", label: "REPLACE" },
  { value: "OTHERS", label: "OTHERS" },
];

function WorkflowActionForm({
  action,
  orderId,
  label,
  pendingLabel,
  variant = "default",
  className,
}: {
  action: (
    state: WorkflowState,
    formData: FormData
  ) => Promise<WorkflowState>;
  orderId: string;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialWorkflowState);

  return (
    <form action={formAction} className="space-y-2">
      <input name="orderId" type="hidden" value={orderId} />
      <SubmitButton
        className={className}
        pendingLabel={pendingLabel}
        variant={variant}
      >
        {label}
      </SubmitButton>
      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "max-w-md whitespace-pre-line text-sm text-destructive"
              : "max-w-md whitespace-pre-line text-sm text-emerald-700"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function VoidSaleReturnForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(
    voidSalesOrderWithReturnAction,
    initialSalesOrderVoidFormState
  );

  const fieldValue = (key: string) => state.values?.[key] ?? "";

  return (
    <form action={formAction} className="w-full space-y-3 rounded-lg border border-[#f3c7c7] bg-[#fff7f7] p-4">
      <input name="orderId" type="hidden" value={orderId} />

      <p className="text-sm font-semibold text-[#7d1b1b]">Void Sale & Restore Stock</p>
      <p className="text-sm leading-6 text-slate-600">
        Use this for returns/refunds after fulfillment. Stock is restored to the original branch
        and the reason is documented in the movement ledger.
      </p>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          Return reason
        </span>
        <select
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus-visible:ring-2 focus-visible:ring-ring/30"
          defaultValue={fieldValue("voidReason")}
          name="voidReason"
          required
        >
          <option value="">Select reason</option>
          {voidReasonOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.voidReason ? (
          <p className="text-sm text-destructive">{state.fieldErrors.voidReason[0]}</p>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          Remarks
        </span>
        <textarea
          className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus-visible:ring-2 focus-visible:ring-ring/30"
          defaultValue={fieldValue("voidRemarks")}
          name="voidRemarks"
          placeholder="Explain what happened and why this sale is being voided."
          required
        />
        {state.fieldErrors?.voidRemarks ? (
          <p className="text-sm text-destructive">{state.fieldErrors.voidRemarks[0]}</p>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          Documentation
        </span>
        <textarea
          className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus-visible:ring-2 focus-visible:ring-ring/30"
          defaultValue={fieldValue("voidDocumentation")}
          name="voidDocumentation"
          placeholder="Add refund reference, receipt number, chat/email note, or other proof."
          required
        />
        {state.fieldErrors?.voidDocumentation ? (
          <p className="text-sm text-destructive">{state.fieldErrors.voidDocumentation[0]}</p>
        ) : null}
      </label>

      <SubmitButton
        className="w-full border-[#f0bcbc] bg-[#a02323] text-white hover:bg-[#8f1f1f]"
        pendingLabel="Voiding sale..."
      >
        Void Sale & Restore Stock
      </SubmitButton>

      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "max-w-md whitespace-pre-line text-sm text-destructive"
              : "max-w-md whitespace-pre-line text-sm text-emerald-700"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function SalesOrderWorkflowActions({
  orderId,
  status,
  canUpdate,
}: {
  orderId: string;
  status: SalesOrderStatus;
  canUpdate: boolean;
}) {
  if (!canUpdate || status === "CANCELLED") {
    return null;
  }

  return (
    <div className="flex w-full flex-wrap gap-3">
      {status === "DRAFT" ? (
        <>
          <WorkflowActionForm
            action={confirmSalesOrderAction}
            label="Confirm Order"
            orderId={orderId}
            pendingLabel="Confirming..."
          />
          <WorkflowActionForm
            action={cancelSalesOrderAction}
            className="border-[#f3c7c7] text-[#9f2121] hover:border-[#e39a9a] hover:bg-[#fff1f1]"
            label="Cancel"
            orderId={orderId}
            pendingLabel="Cancelling..."
            variant="outline"
          />
        </>
      ) : null}

      {status === "CONFIRMED" ? (
        <>
          <WorkflowActionForm
            action={deliverSalesOrderAction}
            label="Mark Delivered"
            orderId={orderId}
            pendingLabel="Delivering..."
          />
          <WorkflowActionForm
            action={cancelSalesOrderAction}
            className="border-[#f3c7c7] text-[#9f2121] hover:border-[#e39a9a] hover:bg-[#fff1f1]"
            label="Cancel"
            orderId={orderId}
            pendingLabel="Cancelling..."
            variant="outline"
          />
        </>
      ) : null}

      {status === "DELIVERED" ? (
        <>
          <WorkflowActionForm
            action={completeSalesOrderAction}
            label="Complete Order"
            orderId={orderId}
            pendingLabel="Completing..."
          />
          <VoidSaleReturnForm orderId={orderId} />
        </>
      ) : null}

      {status === "COMPLETED" ? <VoidSaleReturnForm orderId={orderId} /> : null}
    </div>
  );
}
