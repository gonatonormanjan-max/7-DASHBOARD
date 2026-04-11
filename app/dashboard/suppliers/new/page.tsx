import { requirePermission } from "@/lib/dal/auth";
import { createSupplierAction } from "@/lib/actions/suppliers";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewSupplierPage() {
  await requirePermission("suppliers", "create");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title="New Supplier"
        description="Add a supplier to the directory. You can link products to this supplier later or during purchase order creation."
      />

      <SupplierForm
        action={createSupplierAction}
        cancelHref="/dashboard/suppliers"
        submitLabel="Create Supplier"
        pendingLabel="Creating..."
      />
    </div>
  );
}
