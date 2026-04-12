import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";

type ReceivePurchaseOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReceivePurchaseOrderPage({
  params,
}: ReceivePurchaseOrderPageProps) {
  await requirePermission("purchase_orders", "receive");
  const { id } = await params;
  redirect(`/dashboard/inventory/receive?purchaseOrderId=${id}`);
}
