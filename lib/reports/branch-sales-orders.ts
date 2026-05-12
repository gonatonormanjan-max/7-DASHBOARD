import type { SalesOrderStatus } from "@prisma/client";
import { BRANCH_SALES_ORDER_STATUS_OPTIONS } from "@/lib/validators/reports";

export type BranchSalesOrderLineItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type BranchSalesOrderRow = {
  id: string;
  salesOrderId: string;
  orderNumber: string;
  createdAt: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  customerName: string;
  status: SalesOrderStatus;
  paymentMode: string | null;
  units: number;
  branchSubtotal: number;
  createdByName: string;
  detailHref: string;
  lineItems: BranchSalesOrderLineItem[];
};

export type BranchSalesOrderStatusCount = {
  status: SalesOrderStatus;
  count: number;
};

export type BranchSalesOrderReportSourceItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  product: {
    name: string;
    sku: string;
  };
  location: {
    id: string;
    name: string;
    code: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
    status: SalesOrderStatus;
    paymentMode: string | null;
    createdAt: string;
    createdByName: string;
  };
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildBranchSalesOrderReportRows(
  items: BranchSalesOrderReportSourceItem[]
) {
  const rowsByKey = new Map<string, BranchSalesOrderRow>();

  for (const item of items) {
    const lineTotal = roundCurrency(item.quantity * item.unitPrice);
    const key = `${item.salesOrder.id}:${item.location.id}`;
    const existing = rowsByKey.get(key);
    const lineItem: BranchSalesOrderLineItem = {
      id: item.id,
      productName: item.product.name,
      sku: item.product.sku,
      quantity: item.quantity,
      unitPrice: roundCurrency(item.unitPrice),
      lineTotal,
    };

    if (existing) {
      existing.units += item.quantity;
      existing.branchSubtotal = roundCurrency(existing.branchSubtotal + lineTotal);
      existing.lineItems.push(lineItem);
      continue;
    }

    rowsByKey.set(key, {
      id: key,
      salesOrderId: item.salesOrder.id,
      orderNumber: item.salesOrder.orderNumber,
      createdAt: item.salesOrder.createdAt,
      branchId: item.location.id,
      branchName: item.location.name,
      branchCode: item.location.code,
      customerName: item.salesOrder.customerName,
      status: item.salesOrder.status,
      paymentMode: item.salesOrder.paymentMode,
      units: item.quantity,
      branchSubtotal: lineTotal,
      createdByName: item.salesOrder.createdByName,
      detailHref: `/dashboard/sales-orders/${item.salesOrder.id}`,
      lineItems: [lineItem],
    });
  }

  const rows = [...rowsByKey.values()].sort((left, right) => {
    const dateSort = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (dateSort !== 0) return dateSort;

    const orderSort = left.orderNumber.localeCompare(right.orderNumber);
    if (orderSort !== 0) return orderSort;

    return left.branchName.localeCompare(right.branchName);
  });
  const filteredSalesValue = roundCurrency(
    rows.reduce((sum, row) => sum + row.branchSubtotal, 0)
  );
  const salesOrderRows = rows.length;
  const statusCounts = BRANCH_SALES_ORDER_STATUS_OPTIONS.map((status) => ({
    status,
    count: rows.filter((row) => row.status === status).length,
  }));

  return {
    rows,
    summary: {
      filteredSalesValue,
      unitsInFilteredOrders: rows.reduce((sum, row) => sum + row.units, 0),
      salesOrderRows,
      averageBranchOrderValue:
        salesOrderRows > 0 ? roundCurrency(filteredSalesValue / salesOrderRows) : 0,
      statusCounts,
    },
  };
}
