import { createSalesOrderAction } from "@/lib/actions/sales-orders";
import { requirePermission } from "@/lib/dal/auth";
import { getSalesOrderCreateData, getSalesOrderById } from "@/lib/dal/sales-orders";
import { SalesOrderFormRedesign as SalesOrderForm } from "@/components/sales-orders/sales-order-form-redesign";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission } from "@/lib/permissions";

type NewSalesOrderPageProps = {
  searchParams: Promise<{
    from?: string | string[];
    location?: string | string[];
    customerMode?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewSalesOrderPage({
  searchParams,
}: NewSalesOrderPageProps) {
  const user = await requirePermission("sales_orders", "create");
  const resolvedSearchParams = await searchParams;
  const isCashier = user.role === "SALES_STAFF";
  const lockedLocationId = isCashier ? (user.assignedLocationId ?? undefined) : undefined;
  const from = readParam(resolvedSearchParams.from);
  const rememberedLocationId = readParam(resolvedSearchParams.location);
  const rememberedCustomerMode = readParam(resolvedSearchParams.customerMode);
  const { products, locations, stockRows } = await getSalesOrderCreateData();

  // If duplicating from an existing order, load its data for prefill
  let prefill: {
    customerName?: string;
    customerEmail?: string;
    notes?: string;
    items?: Array<{
      productId: string;
      locationId: string;
      quantity: number;
      unitPrice: string;
    }>;
  } | undefined;

  if (from) {
    const sourceOrder = await getSalesOrderById(from);
    if (sourceOrder) {
      prefill = {
        customerName: sourceOrder.customerName,
        customerEmail: sourceOrder.customerEmail ?? undefined,
        notes: sourceOrder.notes ?? undefined,
        items: sourceOrder.items.map((item) => ({
          productId: item.product.id,
          locationId: item.location.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
        })),
      };
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily Transactions"
        title={prefill ? "Duplicate sale" : "Record sale"}
        description={
          prefill
            ? "This form is pre-filled from a previous order. Adjust details as needed and submit."
            : "Record completed purchases with a scan-first cart workflow. Each sale is completed immediately and deducts stock as soon as you submit."
        }
      />

      <SalesOrderForm
        action={createSalesOrderAction}
        products={products}
        stockRows={stockRows}
        locations={locations}
        prefill={prefill}
        lockedLocationId={lockedLocationId}
        pricesLocked={isCashier}
        rememberedDefaults={
          prefill
            ? undefined
            : {
                locationId: lockedLocationId ?? rememberedLocationId,
                customerMode:
                  rememberedCustomerMode === "named"
                    ? "named"
                    : "walk_in",
              }
        }
      />
    </div>
  );
}
