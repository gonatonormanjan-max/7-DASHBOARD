import Link from "next/link";
import { requirePermission } from "@/lib/dal/auth";
import { getIssueReports } from "@/lib/dal/daily-ops";
import { updateIssueReportStatusAction } from "@/lib/actions/daily-ops";
import { hasPermission } from "@/lib/permissions";
import { formatDateTimeMNL } from "@/lib/timezone";
import { parseIssueReportStatusFilter } from "@/lib/validators/daily-ops";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

type IssueReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IssueReportsPage({ searchParams }: IssueReportsPageProps) {
  const user = await requirePermission("issue_reports", "read");
  const rawSearchParams = await searchParams;
  const statusFilter = parseIssueReportStatusFilter(rawSearchParams);
  const reports = await getIssueReports(user, statusFilter);
  const canCreate = hasPermission(user.role, "issue_reports", "create");
  const canUpdate = hasPermission(user.role, "issue_reports", "update");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily Operations"
        title="Issue Reports"
        description={
          canUpdate
            ? "Track branch-reported issues, acknowledge them, and mark them resolved."
            : "Monitor the status of issue reports raised from your branch."
        }
        action={
          canCreate ? (
            <Link href="/dashboard/daily-ops/issue-reports/new">
              <Button>New Report</Button>
            </Link>
          ) : null
        }
      />

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <form action="/dashboard/daily-ops/issue-reports" className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Status</span>
            <select
              className="w-56 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={statusFilter}
              name="status"
            >
              <option value="all">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </label>

          <Button type="submit" variant="outline">
            Apply filter
          </Button>
        </form>
      </section>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No issue reports found</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            There are no issue reports matching the current filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Updated</th>
                  {canUpdate ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-slate-900">{report.title}</p>
                      <p className="mt-1 max-w-xl text-slate-500">{report.body}</p>
                    </td>
                    <td className="px-4 py-3 align-top">{report.branch.name}</td>
                    <td className="px-4 py-3 align-top">{report.status}</td>
                    <td className="px-4 py-3 align-top">
                      <div>{report.submittedBy.firstName} {report.submittedBy.lastName}</div>
                      <div className="text-slate-500">{formatDateTimeMNL(report.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-500">
                      {formatDateTimeMNL(report.updatedAt)}
                    </td>
                    {canUpdate ? (
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-2">
                          {report.status === "OPEN" && (
                            <form action={updateIssueReportStatusAction}>
                              <input name="issueReportId" type="hidden" value={report.id} />
                              <input name="status" type="hidden" value="ACKNOWLEDGED" />
                              <Button size="sm" type="submit" variant="outline">
                                Acknowledge
                              </Button>
                            </form>
                          )}

                          {report.status !== "RESOLVED" && (
                            <form action={updateIssueReportStatusAction}>
                              <input name="issueReportId" type="hidden" value={report.id} />
                              <input name="status" type="hidden" value="RESOLVED" />
                              <Button size="sm" type="submit">
                                Resolve
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
