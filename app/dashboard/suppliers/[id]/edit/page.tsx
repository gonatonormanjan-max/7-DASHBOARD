import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";
import { getSupplierByIdForEdit } from "@/lib/dal/suppliers";
import { updateSupplierAction } from "@/lib/actions/suppliers";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { PageHeader } from "@/components/ui/page-header";

type EditSupplierPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  await requirePermission("suppliers", "update");
  const { id } = await params;
  const supplier = await getSupplierByIdForEdit(id);

  if (!supplier) {
    notFound();
  }

  const boundAction = updateSupplierAction.bind(null, supplier.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title={`Edit ${supplier.name}`}
        description="Update contact information and status for this supplier."
      />

      <SupplierForm
        action={boundAction}
        cancelHref={`/dashboard/suppliers/${supplier.id}`}
        defaultValues={{
          name: supplier.name,
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isActive: supplier.isActive,
        }}
        submitLabel="Save Changes"
        pendingLabel="Saving..."
      />
    </div>
  );
}
