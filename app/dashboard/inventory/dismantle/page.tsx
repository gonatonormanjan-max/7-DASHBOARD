import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";
import { getKitDismantlePageData, getDismantleHistory } from "@/lib/dal/kits";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DismantleForm } from "@/components/kits/dismantle-form";

type DismantlePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DismantlePage({ searchParams }: DismantlePageProps) {
  const user = await requirePermission("inventory", "read");

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const rawSearchParams = await searchParams;
  const initialBranchId = firstString(rawSearchParams.locationId);
  const initialKitProductId = firstString(rawSearchParams.kitProductId);
  const { branches, kits, branchScope } = await getKitDismantlePageData(user);
  const history = await getDismantleHistory(branchScope ?? undefined);

  if (branches.length === 0) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory"
        title="Dismantle Kit Stock"
        description="Convert kit stock back into its component products using a fully-audited branch inventory workflow."
        action={
          <Link href="/dashboard/inventory">
            <Button variant="outline">Back to Inventory</Button>
          </Link>
        }
      />

      {kits.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No kits are ready to dismantle</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Configure kit components on a product before using the dismantle workflow.
          </p>
        </div>
      ) : (
        <DismantleForm
          branchLocked={Boolean(branchScope)}
          branches={branches}
          initialBranchId={initialBranchId}
          initialKitProductId={initialKitProductId}
          kits={kits}
        />
      )}

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-950">Recent dismantles</h2>
          <p className="mt-1 text-sm text-slate-500">
            Most recent kit-to-component conversions recorded in the system.
          </p>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No dismantle activity has been recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Kit</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {history.slice(0, 10).map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.kitProduct.name}
                    </td>
                    <td className="px-4 py-3">{row.location.name}</td>
                    <td className="px-4 py-3">{row.qty}</td>
                    <td className="px-4 py-3">
                      {row.dismantledBy.firstName} {row.dismantledBy.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
