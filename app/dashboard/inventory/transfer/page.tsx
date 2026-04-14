import { transferInventoryAction } from "@/lib/actions/inventory";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { InventoryTransferForm } from "@/components/inventory/inventory-transfer-form";
import { PageHeader } from "@/components/ui/page-header";

type TransferInventoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveSingleSearchValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function TransferInventoryPage({
  searchParams,
}: TransferInventoryPageProps) {
  await requirePermission("inventory", "update");
  const resolvedSearchParams = await searchParams;
  const initialFromLocationId =
    resolveSingleSearchValue(resolvedSearchParams.fromLocationId) || undefined;
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
        title="Stock Transfer"
        description="Move stock between active locations using the dedicated transfer workflow."
      />

      <div className="max-w-2xl">
        <InventoryTransferForm
          action={transferInventoryAction}
          initialFromLocationId={initialFromLocationId}
          locations={locations}
          products={products}
          returnTo={returnTo.startsWith("/dashboard/inventory") ? returnTo : undefined}
        />
      </div>
    </div>
  );
}
