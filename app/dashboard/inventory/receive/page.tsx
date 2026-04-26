import Link from "next/link";
import { supplierReceiptAction } from "@/lib/actions/inventory";
import { receivePurchaseOrderAction } from "@/lib/actions/purchase-orders";
import {
  getPurchaseOrderById,
  getPurchaseOrderFormOptions,
  getPurchaseOrdersAwaitingReceipt,
} from "@/lib/dal/purchase-orders";
import { formatDateMNL } from "@/lib/timezone";
import { requirePermission } from "@/lib/dal/auth";
import { Button } from "@/components/ui/button";
import { SupplierReceiptForm } from "@/components/inventory/supplier-receipt-form";
import { PurchaseOrderReceiveForm } from "@/components/purchase-orders/po-receive-form";
import { PurchaseOrderStatusBadge } from "@/components/purchase-orders/po-status-badge";
import { PageHeader } from "@/components/ui/page-header";

type ReceiveInventoryPageProps = {
  searchParams: Promise<{
    purchaseOrderId?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPurchaseOrderBlockCopy(
  selectedOrder:
    | Awaited<ReturnType<typeof getPurchaseOrderById>>
    | null
    | undefined
) {
  if (!selectedOrder) {
    return {
      title: "Purchase order not found",
      description:
        "The purchase order you selected could not be found. Choose another order from the receiving queue or go back to procurement.",
      ctaHref: "/dashboard/purchase-orders",
      ctaLabel: "View purchase orders",
    };
  }

  switch (selectedOrder.status) {
    case "DRAFT":
      return {
        title: `${selectedOrder.orderNumber} is still a draft`,
        description:
          "Approve this purchase order before receiving stock so the warehouse intake stays tied to an approved supplier commitment.",
        ctaHref: `/dashboard/purchase-orders/${selectedOrder.id}`,
        ctaLabel: "Review purchase order",
      };
    case "RECEIVED":
      return {
        title: `${selectedOrder.orderNumber} is already fully received`,
        description:
          "All ordered stock has already been posted into inventory for this purchase order. Review the receiving history from the order detail page.",
        ctaHref: `/dashboard/purchase-orders/${selectedOrder.id}`,
        ctaLabel: "Open order history",
      };
    case "CANCELLED":
      return {
        title: `${selectedOrder.orderNumber} was cancelled`,
        description:
          "Cancelled purchase orders cannot receive stock. Re-open the procurement flow with a new approved order if the supplier is still delivering.",
        ctaHref: `/dashboard/purchase-orders/${selectedOrder.id}`,
        ctaLabel: "Open purchase order",
      };
    default:
      return {
        title: `${selectedOrder.orderNumber} is not ready for receipt`,
        description:
          "This purchase order is not in a receivable state. Review the workflow details before posting stock to inventory.",
        ctaHref: `/dashboard/purchase-orders/${selectedOrder.id}`,
        ctaLabel: "Review purchase order",
      };
  }
}

export default async function ReceiveInventoryPage({
  searchParams,
}: ReceiveInventoryPageProps) {
  await requirePermission("inventory", "update");

  const resolvedSearchParams = await searchParams;
  const selectedPurchaseOrderId = readParam(resolvedSearchParams.purchaseOrderId)?.trim();

  const [options, queuedPurchaseOrders, selectedOrder] = await Promise.all([
    getPurchaseOrderFormOptions(),
    getPurchaseOrdersAwaitingReceipt(8),
    selectedPurchaseOrderId ? getPurchaseOrderById(selectedPurchaseOrderId) : Promise.resolve(null),
  ]);

  const selectedOrderIsReceivable =
    selectedOrder?.status === "APPROVED" || selectedOrder?.status === "PARTIALLY_RECEIVED";
  const selectedOrderRemainingUnits =
    selectedOrder?.items.reduce(
      (sum, item) => sum + Math.max(item.quantity - item.receivedQty, 0),
      0
    ) ?? 0;
  const blockedOrder = selectedPurchaseOrderId && !selectedOrderIsReceivable
    ? getPurchaseOrderBlockCopy(selectedOrder)
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory"
        title="Receive from Supplier"
        description="Receive stock into a warehouse from an approved purchase order or record a direct supplier delivery when no PO exists."
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Preferred path
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            Receive against a purchase order
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use this when the supplier delivery belongs to an approved PO. It updates on-hand
            inventory and advances procurement status in one transaction.
          </p>
          <p className="mt-4 text-sm font-medium text-slate-700">
            {queuedPurchaseOrders.length} purchase order
            {queuedPurchaseOrders.length === 1 ? "" : "s"} ready for receipt.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Exception path
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            Record a direct supplier receipt
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use this only when stock arrives without a purchase order. The receipt still
            updates inventory immediately, but it will not advance a procurement workflow.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Purchase order receiving queue
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Start receipts from here so the warehouse intake and purchase order lifecycle stay in
              sync.
            </p>
          </div>
          {selectedOrder ? (
            <Link href={`/dashboard/purchase-orders/${selectedOrder.id}`}>
              <Button variant="outline">Open selected purchase order</Button>
            </Link>
          ) : null}
        </div>

        {selectedOrder && selectedOrderIsReceivable ? (
          <div className="space-y-6 rounded-[20px] border border-[#d7e5f5] bg-[#f6faff] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold text-slate-950">
                    Receive {selectedOrder.orderNumber}
                  </h3>
                  <PurchaseOrderStatusBadge status={selectedOrder.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Supplier: <span className="font-medium">{selectedOrder.supplier.name}</span>
                  {" · "}
                  Remaining units:{" "}
                  <span className="font-medium">{selectedOrderRemainingUnits}</span>
                  {selectedOrder.expectedDate
                    ? ` · Expected ${formatDateMNL(selectedOrder.expectedDate)}`
                    : ""}
                </p>
              </div>
              <Link href="/dashboard/inventory/receive">
                <Button type="button" variant="outline">
                  Clear selection
                </Button>
              </Link>
            </div>

            <PurchaseOrderReceiveForm
              action={receivePurchaseOrderAction.bind(null, selectedOrder.id)}
              items={selectedOrder.items}
              warehouses={options.warehouses}
            />
          </div>
        ) : blockedOrder ? (
          <div className="rounded-[20px] border border-[#f2d2a2] bg-[#fff4e4] p-5">
            <h3 className="text-lg font-semibold text-slate-950">{blockedOrder.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {blockedOrder.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={blockedOrder.ctaHref}>
                <Button variant="outline">{blockedOrder.ctaLabel}</Button>
              </Link>
              <Link href="/dashboard/inventory/receive">
                <Button type="button">Back to receiving queue</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {queuedPurchaseOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-500">
            No approved purchase orders are waiting for receipt right now.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {queuedPurchaseOrders.map((order) => (
              <div
                key={order.id}
                className={`rounded-[20px] border p-5 ${
                  selectedOrder?.id === order.id
                    ? "border-[#b9d2ef] bg-[#f6faff]"
                    : "border-slate-200 bg-slate-50/70"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{order.orderNumber}</h3>
                    <p className="mt-1 text-sm text-slate-600">{order.supplier.name}</p>
                  </div>
                  <PurchaseOrderStatusBadge status={order.status} />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {order.remainingUnits} unit{order.remainingUnits === 1 ? "" : "s"} remaining
                  across {order.remainingLines} open line
                  {order.remainingLines === 1 ? "" : "s"}.
                  {order.expectedDate
                    ? ` Expected ${formatDateMNL(order.expectedDate)}.`
                    : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/dashboard/purchase-orders/${order.id}`}>
                    <Button type="button" variant="outline">
                      View PO
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Direct supplier receipt</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Use this fallback only for supplier deliveries that do not have a purchase order.
          </p>
        </div>

        <SupplierReceiptForm
          action={supplierReceiptAction}
          allProducts={options.products}
          description="Receive stock directly into a warehouse when the delivery did not originate from a purchase order."
          referencePlaceholder="Delivery receipt, supplier invoice, or manual reference"
          supplierProductLinks={options.supplierProductLinks}
          suppliers={options.suppliers}
          title="Direct supplier receipt"
          warehouses={options.warehouses}
        />
      </section>
    </div>
  );
}

