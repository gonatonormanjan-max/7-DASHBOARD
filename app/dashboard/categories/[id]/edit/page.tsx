import { notFound } from "next/navigation";
import { updateCategoryAction } from "@/lib/actions/categories";
import { requirePermission } from "@/lib/dal/auth";
import { getCategoryById } from "@/lib/dal/categories";
import { PageHeader } from "@/components/ui/page-header";
import { CategoryForm } from "@/components/categories/category-form";

type EditCategoryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  await requirePermission("categories", "update");
  const { id } = await params;
  const category = await getCategoryById(id);

  if (!category) {
    notFound();
  }

  const boundUpdateAction = updateCategoryAction.bind(null, category.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog Structure"
        title={`Edit ${category.name}`}
        description="Keep category naming and descriptions clean so reporting and downstream workflows stay understandable."
      />

      <CategoryForm
        action={boundUpdateAction}
        category={{
          id: category.id,
          name: category.name,
          description: category.description,
        }}
        mode="edit"
      />
    </div>
  );
}
