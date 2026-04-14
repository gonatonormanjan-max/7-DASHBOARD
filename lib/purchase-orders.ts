import { randomInt } from "node:crypto";
import type { PurchaseOrderStatus } from "@prisma/client";

export function formatPurchaseOrderStatus(status: PurchaseOrderStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "APPROVED":
      return "Approved";
    case "PARTIALLY_RECEIVED":
      return "Partially Received";
    case "RECEIVED":
      return "Received";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function getPurchaseOrderStatusBadgeClass(status: PurchaseOrderStatus) {
  switch (status) {
    case "DRAFT":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "APPROVED":
      return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
    case "PARTIALLY_RECEIVED":
      return "border-[#f2d2a2] bg-[#fff4e4] text-[#8a5610]";
    case "RECEIVED":
      return "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-destructive";
  }
}

export function generatePurchaseOrderNumber() {
  return `PO-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 1000)}`;
}
