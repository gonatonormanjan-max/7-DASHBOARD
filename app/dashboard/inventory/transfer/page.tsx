import { transferInventoryAction } from "@/lib/actions/inventory";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { InventoryTransferForm } from "@/components/inventory/inventory-transfer-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function TransferInventoryPage() {
  await requirePermission("inventory", "update");

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
          locations={locations}
          products={products}
        />
      </div>
    </div>
  );
}
