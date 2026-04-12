import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { getLocationListData } from "@/lib/dal/locations";
import { parseLocationListFilters } from "@/lib/validators/locations";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { LocationsFilters } from "@/components/locations/locations-filters";
import { LocationsTable } from "@/components/locations/locations-table";

type LocationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const user = await requirePermission("locations", "read");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: "/dashboard/locations",
  });
  const filters = parseLocationListFilters(await searchParams);
  const { locations, pagination, summary } = await getLocationListData(filters, {
    locationId: activeLocationId,
  });
  const canCreate = hasPermission(user.role, "locations", "create");
  const canManage = hasPermission(user.role, "locations", "update");
  const returnParams = new URLSearchParams();

  if (filters.query) returnParams.set("query", filters.query);
  if (filters.type !== "all") returnParams.set("type", filters.type);
  if (filters.isActive !== "all") returnParams.set("isActive", filters.isActive);
  if (filters.sortBy !== "updatedAt") returnParams.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") returnParams.set("sortOrder", filters.sortOrder);
  if (pagination.page !== 1) returnParams.set("page", String(pagination.page));
  if (pagination.pageSize !== DEFAULT_PAGE_SIZE) {
    returnParams.set("pageSize", String(pagination.pageSize));
  }

  const returnQuery = returnParams.toString();
  const returnTo = returnQuery ? `/dashboard/locations?${returnQuery}` : "/dashboard/locations";
  const headerDescription =
    user.role === "SALES_STAFF"
      ? "Your currently selected branch profile for today."
      : "Manage warehouse and branch locations where inventory is stored and sold.";

  return (
    <div className="space-y-8">
      {false ? (
        <PageHeader
        eyebrow="Infrastructure"
        title="Locations"
        action={
          canCreate ? (
            <Link href="/dashboard/locations/new">
              <Button>Create location</Button>
            </Link>
          ) : null
        }
        description="All stock locations — warehouses and store branches — registered in the system."
        />
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Infrastructure
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Locations
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            {headerDescription}
          </p>
        </div>
        {canCreate ? (
          <div>
            <Link href="/dashboard/locations/new">
              <Button>Create location</Button>
            </Link>
          </div>
        ) : null}
      </div>


      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Total active warehouses in the system."
          label="Warehouses"
          tone="primary"
          value={String(summary.warehouses)}
        />
        <StatCard
          description="Total active branches in the system."
          label="Branches"
          tone="success"
          value={String(summary.branches)}
        />
        <StatCard
          description="Inactive locations excluded from inventory workflows."
          label="Inactive"
          tone="warning"
          value={String(summary.inactive)}
        />
        <StatCard
          description="All registered locations in the system."
          label="Total"
          value={String(summary.total)}
        />
      </section>

      <LocationsFilters filters={filters} />

      <LocationsTable
        canManage={canManage}
        locations={locations}
        returnTo={returnTo}
      />

      <Pagination
        basePath="/dashboard/locations"
        itemLabel="locations"
        pagination={pagination}
        query={{
          query: filters.query || undefined,
          type: filters.type === "all" ? undefined : filters.type,
          isActive: filters.isActive === "all" ? undefined : filters.isActive,
          sortBy: filters.sortBy === "updatedAt" ? undefined : filters.sortBy,
          sortOrder: filters.sortOrder === "desc" ? undefined : filters.sortOrder,
          pageSize:
            pagination.pageSize === DEFAULT_PAGE_SIZE ? undefined : pagination.pageSize,
        }}
      />
    </div>
  );
}
