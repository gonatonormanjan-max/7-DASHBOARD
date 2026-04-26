import Link from "next/link";
import { requirePermission } from "@/lib/dal/auth";
import { getAdjustmentRequests } from "@/lib/dal/adjustment-requests";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { AdjustmentRequestsTable } from "@/components/inventory/adjustment-requests-table";

export default async function AdjustmentRequestsPage() {
  const user = await requirePermission("adjustment_requests", "read");
  const requests = await getAdjustmentRequests(user);

  const canApprove = hasPermission(user.role, "adjustment_requests", "approve");
  const canSubmit = hasPermission(user.role, "adjustment_requests", "create");

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory"
        title="Adjustment Requests"
        description={
          canApprove
            ? "Review and action stock adjustment requests submitted by branch managers."
            : "Track the status of your submitted stock adjustment requests."
        }
        action={
          canSubmit ? (
            <Link
              href="/dashboard/inventory/adjustment-requests/new"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              Request Adjustment
            </Link>
          ) : undefined
        }
      />

      {canApprove && pendingCount > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
          <p className="text-sm font-medium text-warning">
            {pendingCount === 1
              ? "1 adjustment request is pending your review."
              : `${pendingCount} adjustment requests are pending your review.`}
          </p>
        </div>
      )}

      <AdjustmentRequestsTable
        requests={requests}
        canApprove={canApprove}
      />
    </div>
  );
}
