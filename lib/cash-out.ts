import { randomUUID } from "node:crypto";
import type {
  CashOutServiceVaultTransactionType,
  CashOutTransactionStatus,
  Role,
} from "@prisma/client";

export function buildCashOutTransactionNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const randomSuffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

  return `CO-${year}${month}${day}-${randomSuffix}`;
}

export function canVoidCashOutTransaction(role: Role) {
  return role === "ADMIN" || role === "SYSTEM_MANAGER";
}

export function formatCashOutStatus(status: CashOutTransactionStatus) {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "VOIDED":
      return "Voided";
  }
}

export function getCashOutStatusBadgeClass(status: CashOutTransactionStatus) {
  switch (status) {
    case "COMPLETED":
      return "border-[#c5e7db] bg-[#edf8f4] text-[#0a4429]";
    case "VOIDED":
      return "border-red-200 bg-red-50 text-destructive";
  }
}

export function formatCashOutServiceVaultType(
  type: CashOutServiceVaultTransactionType
) {
  switch (type) {
    case "CASH_OUT_RECEIVED":
      return "Cash-out received";
    case "VOID_REVERSAL":
      return "Void reversal";
  }
}
