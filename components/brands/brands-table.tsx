import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandDeleteButton } from "@/components/brands/brand-delete-button";

type BrandRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: {
    products: number;
  };
};

type BrandsTableProps = {
  brands: BrandRow[];
  canManage: boolean;
  canDelete: boolean;
};

function getDescriptionPreview(description: string | null) {
  const value = description?.trim() || "No description provided.";

  if (value.length <= 60) {
    return value;
  }

  return `${value.slice(0, 57).trimEnd()}...`;
}

export function BrandsTable({
  brands,
  canManage,
  canDelete,
}: BrandsTableProps) {
  if (brands.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No brands found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Create a brand to keep manufacturer and label naming consistent across the
          shared catalog.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <th className="px-5 py-4">Brand</th>
              <th className="px-5 py-4">Description</th>
              <th className="px-5 py-4">Products</th>
              <th className="px-5 py-4">Created</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {brands.map((brand) => (
              <tr key={brand.id} className="align-top">
                <td className="px-5 py-4">
                  <Link
                    className="font-semibold text-slate-950 transition hover:text-primary"
                    href={`/dashboard/categories/brands/${brand.id}`}
                  >
                    {brand.name}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {getDescriptionPreview(brand.description)}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{brand._count.products}</td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {brand.createdAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <Link href={`/dashboard/categories/brands/${brand.id}`}>
                      <Button variant="outline">View</Button>
                    </Link>

                    {canManage ? (
                      <Link href={`/dashboard/categories/brands/${brand.id}/edit`}>
                        <Button variant="outline">Edit</Button>
                      </Link>
                    ) : null}

                    {canDelete && brand._count.products === 0 ? (
                      <BrandDeleteButton brandId={brand.id} brandName={brand.name} />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
