import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";
import { getPurchaseOrderById, getPurchaseOrderFormOptions } from "@/lib/dal/purchase-orders";
import { receivePurchaseOrderAction } from "@/lib/actions/purchase-orders";
import { PurchaseOrderReceiveForm } from "@/components/purchase-orders/po-receive-form";
import { PageHeader } from "@/components/ui/page-header";

type ReceivePurchaseOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReceivePurchaseOrderPage({
  params,
}: ReceivePurchaseOrderPageProps) {
  await requirePermission("purchase_orders", "receive");
  const { id } = await params;
  const [order, options] = await Promise.all([
    getPurchaseOrderById(id),
    getPurchaseOrderFormOptions(),
  ]);

  if (!order) {
    notFound();
  }

  if (order.status !== "APPROVED" && order.status !== "PARTIALLY_RECEIVED") {
    redirect(`/dashboard/purchase-orders/${id}`);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title={`Receive ${order.orderNumber}`}
        description="Record the stock that arrived for this purchase order and update warehouse inventory immediately."
      />

      <PurchaseOrderReceiveForm
        action={receivePurchaseOrderAction.bind(null, id)}
        items={order.items}
        warehouses={options.warehouses}
      />
    </div>
  );
}
