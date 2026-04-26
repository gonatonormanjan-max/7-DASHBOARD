import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { submitIssueReportAction } from "@/lib/actions/daily-ops";
import { requirePermission } from "@/lib/dal/auth";
import { getAccessibleDailyOpsBranches } from "@/lib/dal/daily-ops";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default async function NewIssueReportPage() {
  const user = await requirePermission("issue_reports", "create");
  const branches = await getAccessibleDailyOpsBranches(user);

  if (branches.length === 0) {
    notFound();
  }

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily Operations"
        title="New Issue Report"
        description="Write a branch issue directly to the admin review queue."
        action={
          <Link href="/dashboard/daily-ops/issue-reports">
            <Button variant="outline">Back to Issue Reports</Button>
          </Link>
        }
      />

      <form
        action={submitIssueReportAction}
        className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Branch</span>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:bg-slate-100"
            defaultValue={branches[0].id}
            disabled={user.role === "MANAGER"}
            name="branchId"
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Title</span>
          <input
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
            maxLength={120}
            name="title"
            placeholder="What needs attention?"
            required
            type="text"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Details</span>
          <textarea
            className="min-h-36 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
            maxLength={2000}
            name="body"
            placeholder="Describe the issue, its impact, and what help is needed."
            required
          />
        </label>

        <div className="flex justify-end">
          <Button type="submit">Submit Issue Report</Button>
        </div>
      </form>
    </div>
  );
}
