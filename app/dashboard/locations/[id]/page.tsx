import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMovementTypeLabel } from "@/lib/inventory";
import { hasPermission } from "@/lib/permissions";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getLocationById } from "@/lib/dal/locations";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/ui/detail-field";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { LocationActiveToggle } from "@/components/locations/location-active-toggle";

type LocationDetailPageProps = {
  params: Promise<{ id: string }>;
};

function getTypeBadgeClass(type: "WAREHOUSE" | "BRANCH") {
  return type === "WAREHOUSE"
    ? "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]"
    : "border-[#e3d6fb] bg-[#f5efff] text-[#5f3ca2]";
}

function getTypeLabel(type: "WAREHOUSE" | "BRANCH") {
  return type === "WAREHOUSE" ? "Warehouse" : "Branch";
}

function getMovementBadgeClass(type: string) {
  if (type.includes("TRANSFER")) {
    return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
  }

  if (type.includes("RETURN")) {
    return "border-[#e3d6fb] bg-[#f5efff] text-[#5f3ca2]";
  }

  if (type.includes("DAMAGED") || type.includes("LOST")) {
    return "border-[#f3c7c7] bg-[#fff1f1] text-[#991b1b]";
  }

  if (type.includes("ADJUSTMENT")) {
    return "border-[#f2d2a2] bg-[#fff4e4] text-[#8a5610]";
  }

  return "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]";
}

export default async function LocationDetailPage({ params }: LocationDetailPageProps) {
  const user = await requirePermission("locations", "read");
  const { id } = await params;
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/locations/${id}`,
  });

  if (user.role === "SALES_STAFF" && activeLocationId && id !== activeLocationId) {
    redirect(`/dashboard/locations/${activeLocationId}`);
  }

  const location = await getLocationById(id);

  if (!location) {
    notFound();
  }

  const canManage = hasPermission(user.role, "locations", "update");
  const returnTo = `/dashboard/locations/${location.id}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Location Detail"
        title={location.name}
        description="Review the operating profile for this site together with its top stock rows and most recent inventory activity."
        action={
          canManage ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/dashboard/locations/${location.id}/edit`}>
                <Button variant="outline">Edit location</Button>
              </Link>
              <LocationActiveToggle
                isActive={location.isActive}
                locationId={location.id}
                locationName={location.name}
                returnTo={returnTo}
                variant="outline"
              />
            </div>
          ) : null
        }
      />

      <section className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getTypeBadgeClass(location.type)}`}
          >
            {getTypeLabel(location.type)}
          </span>
          {location.isActive ? (
            <span className="inline-flex items-center rounded-full border border-[#c5e7db] bg-[#edf8f4] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#11664b]">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Inactive
            </span>
          )}
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            {location.code}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Location name" value={location.name} />
          <DetailField label="Code" value={location.code} />
          <DetailField label="Type" value={getTypeLabel(location.type)} />
          <DetailField
            label="Address"
            value={location.address?.trim() || "No address provided."}
          />
          <DetailField
            label="Manager"
            value={location.managerName?.trim() || "No manager assigned."}
          />
          <DetailField
            label="Contact number"
            value={location.contactNumber?.trim() || "No contact number provided."}
          />
          <DetailField
            label="Created"
            value={location.createdAt.toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          />
          <DetailField
            label="Last updated"
            value={location.updatedAt.toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          />
          <DetailField
            label="Status"
            value={location.isActive ? "Active" : "Inactive"}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          description="Distinct products with positive on-hand quantity at this location."
          label="Products in stock"
          tone="primary"
          value={String(location.stockSummary.skuCount)}
        />
        <StatCard
          description="Total units currently recorded on hand at this site."
          label="Total on-hand"
          tone="success"
          value={location.stockSummary.totalOnHand.toLocaleString("en-US")}
        />
        <StatCard
          description="Units currently reserved against stock held at this location."
          label="Total reserved"
          tone="warning"
          value={location.stockSummary.totalReserved.toLocaleString("en-US")}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Top stock rows</h2>
          <p className="mt-1 text-sm text-slate-500">
            The first 20 products at this location, ordered alphabetically so stock health is easy
            to scan.
          </p>
        </div>

        {location.stock.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/70">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <th className="px-5 py-4">Product Name</th>
                    <th className="px-5 py-4">SKU</th>
                    <th className="px-5 py-4">On Hand</th>
                    <th className="px-5 py-4">Reserved</th>
                    <th className="px-5 py-4">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {location.stock.map((row) => {
                    const available = row.quantity - row.reservedQty;
                    const isOut = available <= 0;
                    const isLow =
                      !isOut &&
                      row.product.reorderLevel > 0 &&
                      available <= row.product.reorderLevel;

                    return (
                      <tr
                        key={row.id}
                        className={
                          isOut
                            ? "bg-[#fff1f1]"
                            : isLow
                              ? "bg-[#fff8eb]"
                              : ""
                        }
                      >
                        <td className="px-5 py-4">
                          <Link
                            className="font-semibold text-slate-950 transition hover:text-primary"
                            href={`/dashboard/products/${row.product.id}`}
                          >
                            {row.product.name}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{row.product.sku}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {row.quantity.toLocaleString("en-US")}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {row.reservedQty.toLocaleString("en-US")}
                        </td>
                        <td
                          className={`px-5 py-4 text-sm font-semibold ${
                            isOut
                              ? "text-destructive"
                              : isLow
                                ? "text-[#8a5610]"
                                : "text-[#11664b]"
                          }`}
                        >
                          {available.toLocaleString("en-US")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-slate-900">No stock rows yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This location has not recorded any inventory rows yet.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Recent movements</h2>
          <p className="mt-1 text-sm text-slate-500">
            The 10 most recent inventory events recorded against this site.
          </p>
        </div>

        {location.movements.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/70">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Product</th>
                    <th className="px-5 py-4">Qty Change</th>
                    <th className="px-5 py-4">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {location.movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {movement.createdAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <p className="mt-1 text-xs text-slate-400">
                          {movement.createdAt.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getMovementBadgeClass(movement.type)}`}
                        >
                          {getMovementTypeLabel(movement.type)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{movement.product.name}</p>
                        <p className="mt-1 text-slate-500">{movement.product.sku}</p>
                      </td>
                      <td
                        className={`px-5 py-4 text-sm font-semibold ${
                          movement.quantityChange < 0
                            ? "text-destructive"
                            : "text-[#11664b]"
                        }`}
                      >
                        {movement.quantityChange > 0 ? "+" : ""}
                        {movement.quantityChange.toLocaleString("en-US")}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {movement.performedBy.firstName} {movement.performedBy.lastName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-slate-900">No movement records yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Inventory activity at this location will appear here once adjustments, transfers, or
              sales start flowing through.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
