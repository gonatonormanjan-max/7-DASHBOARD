import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, VaultPaymentMethod, VaultTransactionType } from "@prisma/client";

// Hoisted mock handles for the transactional client we hand to creditVaultForSale.
const harness = vi.hoisted(() => {
  return {
    vaultTxCreate: vi.fn(),
    branchVaultUpsert: vi.fn(),
  };
});

// `creditVaultForSale` is imported by lib/dal/vault.ts which uses "server-only".
vi.mock("server-only", () => ({}));

// lib/dal/vault.ts imports the prisma singleton for read-side helpers.
// This test doesn't exercise those paths (we pass a mock tx client), but the
// import chain still loads lib/prisma.ts — which throws without DATABASE_URL.
// An empty mock short-circuits that at module resolution time.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { creditVaultForSale } from "@/lib/dal/vault";

// Build a fresh mock TransactionClient for each test.
function buildTx() {
  return {
    vaultTransaction: { create: harness.vaultTxCreate },
    branchVault: { upsert: harness.branchVaultUpsert },
  } as unknown as Prisma.TransactionClient;
}

const baseInput = {
  branchId: "branch-1",
  orderId: "order-1",
  orderNumber: "SO-2026-0001",
  performedById: "user-1",
};

describe("creditVaultForSale", () => {
  beforeEach(() => {
    harness.vaultTxCreate.mockReset();
    harness.branchVaultUpsert.mockReset();
    harness.vaultTxCreate.mockResolvedValue({});
    harness.branchVaultUpsert.mockResolvedValue({});
  });

  it("credits cash-only sales with one VaultTransaction and one BranchVault upsert", async () => {
    await creditVaultForSale(buildTx(), {
      ...baseInput,
      cashAmount: new Prisma.Decimal(150),
      onlineAmount: null,
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(1);
    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branchId: "branch-1",
        type: VaultTransactionType.SALE,
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(150),
        referenceType: "sales_order",
        referenceId: "order-1",
        performedById: "user-1",
      }),
    });

    expect(harness.branchVaultUpsert).toHaveBeenCalledTimes(1);
    const upsertCall = harness.branchVaultUpsert.mock.calls[0][0];
    expect(upsertCall.where).toEqual({ branchId: "branch-1" });
    expect(upsertCall.create).toMatchObject({
      branchId: "branch-1",
      cashBalance: new Prisma.Decimal(150),
      onlineBalance: new Prisma.Decimal(0),
    });
    expect(upsertCall.update).toEqual({
      cashBalance: { increment: new Prisma.Decimal(150) },
      onlineBalance: { increment: new Prisma.Decimal(0) },
    });
  });

  it("credits online-only sales with one VaultTransaction and one BranchVault upsert", async () => {
    await creditVaultForSale(buildTx(), {
      ...baseInput,
      cashAmount: null,
      onlineAmount: new Prisma.Decimal(75.5),
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(1);
    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: new Prisma.Decimal(75.5),
      }),
    });

    expect(harness.branchVaultUpsert).toHaveBeenCalledTimes(1);
    const upsertCall = harness.branchVaultUpsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({
      cashBalance: new Prisma.Decimal(0),
      onlineBalance: new Prisma.Decimal(75.5),
    });
  });

  it("credits split-tender sales with two VaultTransactions and one BranchVault upsert", async () => {
    await creditVaultForSale(buildTx(), {
      ...baseInput,
      cashAmount: new Prisma.Decimal(40),
      onlineAmount: new Prisma.Decimal(60),
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(2);

    const methods = harness.vaultTxCreate.mock.calls.map(
      (call) => call[0].data.paymentMethod
    );
    expect(methods).toContain(VaultPaymentMethod.CASH);
    expect(methods).toContain(VaultPaymentMethod.ONLINE);

    expect(harness.branchVaultUpsert).toHaveBeenCalledTimes(1);
    const upsertCall = harness.branchVaultUpsert.mock.calls[0][0];
    expect(upsertCall.update).toEqual({
      cashBalance: { increment: new Prisma.Decimal(40) },
      onlineBalance: { increment: new Prisma.Decimal(60) },
    });
  });

  it("does nothing when both amounts are null", async () => {
    await creditVaultForSale(buildTx(), {
      ...baseInput,
      cashAmount: null,
      onlineAmount: null,
    });

    expect(harness.vaultTxCreate).not.toHaveBeenCalled();
    expect(harness.branchVaultUpsert).not.toHaveBeenCalled();
  });

  it("does nothing when both amounts are zero", async () => {
    await creditVaultForSale(buildTx(), {
      ...baseInput,
      cashAmount: new Prisma.Decimal(0),
      onlineAmount: new Prisma.Decimal(0),
    });

    expect(harness.vaultTxCreate).not.toHaveBeenCalled();
    expect(harness.branchVaultUpsert).not.toHaveBeenCalled();
  });

  it("skips a payment method whose amount is zero (cash=0, online>0)", async () => {
    await creditVaultForSale(buildTx(), {
      ...baseInput,
      cashAmount: new Prisma.Decimal(0),
      onlineAmount: new Prisma.Decimal(99),
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(1);
    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: new Prisma.Decimal(99),
      }),
    });

    expect(harness.branchVaultUpsert).toHaveBeenCalledTimes(1);
    const upsertCall = harness.branchVaultUpsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({
      cashBalance: new Prisma.Decimal(0),
      onlineBalance: new Prisma.Decimal(99),
    });
  });

  it("propagates errors from the underlying transaction client", async () => {
    const dbError = new Error("simulated db failure");
    harness.vaultTxCreate.mockRejectedValueOnce(dbError);

    await expect(
      creditVaultForSale(buildTx(), {
        ...baseInput,
        cashAmount: new Prisma.Decimal(100),
        onlineAmount: null,
      })
    ).rejects.toThrow("simulated db failure");
  });
});
