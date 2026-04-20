import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, VaultPaymentMethod, VaultTransactionType } from "@prisma/client";

// Hoisted mock handles for the transactional client.
const harness = vi.hoisted(() => {
  return {
    vaultTxFindMany: vi.fn(),
    vaultTxCreate: vi.fn(),
    branchVaultUpdate: vi.fn(),
  };
});

// `reverseVaultForVoidedSale` lives in lib/dal/vault.ts which uses "server-only".
vi.mock("server-only", () => ({}));

// lib/dal/vault.ts also imports the prisma singleton for read-side helpers.
// This test doesn't exercise those paths, so stub the singleton to avoid
// requiring DATABASE_URL during module import.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { reverseVaultForVoidedSale } from "@/lib/dal/vault";

function buildTx() {
  return {
    vaultTransaction: {
      findMany: harness.vaultTxFindMany,
      create: harness.vaultTxCreate,
    },
    branchVault: { update: harness.branchVaultUpdate },
  } as unknown as Prisma.TransactionClient;
}

const baseInput = {
  orderId: "order-1",
  orderNumber: "SO-2026-0001",
  performedById: "user-1",
  reason: "Customer return",
};

describe("reverseVaultForVoidedSale", () => {
  beforeEach(() => {
    harness.vaultTxFindMany.mockReset();
    harness.vaultTxCreate.mockReset();
    harness.branchVaultUpdate.mockReset();
    harness.vaultTxCreate.mockResolvedValue({});
    harness.branchVaultUpdate.mockResolvedValue({});
  });

  it("reverses a cash-only sale with one VOID_REVERSAL row and a balance decrement", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "branch-1",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(150),
      },
    ]);

    await reverseVaultForVoidedSale(buildTx(), baseInput);

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(1);
    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branchId: "branch-1",
        type: VaultTransactionType.VOID_REVERSAL,
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(-150),
        referenceType: "sales_order",
        referenceId: "order-1",
        performedById: "user-1",
      }),
    });

    expect(harness.branchVaultUpdate).toHaveBeenCalledTimes(1);
    expect(harness.branchVaultUpdate).toHaveBeenCalledWith({
      where: { branchId: "branch-1" },
      data: {
        cashBalance: { decrement: new Prisma.Decimal(150) },
        onlineBalance: { decrement: new Prisma.Decimal(0) },
      },
    });
  });

  it("reverses an online-only sale with one VOID_REVERSAL row and a balance decrement", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "branch-1",
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: new Prisma.Decimal(75.5),
      },
    ]);

    await reverseVaultForVoidedSale(buildTx(), baseInput);

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(1);
    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: new Prisma.Decimal(-75.5),
      }),
    });

    expect(harness.branchVaultUpdate).toHaveBeenCalledTimes(1);
    expect(harness.branchVaultUpdate).toHaveBeenCalledWith({
      where: { branchId: "branch-1" },
      data: {
        cashBalance: { decrement: new Prisma.Decimal(0) },
        onlineBalance: { decrement: new Prisma.Decimal(75.5) },
      },
    });
  });

  it("reverses a split-tender sale with two VOID_REVERSAL rows and decrements both balances", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "branch-1",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(40),
      },
      {
        branchId: "branch-1",
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: new Prisma.Decimal(60),
      },
    ]);

    await reverseVaultForVoidedSale(buildTx(), baseInput);

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(2);

    const methods = harness.vaultTxCreate.mock.calls.map(
      (call) => call[0].data.paymentMethod
    );
    expect(methods).toContain(VaultPaymentMethod.CASH);
    expect(methods).toContain(VaultPaymentMethod.ONLINE);

    const amounts = harness.vaultTxCreate.mock.calls.map(
      (call) => call[0].data.amount.toString()
    );
    expect(amounts).toContain(new Prisma.Decimal(-40).toString());
    expect(amounts).toContain(new Prisma.Decimal(-60).toString());

    expect(harness.branchVaultUpdate).toHaveBeenCalledTimes(1);
    expect(harness.branchVaultUpdate).toHaveBeenCalledWith({
      where: { branchId: "branch-1" },
      data: {
        cashBalance: { decrement: new Prisma.Decimal(40) },
        onlineBalance: { decrement: new Prisma.Decimal(60) },
      },
    });
  });

  it("does nothing when no SALE credits exist (legacy / draft sale)", async () => {
    harness.vaultTxFindMany.mockResolvedValue([]);

    await reverseVaultForVoidedSale(buildTx(), baseInput);

    expect(harness.vaultTxCreate).not.toHaveBeenCalled();
    expect(harness.branchVaultUpdate).not.toHaveBeenCalled();
  });

  it("uses the branchId from the ledger row, not from input", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "original-branch-99",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(200),
      },
    ]);

    await reverseVaultForVoidedSale(buildTx(), baseInput);

    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ branchId: "original-branch-99" }),
    });
    expect(harness.branchVaultUpdate).toHaveBeenCalledWith({
      where: { branchId: "original-branch-99" },
      data: expect.any(Object),
    });
  });

  it("throws when SALE credits span multiple branches (data-integrity guard)", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "branch-a",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(50),
      },
      {
        branchId: "branch-b",
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: new Prisma.Decimal(50),
      },
    ]);

    await expect(
      reverseVaultForVoidedSale(buildTx(), baseInput)
    ).rejects.toThrow(/multiple branches/);

    expect(harness.vaultTxCreate).not.toHaveBeenCalled();
    expect(harness.branchVaultUpdate).not.toHaveBeenCalled();
  });

  it("propagates errors from the underlying transaction client", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "branch-1",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(100),
      },
    ]);
    const dbError = new Error("simulated db failure on insert");
    harness.vaultTxCreate.mockRejectedValueOnce(dbError);

    await expect(
      reverseVaultForVoidedSale(buildTx(), baseInput)
    ).rejects.toThrow("simulated db failure on insert");

    expect(harness.branchVaultUpdate).not.toHaveBeenCalled();
  });

  it("queries only SALE-type rows for this order", async () => {
    harness.vaultTxFindMany.mockResolvedValue([]);

    await reverseVaultForVoidedSale(buildTx(), baseInput);

    expect(harness.vaultTxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          referenceType: "sales_order",
          referenceId: "order-1",
          type: VaultTransactionType.SALE,
        },
      })
    );
  });
});
