import { adjustInventoryAction } from "@/lib/actions/inventory";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { InventoryAdjustmentForm } from "@/components/inventory/inventory-adjustment-form";
import { PageHeader } from "@/components/ui/page-header";

type AdjustmentInventoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveSingleSearchValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdjustmentInventoryPage({
  searchParams,
}: AdjustmentInventoryPageProps) {
  await requirePermission("inventory", "update");
  const resolvedSearchParams = await searchParams;
  const initialLocationId =
    resolveSingleSearchValue(resolvedSearchParams.locationId) || undefined;
  const returnTo = resolveSingleSearchValue(resolvedSearchParams.returnTo);

  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: {
          in: ["ACTIVE", "INACTIVE"],
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
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory"
        title="Manual Adjustment"
        description="Correct stock counts with an auditable reason, direction, and note."
      />

      <div className="max-w-2xl">
        <InventoryAdjustmentForm
          action={adjustInventoryAction}
          initialLocationId={initialLocationId}
          locations={locations}
          products={products}
          returnTo={returnTo.startsWith("/dashboard/inventory") ? returnTo : undefined}
        />
      </div>
    </div>
  );
}
