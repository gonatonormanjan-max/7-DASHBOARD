import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";
import { getDailyOpsOverview } from "@/lib/dal/daily-ops";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default async function DailyOpsPage() {
  const user = await requirePermission("daily_ops", "read");
  const overview = await getDailyOpsOverview(user);

  if (overview.branches.length === 0) {
    redirect("/dashboard");
  }

  const openingSubmitted = overview.counts.filter(
    (count) => count.type === "OPENING" && count.status === "SUBMITTED"
  ).length;
  const closingSubmitted = overview.counts.filter(
    (count) => count.type === "CLOSING" && count.status === "SUBMITTED"
  ).length;
  const discrepancyBranchCount = new Set(
    overview.discrepancySummary.map((item) => item.location.id)
  ).size;
  const canCreateCounts = hasPermission(user.role, "daily_ops", "create");
  const canReadIssueReports = hasPermission(user.role, "issue_reports", "read");
  const canManageChangeFund = user.role === "ADMIN" || user.role === "MANAGER";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Daily Operations"
        description="Track opening and closing stock counts, branch issue reporting, and next-day change fund targets."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description={`${overview.branches.length.toLocaleString("en-US")} accessible branch${overview.branches.length === 1 ? "" : "es"} today`}
          label="Opening counts submitted"
          tone={openingSubmitted === overview.branches.length ? "success" : "warning"}
          value={openingSubmitted.toLocaleString("en-US")}
        />
        <StatCard
          description={`${overview.branches.length.toLocaleString("en-US")} accessible branch${overview.branches.length === 1 ? "" : "es"} today`}
          label="Closing counts submitted"
          tone={closingSubmitted === overview.branches.length ? "success" : "warning"}
          value={closingSubmitted.toLocaleString("en-US")}
        />
        <StatCard
          description="Submitted counts that still show stock discrepancies."
          label="Branches with discrepancies"
          tone={discrepancyBranchCount > 0 ? "warning" : "success"}
          value={discrepancyBranchCount.toLocaleString("en-US")}
        />
        <StatCard
          description="Issue reports that are still open or acknowledged."
          label="Pending issue reports"
          tone={overview.openIssueCount > 0 ? "warning" : "primary"}
          value={overview.openIssueCount.toLocaleString("en-US")}
        />
      </section>

      {discrepancyBranchCount > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
          <p className="text-sm font-medium text-warning">
            {discrepancyBranchCount === 1
              ? "1 branch has stock discrepancies from submitted counts."
              : `${discrepancyBranchCount} branches have stock discrepancies from submitted counts.`}
          </p>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {canCreateCounts && (
          <Link
            className="rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
            href="/dashboard/daily-ops/stock-count"
          >
            <h2 className="text-lg font-semibold text-slate-950">Stock Counts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Save draft opening or closing counts and submit discrepancies for admin review.
            </p>
          </Link>
        )}

        {canReadIssueReports && (
          <Link
            className="rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
            href="/dashboard/daily-ops/issue-reports"
          >
            <h2 className="text-lg font-semibold text-slate-950">Issue Reports</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review branch issues, acknowledge them, and mark them resolved inside the system.
            </p>
          </Link>
        )}

        {canManageChangeFund && (
          <Link
            className="rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
            href="/dashboard/daily-ops/change-fund"
          >
            <h2 className="text-lg font-semibold text-slate-950">Change Fund</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Set the cash target that should stay in the register for tomorrow&apos;s change.
            </p>
          </Link>
        )}
      </section>
    </div>
  );
}
