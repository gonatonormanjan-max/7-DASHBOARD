import "server-only";

import { Prisma, VaultPaymentMethod, VaultTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/dal/auth";
import { getBranchScope } from "@/lib/dal/scope";
import { getPaginationMeta, type PaginationMeta } from "@/lib/pagination";

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
    return;
  }

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
 * Design: ledger-driven, not order-driven. Reads existing SALE rows rather
 * than trusting SalesOrder.cashAmount/onlineAmount — forward-compatible with
 * Phase 2B.1 when DRAFT orders also start crediting the vault.
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
    return;
  }

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

  await tx.branchVault.update({
    where: { branchId },
    data: {
      cashBalance: { decrement: cashCredit },
      onlineBalance: { decrement: onlineCredit },
    },
  });
}

// ---------------------------------------------------------------------------
// Read helpers — used by the /dashboard/vault page.
//
// Defensive fallback: if the vault tables don't exist yet (fresh clone before
// `prisma migrate`), these return empty-ish state instead of 500ing. Matches
// the pattern in lib/dal/adjustment-requests.ts.
// ---------------------------------------------------------------------------

function isMissingVaultStorageError(error: unknown) {
  const errorLike = error as
    | { code?: unknown; message?: unknown; meta?: unknown }
    | undefined;
  const code = typeof errorLike?.code === "string" ? errorLike.code : "";
  const message =
    typeof errorLike?.message === "string" ? errorLike.message : "";
  const metaCode =
    typeof errorLike?.meta === "object" &&
    errorLike.meta !== null &&
    "code" in errorLike.meta &&
    typeof (errorLike.meta as { code?: unknown }).code === "string"
      ? (errorLike.meta as { code: string }).code
      : "";

  if (error instanceof Prisma.PrismaClientKnownRequestError && code === "P2021") {
    return true;
  }
  if (code === "42P01" || metaCode === "42P01") {
    return true;
  }
  if (code === "P2010" && metaCode === "42P01") {
    return true;
  }
  return (
    message.includes('relation "BranchVault" does not exist') ||
    message.includes('relation "VaultTransaction" does not exist') ||
    message.includes('relation "branchvault" does not exist') ||
    message.includes('relation "vaulttransaction" does not exist')
  );
}

export type VaultBranchOption = {
  id: string;
  name: string;
  code: string;
};

/**
 * Branches the user is allowed to view vault data for.
 * - MANAGER: only their assigned branch
 * - ADMIN / SYSTEM_MANAGER: all active BRANCH locations
 * - Other roles: none (shouldn't reach this page)
 */
export async function getAccessibleVaultBranches(
  user: CurrentUser
): Promise<VaultBranchOption[]> {
  const branchScope = getBranchScope(user);

  const rows = await prisma.stockLocation.findMany({
    where: {
      isActive: true,
      type: "BRANCH",
      ...(branchScope ? { id: branchScope } : {}),
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return rows;
}

export type BranchVaultBalance = {
  branchId: string;
  cashBalance: Prisma.Decimal;
  onlineBalance: Prisma.Decimal;
  lastUpdatedAt: Date | null;
};

/**
 * Returns the cached balances for a branch's vault. Returns zero-balances
 * (with lastUpdatedAt = null) when no BranchVault row exists yet.
 *
 * Does NOT enforce access scope itself — the caller (page loader) must
 * validate that `branchId` is in the user's allowed list first.
 */
export async function getBranchVaultBalance(
  branchId: string
): Promise<BranchVaultBalance> {
  try {
    const row = await prisma.branchVault.findUnique({
      where: { branchId },
      select: {
        branchId: true,
        cashBalance: true,
        onlineBalance: true,
        lastUpdatedAt: true,
      },
    });

    if (!row) {
      return {
        branchId,
        cashBalance: new Prisma.Decimal(0),
        onlineBalance: new Prisma.Decimal(0),
        lastUpdatedAt: null,
      };
    }

    return row;
  } catch (error) {
    if (isMissingVaultStorageError(error)) {
      return {
        branchId,
        cashBalance: new Prisma.Decimal(0),
        onlineBalance: new Prisma.Decimal(0),
        lastUpdatedAt: null,
      };
    }
    throw error;
  }
}

export type VaultLedgerRow = {
  id: string;
  type: VaultTransactionType;
  paymentMethod: VaultPaymentMethod;
  amount: Prisma.Decimal;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
  performedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type VaultLedgerArgs = {
  branchId: string;
  /** Inclusive start — UTC Date representing business-TZ midnight. */
  dateFrom?: Date;
  /** Exclusive end — UTC Date representing start-of-next-business-day. */
  dateTo?: Date;
  type?: VaultTransactionType;
  paymentMethod?: VaultPaymentMethod;
  page: number;
  pageSize: number;
};

/**
 * Paginated slice of the vault ledger for a single branch. Caller must have
 * already validated branch access. Ordering: most-recent-first.
 */
export async function getVaultLedger(
  args: VaultLedgerArgs
): Promise<{ rows: VaultLedgerRow[]; pagination: PaginationMeta }> {
  const { branchId, dateFrom, dateTo, type, paymentMethod, page, pageSize } =
    args;

  const where: Prisma.VaultTransactionWhereInput = {
    branchId,
    ...(type ? { type } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lt: dateTo } : {}),
          },
        }
      : {}),
  };

  try {
    const [totalCount, rows] = await Promise.all([
      prisma.vaultTransaction.count({ where }),
      prisma.vaultTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          paymentMethod: true,
          amount: true,
          referenceType: true,
          referenceId: true,
          notes: true,
          createdAt: true,
          performedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    return {
      rows: rows as VaultLedgerRow[],
      pagination: getPaginationMeta(page, pageSize, totalCount),
    };
  } catch (error) {
    if (isMissingVaultStorageError(error)) {
      return {
        rows: [],
        pagination: getPaginationMeta(page, pageSize, 0),
      };
    }
    throw error;
  }
}
