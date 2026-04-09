import Link from "next/link";
import type { LocationType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { LocationActiveToggle } from "@/components/locations/location-active-toggle";

type LocationRow = {
  id: string;
  name: string;
  code: string;
  type: LocationType;
  isActive: boolean;
  address: string | null;
  managerName: string | null;
  updatedAt: Date;
  _count: {
    stock: number;
  };
};

type LocationsTableProps = {
  locations: LocationRow[];
  canManage: boolean;
  returnTo: string;
};

function getTypeBadgeClass(type: LocationType) {
  return type === "WAREHOUSE"
    ? "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]"
    : "border-[#e3d6fb] bg-[#f5efff] text-[#5f3ca2]";
}

function getTypeLabel(type: LocationType) {
  return type === "WAREHOUSE" ? "Warehouse" : "Branch";
}

export function LocationsTable({
  locations,
  canManage,
  returnTo,
}: LocationsTableProps) {
  if (locations.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/65 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No locations found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Create a warehouse or branch to give inventory and sales activity a real operating site.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/85 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/70">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Code</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Products in stock</th>
              <th className="px-5 py-4">Manager</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {locations.map((location) => (
              <tr key={location.id} className="align-top">
                <td className="px-5 py-4">
                  <Link
                    className="font-semibold text-slate-950 transition hover:text-primary"
                    href={`/dashboard/locations/${location.id}`}
                  >
                    {location.name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">
                    {location.address?.trim() || "No address provided."}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm font-medium uppercase tracking-[0.12em] text-slate-600">
                  {location.code}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getTypeBadgeClass(location.type)}`}
                  >
                    {getTypeLabel(location.type)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {location.isActive ? (
                    <span className="inline-flex items-center rounded-full border border-[#c5e7db] bg-[#edf8f4] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#11664b]">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {location._count.stock.toLocaleString("en-US")}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {location.managerName?.trim() || "No manager assigned."}
                  <p className="mt-1 text-xs text-slate-400">
                    Updated{" "}
                    {location.updatedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <Link href={`/dashboard/locations/${location.id}`}>
                      <Button variant="outline">View</Button>
                    </Link>

                    {canManage ? (
                      <Link href={`/dashboard/locations/${location.id}/edit`}>
                        <Button variant="outline">Edit</Button>
                      </Link>
                    ) : null}

                    {canManage ? (
                      <LocationActiveToggle
                        isActive={location.isActive}
                        locationId={location.id}
                        locationName={location.name}
                        returnTo={returnTo}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
