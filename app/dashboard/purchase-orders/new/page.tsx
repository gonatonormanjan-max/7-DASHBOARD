import { createPurchaseOrderAction } from "@/lib/actions/purchase-orders";
import { requirePermission } from "@/lib/dal/auth";
import { getPurchaseOrderFormOptions } from "@/lib/dal/purchase-orders";
import { PurchaseOrderForm } from "@/components/purchase-orders/po-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewPurchaseOrderPage() {
  await requirePermission("purchase_orders", "create");
  const options = await getPurchaseOrderFormOptions();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title="New Purchase Order"
        description="Create a draft purchase order using the same inventory and audit workflow patterns already used across the dashboard."
      />

      <PurchaseOrderForm
        action={createPurchaseOrderAction}
        products={options.products.map((product) => ({
          ...product,
          costPrice: product.costPrice.toString(),
        }))}
        supplierProductLinks={options.supplierProductLinks.map((link) => ({
          ...link,
          costPrice: link.costPrice.toString(),
        }))}
        suppliers={options.suppliers}
        warehouses={options.warehouses}
      />
    </div>
  );
}
