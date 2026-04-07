import { createCategoryAction } from "@/lib/actions/categories";
import { requirePermission } from "@/lib/dal/auth";
import { PageHeader } from "@/components/ui/page-header";
import { CategoryForm } from "@/components/categories/category-form";

export default async function NewCategoryPage() {
  await requirePermission("categories", "create");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog Structure"
        title="Create category"
        description="Add a reusable category so products stay organized across the shared catalog and future reporting."
      />

      <CategoryForm action={createCategoryAction} mode="create" />
    </div>
  );
}
