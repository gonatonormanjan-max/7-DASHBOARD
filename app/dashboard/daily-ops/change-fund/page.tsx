import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setChangeFundAllocationAction } from "@/lib/actions/daily-ops";
import { requirePermission } from "@/lib/dal/auth";
import { getAccessibleDailyOpsBranches, getChangeFundAllocation } from "@/lib/dal/daily-ops";
import { formatCurrency } from "@/lib/products";
import { formatDateTimeMNL } from "@/lib/timezone";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

type ChangeFundPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChangeFundPage({ searchParams }: ChangeFundPageProps) {
  const user = await requirePermission("daily_ops", "create");

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const rawSearchParams = await searchParams;
  const branches = await getAccessibleDailyOpsBranches(user);

  if (branches.length === 0) {
    notFound();
  }

  const selectedBranchId = firstString(rawSearchParams.branchId) ?? branches[0].id;
  const selectedBranch =
    branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const allocation = await getChangeFundAllocation(selectedBranch.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily Operations"
        title="Change Fund"
        description="Set the target cash amount that should remain at the branch for tomorrow&apos;s register change."
        action={
          <Link href="/dashboard/daily-ops">
            <Button variant="outline">Back to Daily Operations</Button>
          </Link>
        }
      />

      {user.role === "ADMIN" && branches.length > 1 && (
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <form action="/dashboard/daily-ops/change-fund" className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Branch</span>
              <select
                className="w-72 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                defaultValue={selectedBranch.id}
                name="branchId"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </label>

            <Button type="submit" variant="outline">
              Load Branch
            </Button>
          </form>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Current target</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {allocation ? formatCurrency(allocation.amount.toString()) : formatCurrency(0)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {allocation
              ? `Last updated ${formatDateTimeMNL(allocation.updatedAt)} by ${allocation.setBy.firstName} ${allocation.setBy.lastName}.`
              : "No change fund target has been recorded for this branch yet."}
          </p>
          {allocation?.notes ? (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {allocation.notes}
            </p>
          ) : null}
        </div>

        <form
          action={setChangeFundAllocationAction}
          className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <input name="branchId" type="hidden" value={selectedBranch.id} />

          <div>
            <h2 className="text-lg font-semibold text-slate-950">Update target</h2>
            <p className="mt-1 text-sm text-slate-500">
              Branch: {selectedBranch.name} ({selectedBranch.code})
            </p>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Amount (PHP)</span>
            <input
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={allocation?.amount.toString() ?? ""}
              min={0}
              name="amount"
              required
              step="0.01"
              type="number"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Notes</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={allocation?.notes ?? ""}
              maxLength={500}
              name="notes"
              placeholder="Optional context for this target amount."
            />
          </label>

          <div className="flex justify-end">
            <Button type="submit">Save Change Fund Target</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
