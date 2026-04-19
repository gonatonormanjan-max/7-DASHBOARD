import "server-only";

import { Prisma, VaultPaymentMethod, VaultTransactionType } from "@prisma/client";

type CreditVaultForSaleInput = {
  branchId: string;
  orderId: string;
  orderNumber: string;
  cashAmount: Prisma.Decimal | null;
  onlineAmount: Prisma.Decimal | null;
  performedById: string;
};

/**
 * Credit a branch vault for a completed sale.
 *
 * Must be called inside a $transaction — the caller passes the transactional
 * client. This keeps the vault update atomic with the sales-order creation
 * and inventory decrement: a failure here rolls back the whole sale.
 *
 * Behaviour:
 *   - For each non-null, positive payment amount, inserts one VaultTransaction
 *     row (type = SALE, method = CASH or ONLINE) and atomically increments the
 *     matching balance on BranchVault.
 *   - If BranchVault does not yet exist for the branch, it is upserted with
 *     the initial balances equal to the credit amounts (the other balance
 *     starts at 0).
 *   - Zero or null amounts are skipped — no ledger row for a method that
 *     received no money.
 *
 * Idempotency:
 *   A UNIQUE (referenceType, referenceId, type, paymentMethod) constraint on
 *   VaultTransaction prevents double-crediting the same order. If a duplicate
 *   insert happens (e.g. a Lambda retry after commit), Prisma throws P2002
 *   and the caller's transaction aborts — safe by design.
 *
 * Scope:
 *   Only direct-sale (non-draft) flow credits the vault today. DRAFT orders
 *   that later complete via status transitions are tracked for a follow-up
 *   phase (see Task #11 / Phase 2B.1).
 */
export async function creditVaultForSale(
  tx: Prisma.TransactionClient,
  input: CreditVaultForSaleInput
): Promise<void> {
  const cashDelta = input.cashAmount ?? new Prisma.Decimal(0);
  const onlineDelta = input.onlineAmount ?? new Prisma.Decimal(0);

  const hasCash = cashDelta.gt(0);
  const hasOnline = onlineDelta.gt(0);

  if (!hasCash && !hasOnline) {
    return; // No money to record — nothing to do.
  }

  // Insert ledger rows first so the BranchVault row's lastUpdatedAt reflects
  // the same transaction commit. One row per payment method present.
  if (hasCash) {
    await tx.vaultTransaction.create({
      data: {
        branchId: input.branchId,
        type: VaultTransactionType.SALE,
        paymentMethod: VaultPaymentMethod.CASH,
        amount: cashDelta,
        referenceType: "sales_order",
        referenceId: input.orderId,
        notes: `Cash payment for order ${input.orderNumber}`,
        performedById: input.performedById,
      },
    });
  }

  if (hasOnline) {
    await tx.vaultTransaction.create({
      data: {
        branchId: input.branchId,
        type: VaultTransactionType.SALE,
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: onlineDelta,
        referenceType: "sales_order",
        referenceId: input.orderId,
        notes: `Online payment for order ${input.orderNumber}`,
        performedById: input.performedById,
      },
    });
  }

  // Upsert the running-balance cache. `increment` on an existing row produces
  // SQL `UPDATE ... SET cashBalance = cashBalance + X` which is atomic under
  // Postgres row-locking inside this transaction.
  await tx.branchVault.upsert({
    where: { branchId: input.branchId },
    create: {
      branchId: input.branchId,
      cashBalance: cashDelta,
      onlineBalance: onlineDelta,
    },
    update: {
      cashBalance: { increment: cashDelta },
      onlineBalance: { increment: onlineDelta },
    },
  });
}

type ReverseVaultForVoidedSaleInput = {
  orderId: string;
  orderNumber: string;
  performedById: string;
  reason: string;
};

/**
 * Reverse the vault credits previously recorded for a now-voided sale.
 *
 * Must be called inside the same $transaction that voids the order so a
 * failure here rolls back the whole void (including the stock return).
 *
 * Design: ledger-driven, not order-driven.
 *   We read the original SALE ledger rows for this order rather than
 *   trusting `SalesOrder.cashAmount` / `onlineAmount`. That makes this
 *   helper forward-compatible with Task #11 (Phase 2B.1): when DRAFT
 *   orders later start crediting the vault, void reversal will "just
 *   work" because it reflects whatever was actually credited.
 *
 * Behaviour:
 *   - Reads VaultTransaction rows with (referenceType = "sales_order",
 *     referenceId = orderId, type = SALE).
 *   - If none exist (uncredited sale — legacy or DRAFT path), returns
 *     silently. No vault activity.
 *   - For each existing credit, inserts one matching VOID_REVERSAL row
 *     with a NEGATIVE amount and the same branchId.
 *   - Decrements BranchVault balances. Balances are allowed to go
 *     negative (Phase 2C design choice); reconciliation surfaces this.
 *
 * Idempotency:
 *   The UNIQUE (referenceType, referenceId, type, paymentMethod)
 *   constraint prevents double-reversal — a second call for the same
 *   order throws P2002. In practice, the void action's status guard
 *   blocks re-entry before we get here.
 */
export async function reverseVaultForVoidedSale(
  tx: Prisma.TransactionClient,
  input: ReverseVaultForVoidedSaleInput
): Promise<void> {
  const creditRows = await tx.vaultTransaction.findMany({
    where: {
      referenceType: "sales_order",
      referenceId: input.orderId,
      type: VaultTransactionType.SALE,
    },
    select: {
      branchId: true,
      paymentMethod: true,
      amount: true,
    },
  });

  if (creditRows.length === 0) {
    // Sale was never credited (legacy order or DRAFT path).
    return;
  }

  // All SALE credits for one order must share a branchId. Pick the first;
  // validate the rest match. A mismatch is a data-integrity error.
  const branchId = creditRows[0].branchId;
  for (const row of creditRows) {
    if (row.branchId !== branchId) {
      throw new Error(
        `Vault credits for sales_order ${input.orderId} span multiple branches; cannot auto-reverse.`
      );
    }
  }

  let cashCredit = new Prisma.Decimal(0);
  let onlineCredit = new Prisma.Decimal(0);

  for (const row of creditRows) {
    if (row.paymentMethod === VaultPaymentMethod.CASH) {
      cashCredit = cashCredit.plus(row.amount);
    } else if (row.paymentMethod === VaultPaymentMethod.ONLINE) {
      onlineCredit = onlineCredit.plus(row.amount);
    }
  }

  // Insert reversal ledger rows. One per method that was credited.
  if (cashCredit.gt(0)) {
    await tx.vaultTransaction.create({
      data: {
        branchId,
        type: VaultTransactionType.VOID_REVERSAL,
        paymentMethod: VaultPaymentMethod.CASH,
        amount: cashCredit.negated(),
        referenceType: "sales_order",
        referenceId: input.orderId,
        notes: `Void reversal for order ${input.orderNumber}: ${input.reason}`,
        performedById: input.performedById,
      },
    });
  }

  if (onlineCredit.gt(0)) {
    await tx.vaultTransaction.create({
      data: {
        branchId,
        type: VaultTransactionType.VOID_REVERSAL,
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: onlineCredit.negated(),
        referenceType: "sales_order",
        referenceId: input.orderId,
        notes: `Void reversal for order ${input.orderNumber}: ${input.reason}`,
        performedById: input.performedById,
      },
    });
  }

  // Decrement the running-balance cache. Uses `update` (not `upsert`) because
  // if SALE credits exist, the BranchVault row must already exist too — any
  // other state is a data-integrity error and should throw.
  // Balances may go negative; by design.
  await tx.branchVault.update({
    where: { branchId },
    data: {
      cashBalance: { decrement: cashCredit },
      onlineBalance: { decrement: onlineCredit },
    },
  });
}
