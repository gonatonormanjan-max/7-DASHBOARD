import { redirect } from "next/navigation";
import { initialStockAction } from "@/lib/actions/inventory";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { InitialStockForm } from "@/components/inventory/initial-stock-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function InitialStockPage() {
  const user = await requirePermission("inventory", "update");

  if (user.role === "SALES_STAFF") {
    redirect("/dashboard/inventory");
  }

  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: {
          in: ["ACTIVE", "INACTIVE"],
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.stockLocation.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Data Migration"
        title="Load Opening Stock"
        description="Enter initial stock quantities for products at each location. This creates INITIAL_STOCK movements for a clean ledger starting point."
      />

      <InitialStockForm action={initialStockAction} locations={locations} products={products} />
    </div>
  );
}
