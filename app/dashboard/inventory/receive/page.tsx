import { supplierReceiptAction } from "@/lib/actions/inventory";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { SupplierReceiptForm } from "@/components/inventory/supplier-receipt-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReceiveInventoryPage() {
  await requirePermission("inventory", "update");

  const [suppliers, warehouses, allProducts, supplierProductLinks] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.stockLocation.findMany({
      where: {
        isActive: true,
        type: "WAREHOUSE",
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
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
        costPrice: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.productSupplier.findMany({
      select: {
        supplierId: true,
        productId: true,
        costPrice: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory"
        title="Receive from Supplier"
        description="Record stock arriving from a supplier into a warehouse."
      />

      <SupplierReceiptForm
        action={supplierReceiptAction}
        allProducts={allProducts.map((product) => ({
          ...product,
          costPrice: product.costPrice.toString(),
        }))}
        supplierProductLinks={supplierProductLinks.map((link) => ({
          ...link,
          costPrice: link.costPrice.toString(),
        }))}
        suppliers={suppliers}
        warehouses={warehouses}
      />
    </div>
  );
}
