import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CashOutServiceVaultTransactionType,
  CashOutTransactionStatus,
  Prisma,
  VaultPaymentMethod,
  VaultTransactionType,
} from "@prisma/client";

const harness = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  cashOutTransactionCreate: vi.fn(),
  cashOutTransactionFindUnique: vi.fn(),
  cashOutTransactionUpdate: vi.fn(),
  vaultTransactionCreate: vi.fn(),
  branchVaultUpdate: vi.fn(),
  serviceVaultTransactionCreate: vi.fn(),
  serviceVaultBalanceUpsert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { createCashOutInVault, voidCashOutInVault } from "@/lib/dal/cash-out";

function buildTx() {
  return {
    $queryRaw: harness.queryRaw,
    cashOutTransaction: {
      create: harness.cashOutTransactionCreate,
      findUnique: harness.cashOutTransactionFindUnique,
      update: harness.cashOutTransactionUpdate,
    },
    vaultTransaction: { create: harness.vaultTransactionCreate },
    branchVault: { update: harness.branchVaultUpdate },
    cashOutServiceVaultTransaction: {
      create: harness.serviceVaultTransactionCreate,
    },
    cashOutServiceVaultBalance: {
      upsert: harness.serviceVaultBalanceUpsert,
    },
  } as unknown as Prisma.TransactionClient;
}

const baseCreateInput = {
  transactionNumber: "CO-20260518-ABC12345",
  branchId: "branch-1",
  accountId: "account-1",
  customerName: "Walk-in",
  customerContact: null,
  cashOutAmount: new Prisma.Decimal("1000.00"),
  feeAmount: new Prisma.Decimal("20.00"),
  onlineReceivedAmount: new Prisma.Decimal("1020.00"),
  onlineReferenceNumber: "GCASH-REF-001",
  notes: null,
  performedById: "user-1",
};

describe("cash-out vault writes", () => {
  beforeEach(() => {
    Object.values(harness).forEach((mock) => mock.mockReset());
    harness.queryRaw.mockResolvedValue([{ cashBalance: "5000.00" }]);
    harness.cashOutTransactionCreate.mockResolvedValue({
      id: "cashout-1",
      transactionNumber: baseCreateInput.transactionNumber,
    });
    harness.cashOutTransactionFindUnique.mockResolvedValue({
      id: "cashout-1",
      transactionNumber: baseCreateInput.transactionNumber,
      branchId: "branch-1",
      accountId: "account-1",
      cashOutAmount: new Prisma.Decimal("1000.00"),
      onlineReceivedAmount: new Prisma.Decimal("1020.00"),
    });
    harness.vaultTransactionCreate.mockResolvedValue({});
    harness.branchVaultUpdate.mockResolvedValue({});
    harness.serviceVaultTransactionCreate.mockResolvedValue({});
    harness.serviceVaultBalanceUpsert.mockResolvedValue({});
    harness.cashOutTransactionUpdate.mockResolvedValue({});
  });

  it("deducts branch cash and credits the shared service vault", async () => {
    const result = await createCashOutInVault(buildTx(), baseCreateInput);

    expect(result).toEqual({
      id: "cashout-1",
      transactionNumber: baseCreateInput.transactionNumber,
    });

    expect(harness.vaultTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branchId: "branch-1",
        type: VaultTransactionType.CASH_OUT_PAYOUT,
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal("-1000.00"),
        referenceType: "cash_out_transaction",
        referenceId: "cashout-1",
      }),
    });
    expect(harness.branchVaultUpdate).toHaveBeenCalledWith({
      where: { branchId: "branch-1" },
      data: { cashBalance: { decrement: new Prisma.Decimal("1000.00") } },
    });
    expect(harness.serviceVaultTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "account-1",
        cashOutTransactionId: "cashout-1",
        type: CashOutServiceVaultTransactionType.CASH_OUT_RECEIVED,
        amount: new Prisma.Decimal("1020.00"),
      }),
    });
    expect(harness.serviceVaultBalanceUpsert).toHaveBeenCalledWith({
      where: { accountId: "account-1" },
      create: {
        accountId: "account-1",
        balance: new Prisma.Decimal("1020.00"),
      },
      update: {
        balance: { increment: new Prisma.Decimal("1020.00") },
      },
    });
  });

  it("blocks transactions when branch cash is insufficient", async () => {
    harness.queryRaw.mockResolvedValueOnce([{ cashBalance: "999.99" }]);

    await expect(
      createCashOutInVault(buildTx(), baseCreateInput)
    ).rejects.toThrow(/exceeds current branch cash/i);

    expect(harness.cashOutTransactionCreate).not.toHaveBeenCalled();
    expect(harness.vaultTransactionCreate).not.toHaveBeenCalled();
    expect(harness.serviceVaultTransactionCreate).not.toHaveBeenCalled();
  });

  it("rejects mismatched online received amounts", async () => {
    await expect(
      createCashOutInVault(buildTx(), {
        ...baseCreateInput,
        onlineReceivedAmount: new Prisma.Decimal("1019.99"),
      })
    ).rejects.toThrow(/cash-out amount plus fee/i);

    expect(harness.queryRaw).not.toHaveBeenCalled();
  });

  it("voids by restoring branch cash and reversing the shared vault", async () => {
    harness.queryRaw.mockResolvedValueOnce([
      { status: CashOutTransactionStatus.COMPLETED },
    ]);

    await voidCashOutInVault(buildTx(), {
      transactionId: "cashout-1",
      voidReason: "Wrong reference number",
      performedById: "admin-1",
    });

    expect(harness.vaultTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branchId: "branch-1",
        type: VaultTransactionType.CASH_OUT_VOID_REVERSAL,
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal("1000.00"),
      }),
    });
    expect(harness.branchVaultUpdate).toHaveBeenCalledWith({
      where: { branchId: "branch-1" },
      data: { cashBalance: { increment: new Prisma.Decimal("1000.00") } },
    });
    expect(harness.serviceVaultTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "account-1",
        cashOutTransactionId: "cashout-1",
        type: CashOutServiceVaultTransactionType.VOID_REVERSAL,
        amount: new Prisma.Decimal("-1020.00"),
      }),
    });
    expect(harness.cashOutTransactionUpdate).toHaveBeenCalledWith({
      where: { id: "cashout-1" },
      data: expect.objectContaining({
        status: CashOutTransactionStatus.VOIDED,
        voidReason: "Wrong reference number",
        voidedById: "admin-1",
      }),
    });
  });

  it("does not void a transaction twice", async () => {
    harness.queryRaw.mockResolvedValueOnce([
      { status: CashOutTransactionStatus.VOIDED },
    ]);

    await expect(
      voidCashOutInVault(buildTx(), {
        transactionId: "cashout-1",
        voidReason: "Duplicate void",
        performedById: "admin-1",
      })
    ).rejects.toThrow(/already voided/i);

    expect(harness.vaultTransactionCreate).not.toHaveBeenCalled();
    expect(harness.serviceVaultTransactionCreate).not.toHaveBeenCalled();
  });
});
