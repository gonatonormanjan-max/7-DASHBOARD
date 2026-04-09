"use client";

import {
  cancelSalesOrderAction,
  completeSalesOrderAction,
  confirmSalesOrderAction,
  deliverSalesOrderAction,
} from "@/lib/actions/sales-orders";
import { SubmitButton } from "@/components/ui/submit-button";
import type { SalesOrderStatus } from "@prisma/client";
import { useActionState } from "react";

type WorkflowState = {
  status: "idle" | "error";
  message?: string;
};

const initialWorkflowState: WorkflowState = {
  status: "idle",
};

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
        <p className="max-w-md whitespace-pre-line text-sm text-destructive">
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
  if (!canUpdate || status === "COMPLETED" || status === "CANCELLED") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
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
          <WorkflowActionForm
            action={cancelSalesOrderAction}
            className="border-[#f3c7c7] text-[#9f2121] hover:border-[#e39a9a] hover:bg-[#fff1f1]"
            label="Cancel & Restore Stock"
            orderId={orderId}
            pendingLabel="Cancelling..."
            variant="outline"
          />
        </>
      ) : null}
    </div>
  );
}
