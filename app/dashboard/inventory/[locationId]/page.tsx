import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductStatus } from "@prisma/client";
import { adjustInventoryAction, transferInventoryAction } from "@/lib/actions/inventory";
import { requirePermission } from "@/lib/dal/auth";
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
import { InventoryAdjustmentForm } from "@/components/inventory/inventory-adjustment-form";
import { InventoryLowStockTab } from "@/components/inventory/inventory-low-stock-tab";
import { InventoryMovementsTab } from "@/components/inventory/inventory-movements-tab";
import { InventoryStockTab } from "@/components/inventory/inventory-stock-tab";
import { InventoryTransferForm } from "@/components/inventory/inventory-transfer-form";
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
  const [inventoryData, manageOptions] = await Promise.all([
    getInventoryPageData({
      ...filters,
      locationId,
    }),
    canManageHere
      ? Promise.all([
          prisma.product.findMany({
            where: {
              status: {
                in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE],
              },
            },
            orderBy: {
              name: "asc",
            },
            select: {
              id: true,
              name: true,
              sku: true,
            },
          }),
          prisma.stockLocation.findMany({
            where: {
              isActive: true,
            },
            orderBy: {
              name: "asc",
            },
            select: {
              id: true,
              name: true,
              code: true,
            },
          }),
        ]).then(([products, locations]) => ({ products, locations }))
      : Promise.resolve({
          products: [] as Array<{ id: string; name: string; sku: string }>,
          locations: [] as Array<{ id: string; name: string; code: string }>,
        }),
  ]);

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
          <Link href="/dashboard/inventory">
            <Button variant="outline">All Locations</Button>
          </Link>
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

      <section
        className={
          canManage ? "grid gap-6 xl:grid-cols-[1.45fr_0.85fr]" : "space-y-6"
        }
      >
        <div className="space-y-6">
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
        </div>

        {canManage ? (
          <aside className="space-y-6">
            {canManageHere ? (
              <>
                <InventoryAdjustmentForm
                  action={adjustInventoryAction}
                  initialLocationId={location?.id}
                  locations={manageOptions.locations}
                  products={manageOptions.products}
                  returnTo={currentHref}
                />
                <InventoryTransferForm
                  action={transferInventoryAction}
                  initialFromLocationId={location?.id}
                  locations={manageOptions.locations}
                  products={manageOptions.products}
                  returnTo={currentHref}
                />
              </>
            ) : (
              <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
                <h2 className="text-lg font-semibold text-slate-950">
                  Inventory changes disabled
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This location is inactive. Reactivate it from the Locations module before
                  recording adjustments or transfers here.
                </p>
              </div>
            )}
          </aside>
        ) : null}
      </section>
    </div>
  );
}
