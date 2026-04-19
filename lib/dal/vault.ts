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
