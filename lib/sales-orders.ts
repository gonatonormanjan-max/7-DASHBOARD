import type {
  PaymentMode,
  SalesOrderStatus,
  SalesOrderVoidReason,
} from "@prisma/client";

export const SALES_ORDER_ENTRY_STATUSES: SalesOrderStatus[] = ["COMPLETED"];

export function formatSalesOrderStatus(status: SalesOrderStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "CONFIRMED":
      return "Confirmed";
    case "DELIVERED":
      return "Delivered";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function getSalesOrderStatusBadgeClass(status: SalesOrderStatus) {
  switch (status) {
    case "DRAFT":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "CONFIRMED":
      return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
    case "DELIVERED":
      return "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]";
    case "COMPLETED":
      return "border-[#c5e7db] bg-[#edf8f4] text-[#0a4429]";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-destructive";
  }
}

export function formatPaymentMode(paymentMode: PaymentMode) {
  switch (paymentMode) {
    case "CASH":
      return "Cash";
    case "ONLINE":
      return "Online payment";
    case "MIXED":
      return "Mixed payment";
  }
}

export function formatSalesOrderVoidReason(reason: SalesOrderVoidReason) {
  switch (reason) {
    case "DEFECT":
      return "Defect";
    case "RETURNED_REFUND":
      return "Returned / Refund";
    case "REPLACE":
      return "Replace";
    case "OTHERS":
      return "Others";
  }
}

export function buildSalesOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return `SO-${year}${month}${day}-${random}`;
}
