import { createSalesOrderAction } from "@/lib/actions/sales-orders";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getSalesOrderById, getSalesOrderFormOptions } from "@/lib/dal/sales-orders";
import { PageHeader } from "@/components/ui/page-header";
import { SalesOrderFormRedesign } from "@/components/sales-orders/sales-order-form-redesign";

type NewSalesOrderPageProps = {
  searchParams: Promise<{
    from?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewSalesOrderPage({
  searchParams,
}: NewSalesOrderPageProps) {
  const user = await requirePermission("sales_orders", "create");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: "/dashboard/sales-orders/create/new",
  });
  const resolvedSearchParams = await searchParams;
  const from = readParam(resolvedSearchParams.from);
  const { products, locations, stockRows } = await getSalesOrderFormOptions({
    locationId: activeLocationId,
  });
  const lockedLocationId = locations.some(
    (location) => location.id === activeLocationId
  )
    ? activeLocationId ?? undefined
    : undefined;

  let initialValues:
    | {
        customerName?: string;
        customerEmail?: string;
        notes?: string;
        items?: Array<{
          productId: string;
          locationId: string;
          quantity: number;
          unitPrice: string;
        }>;
      }
    | undefined;

  if (from) {
    const sourceOrder = await getSalesOrderById(from, {
      locationId: activeLocationId,
    });

    if (sourceOrder) {
      initialValues = {
        customerName: sourceOrder.customerName,
        customerEmail: sourceOrder.customerEmail ?? undefined,
        notes: sourceOrder.notes ?? undefined,
        items: sourceOrder.items.map((item) => ({
          productId: item.product.id,
          locationId: item.location.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sales"
        title={initialValues ? "Duplicate Sales Order" : "New Sales Order"}
        description={
          initialValues
            ? "Start from an existing sale, then adjust the cart, payment, or customer details before saving or recording."
            : "Build a clean customer cart, save a draft when details are still incomplete, or review and record the sale in one flow."
        }
      />

      <SalesOrderFormRedesign
        action={createSalesOrderAction}
        lockedLocationId={lockedLocationId}
        locations={locations}
        products={products}
        stockRows={stockRows}
        prefill={initialValues}
      />
    </div>
  );
}
