import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";
import { getKitComponentCandidateProducts, getKitComponents } from "@/lib/dal/kits";
import { getProductById } from "@/lib/dal/products";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { KitComponentsManager } from "@/components/kits/kit-components-manager";

type KitComponentsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function KitComponentsPage({ params }: KitComponentsPageProps) {
  const user = await requirePermission("products", "update");

  if (user.role !== "ADMIN" && user.role !== "SYSTEM_MANAGER") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const [product, existingComponents, componentOptions] = await Promise.all([
    getProductById(id),
    getKitComponents(id),
    getKitComponentCandidateProducts(id),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Product Detail"
        title={`Manage Kit Components for ${product.name}`}
        description="Define which component products are recovered when this kit is dismantled at a branch."
        action={
          <Link href={`/dashboard/products/${product.id}`}>
            <Button variant="outline">Back to Product</Button>
          </Link>
        }
      />

      <KitComponentsManager
        componentOptions={componentOptions}
        existingComponents={existingComponents}
        kitProductId={product.id}
      />
    </div>
  );
}
