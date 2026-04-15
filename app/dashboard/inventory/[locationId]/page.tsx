import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getInventoryPageData } from "@/lib/dal/inventory";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  parseInventoryFilters,
  parseInventoryTab,
  type InventoryPageFilters,
  type InventoryStockSortField,
  type InventoryTab,
} from "@/lib/validators/inventory";
import { InventoryLowStockTab } from "@/components/inventory/inventory-low-stock-tab";
import { InventoryMovementsTab } from "@/components/inventory/inventory-movements-tab";
import { InventoryStockTab } from "@/components/inventory/inventory-stock-tab";
import { LocationInventoryFilters } from "@/components/inventory/location-inventory-filters";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { TabToggle } from "@/components/ui/tab-toggle";

type LocationInventoryPageProps = {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type InventoryLocationQueryState = InventoryPageFilters & {
  tab: InventoryTab;
};

function buildInventoryLocationHref(
  locationId: string,
  state: InventoryLocationQueryState
) {
  const params = new URLSearchParams();

  if (state.tab !== "stock") params.set("tab", state.tab);
  if (state.query) params.set("query", state.query);
  if (state.categoryId) params.set("categoryId", state.categoryId);
  if (state.brandId) params.set("brandId", state.brandId);
  if (state.movementType !== "all") params.set("movementType", state.movementType);
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);
  if (state.sortBy !== "name") params.set("sortBy", state.sortBy);
  if (state.sortOrder !== "asc") params.set("sortOrder", state.sortOrder);
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(state.pageSize));
  }

  const query = params.toString();
  const basePath = `/dashboard/inventory/${locationId}`;

  return query ? `${basePath}?${query}` : basePath;
}

export default async function LocationInventoryPage({
  params,
  searchParams,
}: LocationInventoryPageProps) {
  const user = await requirePermission("inventory", "read");
  const [{ locationId }, rawSearchParams] = await Promise.all([params, searchParams]);
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/inventory/${locationId}`,
  });

  if (user.role === "SALES_STAFF" && activeLocationId && locationId !== activeLocationId) {
    redirect(`/dashboard/inventory/${activeLocationId}`);
  }

  const tab = parseInventoryTab(rawSearchParams);
  const filters = parseInventoryFilters(rawSearchParams);
  const canManage = hasPermission(user.role, "inventory", "update");
  const location =
    locationId === "system-wide"
      ? null
      : await prisma.stockLocation.findUnique({
          where: {
            id: locationId,
          },
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            isActive: true,
          },
        });

  if (locationId !== "system-wide" && !location) {
    notFound();
  }

  const canManageHere = canManage && (locationId === "system-wide" || location!.isActive);
  const currentState: InventoryLocationQueryState = {
    ...filters,
    tab,
  };
  const buildHref = (overrides: Partial<InventoryLocationQueryState> = {}) =>
    buildInventoryLocationHref(locationId, {
      ...currentState,
      ...overrides,
    });
  const inventoryData = await getInventoryPageData({
    ...filters,
    locationId,
  });

  function buildSortHref(field: InventoryStockSortField) {
    return buildHref({
      tab: "stock",
      page: 1,
      sortBy: field,
      sortOrder:
        filters.sortBy === field && filters.sortOrder === "desc" ? "asc" : "desc",
    });
  }

  const eyeBrow = location ? location.name : "System-Wide";
  const description = location
    ? `Monitor current stock, recent movements, and reorder pressure for ${location.name}.`
    : "Review aggregated inventory across every active warehouse and branch.";
  const clearHref = buildHref({
    page: 1,
    query: "",
    categoryId: undefined,
    brandId: undefined,
    movementType: "all",
    dateFrom: undefined,
    dateTo: undefined,
    sortBy: "name",
    sortOrder: "asc",
  });
  const currentHref = buildHref();
  const manageRouteParams = new URLSearchParams({
    returnTo: currentHref,
  });

  if (location?.id) {
    manageRouteParams.set("locationId", location.id);
    manageRouteParams.set("fromLocationId", location.id);
  }

  const adjustmentHref = `/dashboard/inventory/adjustment?${manageRouteParams.toString()}`;
  const transferHref = `/dashboard/inventory/transfer?${manageRouteParams.toString()}`;
  const tabs = [
    {
      label: "Current Stock",
      href: buildHref({ tab: "stock", page: 1 }),
      active: tab === "stock",
    },
    {
      label: "Movement Ledger",
      href: buildHref({ tab: "movements", page: 1 }),
      active: tab === "movements",
    },
    {
      label: "Low Stock",
      href: buildHref({ tab: "low-stock", page: 1 }),
      active: tab === "low-stock",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={eyeBrow}
        title="Inventory"
        description={description}
        action={
          user.role !== "SALES_STAFF" ? (
            <Link href="/dashboard/inventory">
              <Button variant="outline">All Locations</Button>
            </Link>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Visible product rows with positive on-hand quantity in this view."
          label="SKUs in stock"
          tone="primary"
          value={String(inventoryData.summary.skuCount)}
        />
        <StatCard
          description="Total units currently recorded on hand for the filtered stock view."
          label="On-hand units"
          tone="success"
          value={inventoryData.summary.onHandUnits.toLocaleString("en-US")}
        />
        <StatCard
          description="Filtered rows at or below reorder level after reserved stock is considered."
          label="Low-stock rows"
          tone="warning"
          value={String(inventoryData.summary.lowStockCount)}
        />
        <StatCard
          description="Filtered rows with no available stock remaining."
          label="Out of stock"
          value={String(inventoryData.summary.outOfStockCount)}
        />
      </section>

      <TabToggle tabs={tabs} />

      <LocationInventoryFilters
        actionPath={`/dashboard/inventory/${locationId}`}
        brands={inventoryData.options.brands}
        categories={inventoryData.options.categories}
        clearHref={clearHref}
        filters={filters}
        tab={tab}
      />

      <section className="space-y-6">
        {tab === "stock" ? (
          <InventoryStockTab
            buildSortHref={buildSortHref}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            stockRows={inventoryData.stockRows}
          />
        ) : null}

        {tab === "movements" ? (
          <>
            <InventoryMovementsTab
              movements={inventoryData.movements}
              showLocation={locationId === "system-wide"}
            />

            <Pagination
              basePath={`/dashboard/inventory/${locationId}`}
              itemLabel="movements"
              pagination={inventoryData.movementPagination}
              query={{
                tab: "movements",
                query: filters.query || undefined,
                categoryId: filters.categoryId,
                brandId: filters.brandId,
                movementType:
                  filters.movementType === "all" ? undefined : filters.movementType,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                sortBy: filters.sortBy === "name" ? undefined : filters.sortBy,
                sortOrder: filters.sortOrder === "asc" ? undefined : filters.sortOrder,
                pageSize:
                  filters.pageSize === DEFAULT_PAGE_SIZE
                    ? undefined
                    : filters.pageSize,
              }}
            />
          </>
        ) : null}

        {tab === "low-stock" ? (
          <InventoryLowStockTab lowStockRows={inventoryData.lowStockRows} />
        ) : null}

        {canManage ? (
          canManageHere ? (
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Inventory operations</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Manual adjustment and stock transfer are now available as dedicated inventory
                pages for a cleaner workflow.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={adjustmentHref}>
                  <Button variant="outline">Open Manual Adjustment</Button>
                </Link>
                <Link href={transferHref}>
                  <Button variant="outline">Open Stock Transfer</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Inventory changes disabled
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                This location is inactive. Reactivate it from the Locations module before
                recording adjustments or transfers.
              </p>
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
