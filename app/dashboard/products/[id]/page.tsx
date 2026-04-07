import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveProductAction, restoreProductAction } from "@/lib/actions/products";
import { requirePermission } from "@/lib/dal/auth";
import { getProductById } from "@/lib/dal/products";
import { formatCurrency } from "@/lib/products";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { DetailField } from "@/components/ui/detail-field";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const user = await requirePermission("products", "read");
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const canManage = hasPermission(user.role, "products", "update");
  const archiveAction = archiveProductAction.bind(null, product.id, `/dashboard/products/${product.id}`);
  const restoreAction = restoreProductAction.bind(null, product.id, `/dashboard/products/${product.id}`);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Product Detail"
        title={product.name}
        description="This shared catalog record controls how the product appears in future transaction flows. Stock and warehouse behavior are managed separately."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {canManage && product.status !== "ARCHIVED" ? (
              <Link href={`/dashboard/products/${product.id}/edit`}>
                <Button variant="outline">Edit product</Button>
              </Link>
            ) : null}

            {canManage && product.status !== "ARCHIVED" ? (
              <form action={archiveAction}>
                <ConfirmSubmitButton
                  confirmMessage={`Archive ${product.name}? Archived products are hidden from default lists.`}
                  pendingLabel="Archiving..."
                  variant="outline"
                >
                  Archive
                </ConfirmSubmitButton>
              </form>
            ) : null}

            {canManage && product.status === "ARCHIVED" ? (
              <form action={restoreAction}>
                <ConfirmSubmitButton
                  confirmMessage={`Restore ${product.name} to Active status?`}
                  pendingLabel="Restoring..."
                  variant="outline"
                >
                  Restore
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
          <div className="flex flex-wrap items-center gap-3">
            <ProductStatusBadge status={product.status} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {product.sku}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Category" value={product.category.name} />
            <DetailField label="Supplier" value={product.supplier?.name ?? "Unassigned"} />
            <DetailField label="Unit price" value={formatCurrency(product.unitPrice.toString())} />
            {canManage ? (
              <DetailField label="Cost" value={formatCurrency(product.costPrice.toString())} />
            ) : null}
            <DetailField
              label="Reorder Alert Level"
              value={`${String(product.reorderLevel)} units`}
            />
            <DetailField label="Image URL" value={product.imageUrl ?? "Not set"} />
            <DetailField
              label="Description"
              value={product.description?.trim() ? product.description : "No description provided."}
            />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Catalog rules</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>Sales Staff can view this record but cannot edit it.</p>
              <p>No stock, warehouse, per-store availability, or variant fields exist in this module.</p>
              <p>Archived products are hidden from default list views and should be excluded from new transactions.</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Record activity</h2>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <DetailField
                label="Created"
                value={product.createdAt.toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
              <DetailField
                label="Last updated"
                value={product.updatedAt.toLocaleString("en-US", {
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
