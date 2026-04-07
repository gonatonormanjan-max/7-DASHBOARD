import Link from "next/link";
import { deleteCategoryAction } from "@/lib/actions/categories";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date;
  _count: {
    products: number;
  };
};

type CategoriesTableProps = {
  categories: CategoryRow[];
  canManage: boolean;
  canDelete: boolean;
  returnTo: string;
};

export function CategoriesTable({
  categories,
  canManage,
  canDelete,
  returnTo,
}: CategoriesTableProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/65 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No categories found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Create a category to keep the catalog organized before suppliers and orders expand.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/85 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/70">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Description</th>
              <th className="px-5 py-4">Products</th>
              <th className="px-5 py-4">Updated</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {categories.map((category) => {
              const deleteAction = deleteCategoryAction.bind(null, category.id, returnTo);

              return (
                <tr key={category.id} className="align-top">
                  <td className="px-5 py-4">
                    <Link
                      className="font-semibold text-slate-950 transition hover:text-primary"
                      href={`/dashboard/categories/${category.id}`}
                    >
                      {category.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {category.description?.trim() || "No description provided."}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {category._count.products}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {category.updatedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Link href={`/dashboard/categories/${category.id}`}>
                        <Button variant="outline">View</Button>
                      </Link>

                      {canManage ? (
                        <Link href={`/dashboard/categories/${category.id}/edit`}>
                          <Button variant="outline">Edit</Button>
                        </Link>
                      ) : null}

                      {canDelete && category._count.products === 0 ? (
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
