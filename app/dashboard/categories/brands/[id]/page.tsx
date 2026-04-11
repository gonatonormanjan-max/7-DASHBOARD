import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getBrandById } from "@/lib/dal/brands";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { DetailField } from "@/components/ui/detail-field";

type BrandDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  const user = await requirePermission("categories", "read");
  const { id } = await params;
  const brand = await getBrandById(id);

  if (!brand) {
    notFound();
  }

  const canManage = hasPermission(user.role, "categories", "update");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Brand Detail"
        title={brand.name}
        description="This brand groups products by manufacturer or label across the shared catalog."
        action={
          canManage ? (
            <Link href={`/dashboard/categories/brands/${brand.id}/edit`}>
              <Button variant="outline">Edit brand</Button>
            </Link>
          ) : null
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Brand name" value={brand.name} />
            <DetailField label="Linked products" value={String(brand._count.products)} />
            <DetailField
              label="Description"
              value={brand.description?.trim() || "No description provided."}
            />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Record activity</h2>
            <div className="mt-4 space-y-4">
              <DetailField
                label="Created"
                value={brand.createdAt.toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
              <DetailField
                label="Last updated"
                value={brand.updatedAt.toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
            </div>
          </div>
        </aside>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-950">Linked products</h2>
          <p className="mt-1 text-sm text-slate-500">
            Products currently assigned to this brand.
          </p>
        </div>

        {brand.products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">SKU</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {brand.products.map((product) => (
                  <tr key={product.id} className="align-top">
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold text-slate-950 transition hover:text-primary"
                        href={`/dashboard/products/${product.id}`}
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{product.sku}</td>
                    <td className="px-5 py-4">
                      <ProductStatusBadge status={product.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/dashboard/products/${product.id}`}>
                        <Button variant="outline">View product</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <h3 className="text-lg font-semibold text-slate-900">No linked products</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Products assigned to this brand will appear here once the catalog is updated.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
