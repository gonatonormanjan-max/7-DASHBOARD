import Link from "next/link";
import { redirect } from "next/navigation";
import { correctReservedQtyAction } from "@/lib/actions/inventory";
import { requirePermission } from "@/lib/dal/auth";
import { getReserveCorrectionRows } from "@/lib/dal/inventory";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";

const RESERVE_CORRECTION_PATH = "/dashboard/inventory/reserve-correction";

export default async function ReserveCorrectionPage() {
  const user = await requirePermission("inventory", "update");

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const rows = await getReserveCorrectionRows();
  const ghostRowCount = rows.filter((row) => row.ghostQty > 0).length;
  const totalGhostQty = rows.reduce((sum, row) => sum + row.ghostQty, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory Admin"
        title="Reserve Correction"
        description="Review reserved stock against open confirmed orders and correct stale reservation values."
        action={
          <Link
            className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            href="/dashboard/inventory"
          >
            Back to Inventory
          </Link>
        }
      />

      <section className="rounded-lg border border-border bg-card p-4 text-sm text-slate-600 shadow-sm sm:p-5">
        <p>
          Showing <strong>{rows.length.toLocaleString("en-US")}</strong> location-stock row
          {rows.length === 1 ? "" : "s"} with non-zero reserved quantity.
        </p>
        <p className="mt-1">
          <strong>{ghostRowCount.toLocaleString("en-US")}</strong> row
          {ghostRowCount === 1 ? "" : "s"} have ghost reservation variance totaling{" "}
          <strong>{totalGhostQty.toLocaleString("en-US")}</strong> units.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No reserved stock to review</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Every location-stock row currently has zero reserved quantity.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-5 py-4">Location Name</th>
                  <th className="px-5 py-4">Product Name</th>
                  <th className="px-5 py-4">SKU</th>
                  <th className="px-5 py-4">On-Hand Qty</th>
                  <th className="px-5 py-4">Reserved Qty</th>
                  <th className="px-5 py-4">Open Confirmed Orders Qty</th>
                  <th className="px-5 py-4">Variance</th>
                  <th className="px-5 py-4">Available Qty</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => {
                  const varianceClass =
                    row.variance > 0
                      ? "text-red-700"
                      : row.variance < 0
                        ? "text-[#8a5610]"
                        : "text-[#11664b]";
                  const variancePrefix = row.variance > 0 ? "+" : "";
                  const proposedReservedQty = Math.min(
                    row.quantity,
                    row.openConfirmedOrdersQty
                  );

                  return (
                    <tr
                      key={row.id}
                      className={`align-top ${row.ghostQty > 0 ? "bg-red-50/40" : ""}`}
                    >
                      <td className="px-5 py-4 text-sm text-slate-700">{row.locationName}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {row.productName}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{row.sku}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.quantity.toLocaleString("en-US")}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.reservedQty.toLocaleString("en-US")}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.openConfirmedOrdersQty.toLocaleString("en-US")}
                      </td>
                      <td className={`px-5 py-4 text-sm font-semibold ${varianceClass}`}>
                        {variancePrefix}
                        {row.variance.toLocaleString("en-US")}
                        {row.ghostQty > 0 ? (
                          <span className="ml-2 inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700">
                            Ghost {row.ghostQty.toLocaleString("en-US")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.availableQty.toLocaleString("en-US")}
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        <details className="inline-block text-left">
                          <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-accent hover:text-accent-foreground">
                            Correct
                          </summary>
                          <form
                            action={correctReservedQtyAction}
                            className="mt-3 w-72 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                          >
                            <input name="locationStockId" type="hidden" value={row.id} />
                            <input
                              name="returnTo"
                              type="hidden"
                              value={RESERVE_CORRECTION_PATH}
                            />

                            <label className="block space-y-1 text-left">
                              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Correct Reserved Qty
                              </span>
                              <input
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                                defaultValue={proposedReservedQty}
                                max={row.quantity}
                                min={0}
                                name="newReservedQty"
                                required
                                type="number"
                              />
                              <p className="text-xs text-slate-500">
                                Must be between 0 and {row.quantity.toLocaleString("en-US")}.
                              </p>
                            </label>

                            <label className="block space-y-1 text-left">
                              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Reason
                              </span>
                              <textarea
                                className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                                maxLength={500}
                                name="reason"
                                placeholder="Explain why the reserved quantity is being corrected."
                                required
                              />
                            </label>

                            <div className="flex justify-end">
                              <SubmitButton pendingLabel="Correcting..." size="sm">
                                Save correction
                              </SubmitButton>
                            </div>
                          </form>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
