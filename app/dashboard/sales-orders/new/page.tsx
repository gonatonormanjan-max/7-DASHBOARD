import { createSalesOrderAction } from "@/lib/actions/sales-orders";
import { requirePermission } from "@/lib/dal/auth";
import { getSalesOrderById, getSalesOrderFormOptions } from "@/lib/dal/sales-orders";
import { PageHeader } from "@/components/ui/page-header";
import { SalesOrderForm } from "@/components/sales-orders/sales-order-form";

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
  await requirePermission("sales_orders", "create");
  const resolvedSearchParams = await searchParams;
  const from = readParam(resolvedSearchParams.from);
  const { products, locations } = await getSalesOrderFormOptions();

  let initialValues:
    | {
        locationId?: string;
        customerName?: string;
        customerEmail?: string;
        notes?: string;
        items?: Array<{
          productId: string;
          quantity: number;
          unitPrice: string;
        }>;
      }
    | undefined;

  if (from) {
    const sourceOrder = await getSalesOrderById(from);

    if (sourceOrder) {
      initialValues = {
        locationId: sourceOrder.items[0]?.location.id,
        customerName: sourceOrder.customerName,
        customerEmail: sourceOrder.customerEmail ?? undefined,
        notes: sourceOrder.notes ?? undefined,
        items: sourceOrder.items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
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
            ? "This draft starts with the details from an existing order so you can reuse the same customer and line items."
            : "Create a branch sales order draft, then move it through confirmation, delivery, and completion from the detail page."
        }
      />

      <SalesOrderForm
        action={createSalesOrderAction}
        initialValues={initialValues}
        locations={locations}
        products={products}
      />
    </div>
  );
}
