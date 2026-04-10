import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, Store } from "lucide-react";
import { bulkStockSetupAction } from "@/lib/actions/inventory";
import { requirePermission } from "@/lib/dal/auth";
import {
  getStockSetupLocations,
  getStockSetupPageData,
} from "@/lib/dal/inventory";
import { BulkStockSetupForm } from "@/components/inventory/bulk-stock-setup-form";
import { PageHeader } from "@/components/ui/page-header";

type StockSetupPageProps = {
  searchParams: Promise<{
    locationId?: string;
  }>;
};

export default async function StockSetupPage({
  searchParams,
}: StockSetupPageProps) {
  const user = await requirePermission("inventory", "update");

  if (user.role === "SALES_STAFF") {
    redirect("/dashboard/inventory");
  }

  const params = await searchParams;
  const locationId = params.locationId;

  // Step 1: No location selected — show location picker
  if (!locationId) {
    const locations = await getStockSetupLocations();

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Bulk Stock Entry"
          title="Stock Setup"
          description="Set stock quantities in bulk for a warehouse or branch. Ideal for new locations, system migration, or bulk stock loading."
          action={
            <Link
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              href="/dashboard/inventory"
            >
              <ArrowLeft className="size-4" strokeWidth={2.1} />
              Back to Inventory
            </Link>
          }
        />

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
          Select a location to begin. All products in the catalog will be listed
          so you can set their stock quantities in one go.
        </div>

        {locations.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {locations.map((location) => {
              const Icon =
                location.type === "WAREHOUSE" ? Building2 : Store;

              return (
                <Link
                  className="group block rounded-[20px] border border-slate-200 bg-slate-50/70 p-5 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
                  href={`/dashboard/inventory/stock-setup?locationId=${location.id}`}
                  key={location.id}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600">
                      <Icon className="size-4" strokeWidth={2.1} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {location.name}
                      </h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {location.code} · {location.type}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-8 text-center text-sm leading-6 text-slate-500">
            No active locations found. Create a warehouse or branch first.
          </div>
        )}
      </div>
    );
  }

  // Step 2: Location selected — show bulk entry table
  const { location, products } = await getStockSetupPageData(locationId);

  if (!location) {
    redirect("/dashboard/inventory/stock-setup");
  }

  const LocationIcon = location.type === "WAREHOUSE" ? Building2 : Store;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bulk Stock Entry"
        title="Stock Setup"
        description={`Set stock quantities for all products at this location. Only products with changed quantities will be saved.`}
        action={
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            href="/dashboard/inventory/stock-setup"
          >
            <ArrowLeft className="size-4" strokeWidth={2.1} />
            Change Location
          </Link>
        }
      />

      {/* Location badge */}
      <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600">
          <LocationIcon className="size-4" strokeWidth={2.1} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {location.name}
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {location.code} · {location.type}
          </p>
        </div>
      </div>

      {products.length > 0 ? (
        <BulkStockSetupForm
          action={bulkStockSetupAction}
          locationId={location.id}
          locationName={location.name}
          products={products}
        />
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-8 text-center text-sm leading-6 text-slate-500">
          No active products found in the catalog. Add products before setting up
          stock.
        </div>
      )}
    </div>
  );
}
