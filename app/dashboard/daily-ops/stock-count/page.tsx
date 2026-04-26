import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";
import { getAccessibleDailyOpsBranches, getTodayStockCount } from "@/lib/dal/daily-ops";
import { getTodayBusinessDateInput } from "@/lib/validators/daily-ops";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StockCountForm } from "@/components/daily-ops/stock-count-form";

type StockCountPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StockCountPage({ searchParams }: StockCountPageProps) {
  const user = await requirePermission("daily_ops", "create");
  const rawSearchParams = await searchParams;
  const branches = await getAccessibleDailyOpsBranches(user);

  if (branches.length === 0) {
    notFound();
  }

  const selectedBranchId = firstString(rawSearchParams.locationId) ?? branches[0].id;
  const selectedType =
    firstString(rawSearchParams.type) === "CLOSING" ? "CLOSING" : "OPENING";
  const countData = await getTodayStockCount(selectedBranchId, selectedType);
  const selectedBranch =
    branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];

  if (!countData) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily Operations"
        title="Stock Count"
        description="Record today&apos;s opening or closing physical stock count for a branch."
        action={
          <Link href="/dashboard/daily-ops">
            <Button variant="outline">Back to Daily Operations</Button>
          </Link>
        }
      />

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <form action="/dashboard/daily-ops/stock-count" className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Branch</span>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:bg-slate-100"
              defaultValue={selectedBranch.id}
              disabled={branches.length === 1}
              name="locationId"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Count type</span>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={selectedType}
              name="type"
            >
              <option value="OPENING">Opening</option>
              <option value="CLOSING">Closing</option>
            </select>
          </label>

          <div className="flex items-end">
            <Button type="submit" variant="outline">
              Load Count
            </Button>
          </div>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          Count date: <strong>{getTodayBusinessDateInput()}</strong>
        </p>
      </section>

      {countData.lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No stock rows to count</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This branch does not currently have any stocked products to include in today&apos;s
            {selectedType === "OPENING" ? " opening" : " closing"} count.
          </p>
        </div>
      ) : (
        <StockCountForm
          countDate={countData.countDate}
          countId={countData.count?.id}
          lines={countData.lines}
          locationId={countData.location.id}
          status={countData.count?.status ?? "NEW"}
          type={selectedType}
        />
      )}
    </div>
  );
}
