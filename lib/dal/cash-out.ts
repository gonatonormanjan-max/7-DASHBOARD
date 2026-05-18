import "server-only";

import {
  CashOutServiceVaultTransactionType,
  CashOutTransactionStatus,
  LocationType,
  Prisma,
  VaultPaymentMethod,
  VaultTransactionType,
} from "@prisma/client";
import type { CurrentUser } from "@/lib/dal/auth";
import { getSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getBranchScope } from "@/lib/dal/scope";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  getPaginationMeta,
  type PaginationMeta,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { businessDayEnd, businessDayStart } from "@/lib/timezone";
import type { CashOutListFilters } from "@/lib/validators/cash-out";

const CASH_OUT_REFERENCE_TYPE = "cash_out_transaction";

type BranchScopeOptions = {
  locationId?: string | null;
};

export type CashOutBranchOption = {
  id: string;
  name: string;
  code: string;
  cashBalance: string;
};

export type CashOutAccountOption = {
  id: string;
  name: string;
  provider: string | null;
  accountName: string | null;
  accountNumber: string | null;
  isActive: boolean;
  balance: string;
};

export type CashOutListRow = {
  id: string;
  transactionNumber: string;
  branchName: string;
  branchCode: string;
  accountName: string;
  customerName: string | null;
  cashOutAmount: string;
  feeAmount: string;
  onlineReceivedAmount: string;
  onlineReferenceNumber: string;
  status: CashOutTransactionStatus;
  createdAt: Date;
  createdByName: string;
};

export type CashOutListData = {
  filters: CashOutListFilters;
  branches: CashOutBranchOption[];
  accounts: CashOutAccountOption[];
  rows: CashOutListRow[];
  pagination: PaginationMeta;
  summary: {
    transactionCount: number;
    cashPaidOut: number;
    onlineReceived: number;
    feeRevenue: number;
    completedCount: number;
    voidedCount: number;
  };
};

export type CashOutDetailData = {
  id: string;
  transactionNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  accountName: string;
  accountProvider: string | null;
  customerName: string | null;
  customerContact: string | null;
  cashOutAmount: string;
  feeAmount: string;
  onlineReceivedAmount: string;
  onlineReferenceNumber: string;
  status: CashOutTransactionStatus;
  notes: string | null;
  voidReason: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  createdByName: string;
  voidedByName: string | null;
};

export type CashOutServiceVaultLedgerRow = {
  id: string;
  type: CashOutServiceVaultTransactionType;
  amount: string;
  notes: string | null;
  createdAt: Date;
  accountName: string;
  transactionId: string;
  transactionNumber: string;
  branchName: string;
  branchCode: string;
  performedByName: string;
};

export type CashOutServiceVaultData = CashOutListData & {
  totalServiceVaultBalance: number;
  accountBalances: CashOutAccountOption[];
  ledger: {
    rows: CashOutServiceVaultLedgerRow[];
    pagination: PaginationMeta;
  };
};

function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

function toNumber(value: Prisma.Decimal | null | undefined) {
  return value ? Number(value.toString()) : 0;
}

function getCreatedAtFilter(filters: Pick<CashOutListFilters, "dateFrom" | "dateTo">) {
  if (!filters.dateFrom && !filters.dateTo) {
    return undefined;
  }

  return {
    ...(filters.dateFrom ? { gte: businessDayStart(filters.dateFrom) } : {}),
    ...(filters.dateTo ? { lt: businessDayEnd(filters.dateTo) } : {}),
  } satisfies Prisma.DateTimeFilter;
}

async function getCashOutLocationScope(user: CurrentUser) {
  if (user.role === "SALES_STAFF") {
    return getSalesStaffActiveLocationId(user);
  }

  return getBranchScope(user);
}

async function getAccessibleCashOutBranchRows(user: CurrentUser) {
  const scopedBranchId = await getCashOutLocationScope(user);

  return prisma.stockLocation.findMany({
    where: {
      isActive: true,
      type: LocationType.BRANCH,
      ...(scopedBranchId ? { id: scopedBranchId } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      vault: {
        select: {
          cashBalance: true,
        },
      },
    },
  });
}

export async function getAccessibleCashOutBranches(
  user: CurrentUser
): Promise<CashOutBranchOption[]> {
  const rows = await getAccessibleCashOutBranchRows(user);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    cashBalance: (row.vault?.cashBalance ?? new Prisma.Decimal(0)).toString(),
  }));
}

export async function getCashOutAccounts(options?: {
  includeInactive?: boolean;
}): Promise<CashOutAccountOption[]> {
  const rows = await prisma.cashOutAccount.findMany({
    where: options?.includeInactive ? undefined : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      provider: true,
      accountName: true,
      accountNumber: true,
      isActive: true,
      balance: {
        select: {
          balance: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    provider: row.provider,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    isActive: row.isActive,
    balance: (row.balance?.balance ?? new Prisma.Decimal(0)).toString(),
  }));
}

function resolveEffectiveFilters(args: {
  filters: CashOutListFilters;
  branchIds: Set<string>;
  accountIds: Set<string>;
  forcedLocationId?: string | null;
}) {
  const selectedBranchId =
    args.forcedLocationId ??
    (isUuid(args.filters.branchId) && args.branchIds.has(args.filters.branchId)
      ? args.filters.branchId
      : null);
  const selectedAccountId =
    isUuid(args.filters.accountId) && args.accountIds.has(args.filters.accountId)
      ? args.filters.accountId
      : null;

  return {
    ...args.filters,
    branchId: selectedBranchId ?? "all",
    accountId: selectedAccountId ?? "all",
  };
}

function buildCashOutWhere(
  filters: CashOutListFilters,
  options: {
    branchIds: Set<string>;
    accountIds: Set<string>;
    forcedLocationId?: string | null;
  }
) {
  const effective = resolveEffectiveFilters({
    filters,
    branchIds: options.branchIds,
    accountIds: options.accountIds,
    forcedLocationId: options.forcedLocationId,
  });
  const createdAt = getCreatedAtFilter(effective);
  const query = effective.query.trim();

  const where: Prisma.CashOutTransactionWhereInput = {
    ...(effective.branchId !== "all" ? { branchId: effective.branchId } : {}),
    ...(effective.accountId !== "all" ? { accountId: effective.accountId } : {}),
    ...(effective.status !== "all" ? { status: effective.status } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(query
      ? {
          OR: [
            { transactionNumber: { contains: query, mode: "insensitive" } },
            { onlineReferenceNumber: { contains: query, mode: "insensitive" } },
            { customerName: { contains: query, mode: "insensitive" } },
            { customerContact: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return { where, effective };
}

export async function getCashOutListData(
  filters: CashOutListFilters,
  user: CurrentUser,
  options: BranchScopeOptions = {}
): Promise<CashOutListData> {
  const [branches, accounts] = await Promise.all([
    getAccessibleCashOutBranches(user),
    getCashOutAccounts({ includeInactive: true }),
  ]);
  const branchIds = new Set(branches.map((branch) => branch.id));
  const accountIds = new Set(accounts.map((account) => account.id));
  const scopedLocationId = options.locationId ?? (await getCashOutLocationScope(user));
  const { where, effective } = buildCashOutWhere(filters, {
    branchIds,
    accountIds,
    forcedLocationId: scopedLocationId,
  });
  const totalsWhere =
    effective.status === CashOutTransactionStatus.VOIDED
      ? null
      : ({
          ...where,
          status: CashOutTransactionStatus.COMPLETED,
        } satisfies Prisma.CashOutTransactionWhereInput);
  const normalizedPage = filters.page ?? DEFAULT_PAGE;
  const normalizedPageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  const [totalCount, rows, aggregate, groupedStatus] = await Promise.all([
    prisma.cashOutTransaction.count({ where }),
    prisma.cashOutTransaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (normalizedPage - 1) * normalizedPageSize,
      take: normalizedPageSize,
      select: {
        id: true,
        transactionNumber: true,
        cashOutAmount: true,
        feeAmount: true,
        onlineReceivedAmount: true,
        onlineReferenceNumber: true,
        customerName: true,
        status: true,
        createdAt: true,
        branch: {
          select: { name: true, code: true },
        },
        account: {
          select: { name: true },
        },
        createdBy: {
          select: { firstName: true, lastName: true },
        },
      },
    }),
    totalsWhere
      ? prisma.cashOutTransaction.aggregate({
          where: totalsWhere,
          _sum: {
            cashOutAmount: true,
            onlineReceivedAmount: true,
            feeAmount: true,
          },
        })
      : Promise.resolve({
          _sum: {
            cashOutAmount: null,
            onlineReceivedAmount: null,
            feeAmount: null,
          },
        }),
    prisma.cashOutTransaction.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);

  const completedCount =
    groupedStatus.find((row) => row.status === CashOutTransactionStatus.COMPLETED)
      ?._count._all ?? 0;
  const voidedCount =
    groupedStatus.find((row) => row.status === CashOutTransactionStatus.VOIDED)
      ?._count._all ?? 0;

  return {
    filters: effective,
    branches,
    accounts,
    rows: rows.map((row) => ({
      id: row.id,
      transactionNumber: row.transactionNumber,
      branchName: row.branch.name,
      branchCode: row.branch.code,
      accountName: row.account.name,
      customerName: row.customerName,
      cashOutAmount: row.cashOutAmount.toString(),
      feeAmount: row.feeAmount.toString(),
      onlineReceivedAmount: row.onlineReceivedAmount.toString(),
      onlineReferenceNumber: row.onlineReferenceNumber,
      status: row.status,
      createdAt: row.createdAt,
      createdByName: `${row.createdBy.firstName} ${row.createdBy.lastName}`,
    })),
    pagination: getPaginationMeta(normalizedPage, normalizedPageSize, totalCount),
    summary: {
      transactionCount: totalCount,
      cashPaidOut: toNumber(aggregate._sum.cashOutAmount),
      onlineReceived: toNumber(aggregate._sum.onlineReceivedAmount),
      feeRevenue: toNumber(aggregate._sum.feeAmount),
      completedCount,
      voidedCount,
    },
  };
}

export async function getCashOutById(
  id: string,
  user: CurrentUser,
  options: BranchScopeOptions = {}
): Promise<CashOutDetailData | null> {
  const scopedLocationId = options.locationId ?? (await getCashOutLocationScope(user));
  const row = await prisma.cashOutTransaction.findFirst({
    where: {
      id,
      ...(scopedLocationId ? { branchId: scopedLocationId } : {}),
    },
    select: {
      id: true,
      transactionNumber: true,
      branchId: true,
      customerName: true,
      customerContact: true,
      cashOutAmount: true,
      feeAmount: true,
      onlineReceivedAmount: true,
      onlineReferenceNumber: true,
      status: true,
      notes: true,
      voidReason: true,
      voidedAt: true,
      createdAt: true,
      branch: {
        select: { name: true, code: true },
      },
      account: {
        select: { name: true, provider: true },
      },
      createdBy: {
        select: { firstName: true, lastName: true },
      },
      voidedBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    transactionNumber: row.transactionNumber,
    branchId: row.branchId,
    branchName: row.branch.name,
    branchCode: row.branch.code,
    accountName: row.account.name,
    accountProvider: row.account.provider,
    customerName: row.customerName,
    customerContact: row.customerContact,
    cashOutAmount: row.cashOutAmount.toString(),
    feeAmount: row.feeAmount.toString(),
    onlineReceivedAmount: row.onlineReceivedAmount.toString(),
    onlineReferenceNumber: row.onlineReferenceNumber,
    status: row.status,
    notes: row.notes,
    voidReason: row.voidReason,
    voidedAt: row.voidedAt,
    createdAt: row.createdAt,
    createdByName: `${row.createdBy.firstName} ${row.createdBy.lastName}`,
    voidedByName: row.voidedBy
      ? `${row.voidedBy.firstName} ${row.voidedBy.lastName}`
      : null,
  };
}

export async function getCashOutServiceVaultData(
  filters: CashOutListFilters,
  user: CurrentUser
): Promise<CashOutServiceVaultData> {
  const listData = await getCashOutListData(filters, user);
  const accountIds = new Set(listData.accounts.map((account) => account.id));
  const effectiveAccountId =
    listData.filters.accountId !== "all" && accountIds.has(listData.filters.accountId)
      ? listData.filters.accountId
      : null;
  const createdAt = getCreatedAtFilter(listData.filters);
  const ledgerWhere: Prisma.CashOutServiceVaultTransactionWhereInput = {
    ...(effectiveAccountId ? { accountId: effectiveAccountId } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
  const page = listData.filters.page ?? DEFAULT_PAGE;
  const pageSize = listData.filters.pageSize ?? DEFAULT_PAGE_SIZE;

  const [totalLedgerCount, ledgerRows] = await Promise.all([
    prisma.cashOutServiceVaultTransaction.count({ where: ledgerWhere }),
    prisma.cashOutServiceVaultTransaction.findMany({
      where: ledgerWhere,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        amount: true,
        notes: true,
        createdAt: true,
        account: {
          select: { name: true },
        },
        cashOutTransaction: {
          select: {
            id: true,
            transactionNumber: true,
            branch: {
              select: { name: true, code: true },
            },
          },
        },
        performedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    }),
  ]);

  const totalServiceVaultBalance = listData.accounts.reduce(
    (sum, account) => sum + Number(account.balance),
    0
  );

  return {
    ...listData,
    totalServiceVaultBalance,
    accountBalances: listData.accounts,
    ledger: {
      rows: ledgerRows.map((row) => ({
        id: row.id,
        type: row.type,
        amount: row.amount.toString(),
        notes: row.notes,
        createdAt: row.createdAt,
        accountName: row.account.name,
        transactionId: row.cashOutTransaction.id,
        transactionNumber: row.cashOutTransaction.transactionNumber,
        branchName: row.cashOutTransaction.branch.name,
        branchCode: row.cashOutTransaction.branch.code,
        performedByName: `${row.performedBy.firstName} ${row.performedBy.lastName}`,
      })),
      pagination: getPaginationMeta(page, pageSize, totalLedgerCount),
    },
  };
}

type CreateCashOutInput = {
  transactionNumber: string;
  branchId: string;
  accountId: string;
  customerName?: string | null;
  customerContact?: string | null;
  cashOutAmount: Prisma.Decimal;
  feeAmount: Prisma.Decimal;
  onlineReceivedAmount: Prisma.Decimal;
  onlineReferenceNumber: string;
  notes?: string | null;
  performedById: string;
};

export async function createCashOutInVault(
  tx: Prisma.TransactionClient,
  input: CreateCashOutInput
): Promise<{ id: string; transactionNumber: string }> {
  if (!input.cashOutAmount.gt(0)) {
    throw new Error("Cash-out amount must be greater than zero.");
  }

  if (input.feeAmount.lt(0)) {
    throw new Error("Fee cannot be negative.");
  }

  if (!input.onlineReceivedAmount.equals(input.cashOutAmount.plus(input.feeAmount))) {
    throw new Error("Online received amount must equal cash-out amount plus fee.");
  }

  const rows = await tx.$queryRaw<{ cashBalance: string }[]>(
    Prisma.sql`SELECT "cashBalance" FROM "BranchVault" WHERE "branchId" = ${input.branchId} FOR UPDATE`
  );

  if (rows.length === 0) {
    throw new Error(
      "No vault exists for this branch. Record a sale or opening float before using cash out."
    );
  }

  const currentCashBalance = new Prisma.Decimal(rows[0].cashBalance);

  if (input.cashOutAmount.gt(currentCashBalance)) {
    throw new Error(
      `Cash-out amount (${input.cashOutAmount.toFixed(2)}) exceeds current branch cash (${currentCashBalance.toFixed(2)}).`
    );
  }

  const transaction = await tx.cashOutTransaction.create({
    data: {
      transactionNumber: input.transactionNumber,
      branchId: input.branchId,
      accountId: input.accountId,
      customerName: input.customerName,
      customerContact: input.customerContact,
      cashOutAmount: input.cashOutAmount,
      feeAmount: input.feeAmount,
      onlineReceivedAmount: input.onlineReceivedAmount,
      onlineReferenceNumber: input.onlineReferenceNumber,
      notes: input.notes,
      createdById: input.performedById,
    },
    select: {
      id: true,
      transactionNumber: true,
    },
  });

  await tx.vaultTransaction.create({
    data: {
      branchId: input.branchId,
      type: VaultTransactionType.CASH_OUT_PAYOUT,
      paymentMethod: VaultPaymentMethod.CASH,
      amount: input.cashOutAmount.negated(),
      referenceType: CASH_OUT_REFERENCE_TYPE,
      referenceId: transaction.id,
      notes: `Cash-out payout ${transaction.transactionNumber}`,
      performedById: input.performedById,
    },
  });

  await tx.branchVault.update({
    where: { branchId: input.branchId },
    data: { cashBalance: { decrement: input.cashOutAmount } },
  });

  await tx.cashOutServiceVaultTransaction.create({
    data: {
      accountId: input.accountId,
      cashOutTransactionId: transaction.id,
      type: CashOutServiceVaultTransactionType.CASH_OUT_RECEIVED,
      amount: input.onlineReceivedAmount,
      notes: `Online received for ${transaction.transactionNumber}`,
      performedById: input.performedById,
    },
  });

  await tx.cashOutServiceVaultBalance.upsert({
    where: { accountId: input.accountId },
    create: {
      accountId: input.accountId,
      balance: input.onlineReceivedAmount,
    },
    update: {
      balance: { increment: input.onlineReceivedAmount },
    },
  });

  return transaction;
}

type VoidCashOutInput = {
  transactionId: string;
  voidReason: string;
  performedById: string;
};

export async function voidCashOutInVault(
  tx: Prisma.TransactionClient,
  input: VoidCashOutInput
): Promise<{ id: string; transactionNumber: string }> {
  const lockRows = await tx.$queryRaw<{ status: CashOutTransactionStatus }[]>(
    Prisma.sql`SELECT "status" FROM "CashOutTransaction" WHERE "id" = ${input.transactionId} FOR UPDATE`
  );

  if (lockRows.length === 0) {
    throw new Error("Cash-out transaction not found.");
  }

  if (lockRows[0].status === CashOutTransactionStatus.VOIDED) {
    throw new Error("This cash-out transaction is already voided.");
  }

  const transaction = await tx.cashOutTransaction.findUnique({
    where: { id: input.transactionId },
    select: {
      id: true,
      transactionNumber: true,
      branchId: true,
      accountId: true,
      cashOutAmount: true,
      onlineReceivedAmount: true,
    },
  });

  if (!transaction) {
    throw new Error("Cash-out transaction not found.");
  }

  await tx.vaultTransaction.create({
    data: {
      branchId: transaction.branchId,
      type: VaultTransactionType.CASH_OUT_VOID_REVERSAL,
      paymentMethod: VaultPaymentMethod.CASH,
      amount: transaction.cashOutAmount,
      referenceType: CASH_OUT_REFERENCE_TYPE,
      referenceId: transaction.id,
      notes: `Cash-out void reversal ${transaction.transactionNumber}: ${input.voidReason}`,
      performedById: input.performedById,
    },
  });

  await tx.branchVault.update({
    where: { branchId: transaction.branchId },
    data: { cashBalance: { increment: transaction.cashOutAmount } },
  });

  await tx.cashOutServiceVaultTransaction.create({
    data: {
      accountId: transaction.accountId,
      cashOutTransactionId: transaction.id,
      type: CashOutServiceVaultTransactionType.VOID_REVERSAL,
      amount: transaction.onlineReceivedAmount.negated(),
      notes: `Void reversal for ${transaction.transactionNumber}: ${input.voidReason}`,
      performedById: input.performedById,
    },
  });

  await tx.cashOutServiceVaultBalance.upsert({
    where: { accountId: transaction.accountId },
    create: {
      accountId: transaction.accountId,
      balance: transaction.onlineReceivedAmount.negated(),
    },
    update: {
      balance: { decrement: transaction.onlineReceivedAmount },
    },
  });

  await tx.cashOutTransaction.update({
    where: { id: transaction.id },
    data: {
      status: CashOutTransactionStatus.VOIDED,
      voidReason: input.voidReason,
      voidedAt: new Date(),
      voidedById: input.performedById,
    },
  });

  return {
    id: transaction.id,
    transactionNumber: transaction.transactionNumber,
  };
}
