import Link from "next/link";
import { notFound } from "next/navigation";
import { restoreProductAction, updateProductAction } from "@/lib/actions/products";
import { requirePermission } from "@/lib/dal/auth";
import { getProductById, getProductFormOptions } from "@/lib/dal/products";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "@/components/products/product-form";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const user = await requirePermission("products", "update");
  const { id } = await params;
  const [product, options] = await Promise.all([
    getProductById(id),
    getProductFormOptions(),
  ]);

  if (!product) {
    notFound();
  }

  if (product.status === "ARCHIVED") {
    const restoreAction = restoreProductAction.bind(null, product.id, `/dashboard/products/${product.id}`);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Product Locked"
          title={`${product.name} is archived`}
          description="Archived products are intentionally locked from editing. Restore the record first if you need to make changes."
        />

        <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
          <div className="flex flex-wrap items-center gap-3">
            <ProductStatusBadge status={product.status} />
            <span className="text-sm text-slate-600">{product.sku}</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <form action={restoreAction}>
              <ConfirmSubmitButton
                confirmMessage={`Restore ${product.name} to Active status?`}
                pendingLabel="Restoring..."
              >
                Restore product
              </ConfirmSubmitButton>
            </form>
            <Link href={`/dashboard/products/${product.id}`}>
              <Button type="button" variant="outline">
                Back to details
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const boundUpdateAction = updateProductAction.bind(null, product.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog Maintenance"
        title={`Edit ${product.name}`}
        description="Update core catalog fields only. Inventory quantities, warehouse assignments, and availability controls stay outside this module."
      />

      <ProductForm
        action={boundUpdateAction}
        canCreateCategory={hasPermission(user.role, "categories", "create")}
        categories={options.categories}
        mode="edit"
        product={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          categoryId: product.categoryId,
          supplierId: product.supplierId,
          unitPrice: product.unitPrice.toString(),
          costPrice: product.costPrice.toString(),
          reorderLevel: product.reorderLevel,
          imageUrl: product.imageUrl,
          description: product.description,
          status: product.status,
        }}
        suppliers={options.suppliers}
      />
    </div>
  );
}
