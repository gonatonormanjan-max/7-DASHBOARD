import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCategoryAction } from "@/lib/actions/categories";
import { requirePermission } from "@/lib/dal/auth";
import { getCategoryById } from "@/lib/dal/categories";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { DetailField } from "@/components/ui/detail-field";
import { PageHeader } from "@/components/ui/page-header";

type CategoryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const user = await requirePermission("categories", "read");
  const { id } = await params;
  const category = await getCategoryById(id);

  if (!category) {
    notFound();
  }

  const canManage = hasPermission(user.role, "categories", "update");
  const canDelete =
    hasPermission(user.role, "categories", "delete") && category._count.products === 0;
  const deleteAction = deleteCategoryAction.bind(null, category.id, `/dashboard/categories/${category.id}`);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Category Detail"
        title={category.name}
        description="This category shapes catalog organization today and becomes a reporting and workflow anchor as more modules come online."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {canManage ? (
              <Link href={`/dashboard/categories/${category.id}/edit`}>
                <Button variant="outline">Edit category</Button>
              </Link>
            ) : null}

            {canDelete ? (
              <form action={deleteAction}>
                <ConfirmSubmitButton
                  confirmMessage={`Delete ${category.name}? This cannot be undone.`}
                  pendingLabel="Deleting..."
                  variant="outline"
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Category name" value={category.name} />
            <DetailField label="Linked products" value={String(category._count.products)} />
            <DetailField
              label="Description"
              value={category.description?.trim() || "No description provided."}
            />
            <DetailField
              label="Delete readiness"
              value={
                category._count.products === 0
                  ? "This category can be deleted."
                  : "Remove or reassign linked products before deleting this category."
              }
            />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Recent linked products</h2>
            <div className="mt-4 space-y-3">
              {category.products.length > 0 ? (
                category.products.map((product) => (
                  <Link
                    key={product.id}
                    className="block rounded-[20px] border border-slate-200 bg-slate-50/80 p-4 transition hover:border-slate-300 hover:bg-white"
                    href={`/dashboard/products/${product.id}`}
                  >
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{product.sku}</p>
                  </Link>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  No products are using this category yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Record activity</h2>
            <div className="mt-4 space-y-4">
              <DetailField
                label="Created"
                value={category.createdAt.toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
              <DetailField
                label="Last updated"
                value={category.updatedAt.toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
