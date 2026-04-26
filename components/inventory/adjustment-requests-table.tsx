"use client";

import { useActionState, useState } from "react";
import {
  approveAdjustmentRequestAction,
  rejectAdjustmentRequestAction,
  initialReviewRequestState,
  type ReviewRequestState,
} from "@/lib/actions/adjustment-requests";
import type { AdjustmentRequestRow } from "@/lib/dal/adjustment-requests";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";

type AdjustmentRequestsTableProps = {
  requests: AdjustmentRequestRow[];
  canApprove: boolean;
};

// ---------------------------------------------------------------------------
// Inline approve form
// ---------------------------------------------------------------------------

function ApproveForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState<ReviewRequestState, FormData>(
    approveAdjustmentRequestAction,
    initialReviewRequestState
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      {state.status === "error" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
      <textarea
        name="reviewNotes"
        rows={2}
        maxLength={500}
        placeholder="Optional admin notes…"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      />
      <SubmitButton
        size="sm"
        variant="default"
        pendingLabel="Approving…"
        className="w-full"
      >
        ✓ Approve &amp; Execute
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inline reject form
// ---------------------------------------------------------------------------

function RejectForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState<ReviewRequestState, FormData>(
    rejectAdjustmentRequestAction,
    initialReviewRequestState
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      {state.status === "error" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
      <textarea
        name="reviewNotes"
        rows={2}
        maxLength={500}
        placeholder="Reason for rejection…"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      />
      <SubmitButton
        size="sm"
        variant="outline"
        pendingLabel="Rejecting…"
        className="w-full border-destructive/40 text-destructive hover:bg-destructive/5"
      >
        ✕ Reject
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Expandable review panel for PENDING requests
// ---------------------------------------------------------------------------

function ReviewPanel({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition"
      >
        Review
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("approve")}
          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            mode === "approve"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-slate-600 hover:border-slate-300"
          }`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setMode("reject")}
          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            mode === "reject"
              ? "border-destructive/50 bg-destructive/5 text-destructive"
              : "border-border text-slate-600 hover:border-slate-300"
          }`}
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setMode(null); }}
          className="rounded-md border border-border px-2 py-1.5 text-xs text-slate-500 hover:bg-muted transition"
        >
          Cancel
        </button>
      </div>

      {mode === "approve" && <ApproveForm requestId={requestId} />}
      {mode === "reject" && <RejectForm requestId={requestId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

const REASON_LABELS: Record<string, string> = {
  count_correction: "Count Correction",
  damage_loss: "Damage / Loss",
  expired: "Expired",
  other: "Other",
};

function formatName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function AdjustmentRequestsTable({
  requests,
  canApprove,
}: AdjustmentRequestsTableProps) {
  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <p className="text-sm text-slate-500">No adjustment requests found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Branch</th>
            <th className="px-4 py-3 text-left font-medium">Product</th>
            <th className="px-4 py-3 text-left font-medium">Adjustment</th>
            <th className="px-4 py-3 text-left font-medium">Reason</th>
            <th className="px-4 py-3 text-left font-medium">Submitted</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            {canApprove && <th className="px-4 py-3 text-left font-medium">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {requests.map((req) => (
            <tr key={req.id} className="bg-card hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <span className="font-medium text-slate-800">{req.branch.name}</span>
                <span className="ml-1 text-xs text-slate-400">{req.branch.code}</span>
              </td>
              <td className="px-4 py-3">
                <span className="font-medium text-slate-800">{req.product.name}</span>
                <br />
                <span className="text-xs text-slate-400">{req.product.sku}</span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`font-semibold ${
                    req.direction === "increase" ? "text-success" : "text-destructive"
                  }`}
                >
                  {req.direction === "increase" ? "▲" : "▼"} {req.quantity}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <span>{REASON_LABELS[req.reason] ?? req.reason}</span>
                {req.notes && (
                  <p className="mt-0.5 text-xs text-slate-400 italic">{req.notes}</p>
                )}
              </td>
              <td className="px-4 py-3 text-slate-500">
                <span>{formatDate(req.requestedAt)}</span>
                <br />
                <span className="text-xs text-slate-400">
                  by {formatName(req.requestedBy)}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={req.status} />
                {req.reviewedBy && (
                  <p className="mt-1 text-xs text-slate-400">
                    by {formatName(req.reviewedBy)}
                  </p>
                )}
                {req.reviewNotes && (
                  <p className="mt-0.5 text-xs text-slate-400 italic">
                    &ldquo;{req.reviewNotes}&rdquo;
                  </p>
                )}
              </td>
              {canApprove && (
                <td className="px-4 py-3 align-top">
                  {req.status === "PENDING" && (
                    <ReviewPanel requestId={req.id} />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
