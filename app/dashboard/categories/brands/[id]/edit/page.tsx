import { notFound } from "next/navigation";
import { updateBrandAction } from "@/lib/actions/brands";
import { requirePermission } from "@/lib/dal/auth";
import { getBrandById } from "@/lib/dal/brands";
import { PageHeader } from "@/components/ui/page-header";
import { BrandForm } from "@/components/brands/brand-form";

type EditBrandPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditBrandPage({ params }: EditBrandPageProps) {
  await requirePermission("categories", "update");
  const { id } = await params;
  const brand = await getBrandById(id);

  if (!brand) {
    notFound();
  }

  const boundUpdateAction = updateBrandAction.bind(null, brand.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog Structure"
        title={`Edit ${brand.name}`}
        description="Keep brand naming and descriptions clean so the catalog stays understandable across product and inventory workflows."
      />

      <BrandForm
        action={boundUpdateAction}
        brand={{
          id: brand.id,
          name: brand.name,
          description: brand.description,
        }}
        mode="edit"
      />
    </div>
  );
}
