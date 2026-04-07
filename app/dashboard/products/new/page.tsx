import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getProductFormOptions } from "@/lib/dal/products";
import { createProductAction } from "@/lib/actions/products";
import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "@/components/products/product-form";

export default async function NewProductPage() {
  const user = await requirePermission("products", "create");
  const { categories, suppliers } = await getProductFormOptions();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog Setup"
        title="Create product"
        description="Add a product to the shared global catalog. This module intentionally excludes stock quantities, warehouse edits, image upload, and product variants."
      />

      <ProductForm
        action={createProductAction}
        canCreateCategory={hasPermission(user.role, "categories", "create")}
        categories={categories}
        mode="create"
        suppliers={suppliers}
      />
    </div>
  );
}
