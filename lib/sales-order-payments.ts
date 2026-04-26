import type { PaymentMode } from "@prisma/client";

export type SalesOrderIntent = "draft" | "record" | "record_and_new";

export type SalesOrderPaymentFieldErrors = Record<string, string[] | undefined>;

export type SalesOrderPaymentResolution =
  | {
      ok: true;
      paymentMode: null;
      cashAmount: null;
      onlineAmount: null;
    }
  | {
      ok: true;
      paymentMode: PaymentMode;
      cashAmount: number;
      onlineAmount: number;
    }
  | {
      ok: false;
      fieldErrors: SalesOrderPaymentFieldErrors;
    };

function parseMoneyInput(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

export function salesOrderAmountsMatchTotal(left: number, right: number) {
  return Math.abs(left - right) < 0.005;
}

export function resolveSalesOrderPayment(input: {
  paymentMode: string;
  cashAmount: string;
  onlineAmount: string;
  orderTotal: number;
  intent: SalesOrderIntent;
}): SalesOrderPaymentResolution {
  if (input.intent === "draft") {
    return {
      ok: true,
      paymentMode: null,
      cashAmount: null,
      onlineAmount: null,
    };
  }

  if (
    input.paymentMode !== "CASH" &&
    input.paymentMode !== "ONLINE" &&
    input.paymentMode !== "MIXED"
  ) {
    return {
      ok: false,
      fieldErrors: {
        paymentMode: ["Choose a mode of payment before recording the sale."],
      },
    };
  }

  if (input.paymentMode === "CASH") {
    return {
      ok: true,
      paymentMode: "CASH",
      cashAmount: input.orderTotal,
      onlineAmount: 0,
    };
  }

  if (input.paymentMode === "ONLINE") {
    return {
      ok: true,
      paymentMode: "ONLINE",
      cashAmount: 0,
      onlineAmount: input.orderTotal,
    };
  }

  const cashAmount = parseMoneyInput(input.cashAmount);
  const onlineAmount = parseMoneyInput(input.onlineAmount);
  const fieldErrors: SalesOrderPaymentFieldErrors = {};

  if (cashAmount === null || Number.isNaN(cashAmount) || cashAmount <= 0) {
    fieldErrors.cashAmount = ["Enter the cash amount for a mixed payment."];
  }

  if (onlineAmount === null || Number.isNaN(onlineAmount) || onlineAmount <= 0) {
    fieldErrors.onlineAmount = ["Enter the online amount for a mixed payment."];
  }

  if (
    cashAmount !== null &&
    !Number.isNaN(cashAmount) &&
    onlineAmount !== null &&
    !Number.isNaN(onlineAmount) &&
    !salesOrderAmountsMatchTotal(cashAmount + onlineAmount, input.orderTotal)
  ) {
    fieldErrors.onlineAmount = [
      `Cash and online amounts must add up to ${input.orderTotal.toFixed(2)}.`,
    ];
  }

  if (Object.values(fieldErrors).some(Boolean)) {
    return {
      ok: false,
      fieldErrors,
    };
  }

  return {
    ok: true,
    paymentMode: "MIXED",
    cashAmount: cashAmount ?? 0,
    onlineAmount: onlineAmount ?? 0,
  };
}
