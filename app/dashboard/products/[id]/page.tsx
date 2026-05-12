import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveProductAction, restoreProductAction } from "@/lib/actions/products";
import {
  setLocationProductPriceAction,
  deleteLocationProductPriceAction,
} from "@/lib/actions/branch-pricing";
import { requirePermission } from "@/lib/dal/auth";
import { getKitComponents } from "@/lib/dal/kits";
import { getProductById } from "@/lib/dal/products";
import {
  getBranchPricesForProduct,
  getUnpricedBranchesForProduct,
} from "@/lib/dal/branch-pricing";
import { formatCurrency } from "@/lib/products";
import { hasPermission } from "@/lib/permissions";
import { formatDateMNL } from "@/lib/timezone";
import { PageHeader } from "@/components/ui/page-header";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { BranchPricingSection } from "@/components/products/branch-pricing-section";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { DetailField } from "@/components/ui/detail-field";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const user = await requirePermission("products", "read");
  const { id } = await params;

  const [product, existingPrices, unpricedBranches, kitComponents] = await Promise.all([
    getProductById(id),
    getBranchPricesForProduct(id, user),
    getUnpricedBranchesForProduct(id, user),
    getKitComponents(id),
  ]);

  if (!product) {
    notFound();
  }

  const canManage = hasPermission(user.role, "products", "update");
  const canManagePricing = hasPermission(user.role, "branch_pricing", "update");
  const canManageKitComponents = user.role === "ADMIN" || user.role === "SYSTEM_MANAGER";
  const canDismantleKit = user.role === "ADMIN" || user.role === "MANAGER";
  const productId = product.id;
  const returnTo = `/dashboard/products/${productId}`;

  async function archiveAction() {
    "use server";
    await archiveProductAction(productId, returnTo);
  }

  async function restoreAction() {
    "use server";
    await restoreProductAction(productId, returnTo);
  }

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
        <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <ProductStatusBadge status={product.status} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {product.sku}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Category" value={product.category.name} />
            <DetailField label="Brand" value={product.brand?.name ?? "Unbranded"} />
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

          <div className="border-t border-slate-200 pt-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-950">Suppliers</h2>
            </div>

            {product.suppliers.length === 0 ? (
              <p className="text-sm text-slate-500">No suppliers assigned.</p>
            ) : (
              <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50/80">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-white/70">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Cost Price</th>
                      <th className="px-4 py-3">Lead Time</th>
                      <th className="px-4 py-3">Primary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                    {product.suppliers.map((productSupplier) => (
                      <tr key={productSupplier.supplier.id}>
                        <td className="px-4 py-3">{productSupplier.supplier.name}</td>
                        <td className="px-4 py-3">
                          {formatCurrency(productSupplier.costPrice.toString())}
                        </td>
                        <td className="px-4 py-3">
                          {productSupplier.leadTimeDays !== null
                            ? `${productSupplier.leadTimeDays} days`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {productSupplier.isPrimary ? (
                            <span className="inline-flex items-center rounded-full bg-[#edf5ff] px-2.5 py-0.5 text-xs font-semibold text-[#16324b]">
                              Primary
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {kitComponents.length > 0 ? (
            <div className="border-t border-slate-200 pt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Kit Components</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Selling this product as a kit uses the kit SKU. Dismantling converts each
                    kit unit back into the component products below.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManageKitComponents ? (
                    <Link href={`/dashboard/products/${product.id}/kit-components`}>
                      <Button variant="outline">Manage Kit Components</Button>
                    </Link>
                  ) : null}
                  {canDismantleKit ? (
                    <Link href={`/dashboard/inventory/dismantle?kitProductId=${product.id}`}>
                      <Button variant="outline">Dismantle Stock</Button>
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50/80">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-white/70">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-4 py-3">Component</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Qty per kit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                    {kitComponents.map((component) => (
                      <tr key={component.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {component.componentProduct.name}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {component.componentProduct.sku}
                        </td>
                        <td className="px-4 py-3">{component.componentQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : canManageKitComponents ? (
            <div className="border-t border-slate-200 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Kit Components</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    This product is not currently configured as a kit.
                  </p>
                </div>
                <Link href={`/dashboard/products/${product.id}/kit-components`}>
                  <Button variant="outline">Manage Kit Components</Button>
                </Link>
              </div>
            </div>
          ) : null}

          {/* Branch-level price overrides — visible to anyone with branch_pricing read */}
          {hasPermission(user.role, "branch_pricing", "read") && (
            <BranchPricingSection
              productId={productId}
              productGlobalPrice={product.unitPrice.toString()}
              existingPrices={existingPrices}
              unpricedBranches={unpricedBranches}
              canManage={canManagePricing}
              setAction={setLocationProductPriceAction}
              deleteAction={deleteLocationProductPriceAction}
            />
          )}
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Activity</h2>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <span className="font-medium text-slate-700">Created</span>
              <span>{formatDateMNL(product.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <span className="font-medium text-slate-700">Last updated</span>
              <span>{formatDateMNL(product.updatedAt)}</span>
            </div>
          </div>

          <div className="pt-2">
            <Link href="/dashboard/products">
              <Button type="button" variant="ghost" className="w-full">
                ← Back to Products
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
