import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { AdjustmentRequestForm } from "@/components/inventory/adjustment-request-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewAdjustmentRequestPage() {
  const user = await requirePermission("adjustment_requests", "create");

  // Only MANAGER submits requests via this page.
  // ADMIN / SYSTEM_MANAGER use the direct adjustment form.
  if (user.role !== "MANAGER") {
    redirect("/dashboard/inventory/adjustment");
  }

  if (!user.assignedLocationId) {
    redirect("/dashboard");
  }

  // Fetch products available at the manager's branch
  const products = await prisma.product.findMany({
    where: {
      status: { in: ["ACTIVE", "INACTIVE"] },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      locationStock: {
        where: { locationId: user.assignedLocationId },
        select: { quantity: true, reservedQty: true },
      },
    },
  });

  const branch = await prisma.stockLocation.findUnique({
    where: { id: user.assignedLocationId },
    select: { id: true, name: true },
  });

  if (!branch) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory"
        title="Request Stock Adjustment"
        description={`Submit an adjustment request for ${branch.name}. This will be reviewed and approved by an admin before taking effect.`}
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">
          <span className="font-medium">Pending admin approval.</span> Your request will not affect
          stock until an administrator reviews and approves it.
        </p>
      </div>

      <div className="max-w-2xl">
        <AdjustmentRequestForm
          products={products}
          branchId={branch.id}
          branchName={branch.name}
        />
      </div>
    </div>
  );
}
