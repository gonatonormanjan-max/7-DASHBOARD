"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { PurchaseOrderStatus } from "@prisma/client";
import {
  approvePurchaseOrderAction,
  cancelPurchaseOrderAction,
} from "@/lib/actions/purchase-orders";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

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
  action: (state: WorkflowState, formData: FormData) => Promise<WorkflowState>;
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
      <SubmitButton className={className} pendingLabel={pendingLabel} variant={variant}>
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

export function PurchaseOrderWorkflowActions({
  orderId,
  status,
  canApprove,
  canUpdate,
}: {
  orderId: string;
  status: PurchaseOrderStatus;
  canApprove: boolean;
  canUpdate: boolean;
}) {
  const isTerminal = status === "RECEIVED" || status === "CANCELLED";

  if (isTerminal || (!canApprove && !canUpdate)) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {status === "DRAFT" && canApprove ? (
        <WorkflowActionForm
          action={approvePurchaseOrderAction}
          label="Approve Order"
          orderId={orderId}
          pendingLabel="Approving..."
        />
      ) : null}

      {(status === "APPROVED" || status === "PARTIALLY_RECEIVED") && canUpdate ? (
        <Link href={`/dashboard/purchase-orders/${orderId}/receive`}>
          <Button>Receive Stock</Button>
        </Link>
      ) : null}

      {!isTerminal && canUpdate ? (
        <WorkflowActionForm
          action={cancelPurchaseOrderAction}
          className="border-[#f3c7c7] text-[#9f2121] hover:border-[#e39a9a] hover:bg-[#fff1f1]"
          label="Cancel"
          orderId={orderId}
          pendingLabel="Cancelling..."
          variant="outline"
        />
      ) : null}
    </div>
  );
}
