import { createBrandAction } from "@/lib/actions/brands";
import { requirePermission } from "@/lib/dal/auth";
import { PageHeader } from "@/components/ui/page-header";
import { BrandForm } from "@/components/brands/brand-form";

export default async function NewBrandPage() {
  await requirePermission("categories", "create");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog Structure"
        title="Create brand"
        description="Add a reusable brand so products can be grouped consistently by manufacturer or label."
      />

      <BrandForm action={createBrandAction} mode="create" />
    </div>
  );
}
