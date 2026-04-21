import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, VaultPaymentMethod, VaultTransactionType } from "@prisma/client";

const harness = vi.hoisted(() => ({
  vaultTxFindMany: vi.fn(),
  vaultTxCreate: vi.fn(),
  branchVaultUpdate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { reverseVaultForVoidedSale } from "@/lib/dal/vault";

const tx = {
  vaultTransaction: {
    findMany: harness.vaultTxFindMany,
    create: harness.vaultTxCreate,
  },
  branchVault: { update: harness.branchVaultUpdate },
} as unknown as Prisma.TransactionClient;

describe("reverseVaultForVoidedSale", () => {
  beforeEach(() => {
    harness.vaultTxFindMany.mockReset();
    harness.vaultTxCreate.mockReset();
    harness.branchVaultUpdate.mockReset();
  });

  it("is a no-op when no SALE rows exist for the order", async () => {
    harness.vaultTxFindMany.mockResolvedValue([]);

    await reverseVaultForVoidedSale(tx, {
      orderId: "o1",
      orderNumber: "SO-001",
      performedById: "u1",
      reason: "Customer return",
    });

    expect(harness.vaultTxCreate).not.toHaveBeenCalled();
    expect(harness.branchVaultUpdate).not.toHaveBeenCalled();
  });

  it("queries with the correct filters (sales_order + SALE type)", async () => {
    harness.vaultTxFindMany.mockResolvedValue([]);

    await reverseVaultForVoidedSale(tx, {
      orderId: "o-xyz",
      orderNumber: "SO-XYZ",
      performedById: "u1",
      reason: "Damaged",
    });

    expect(harness.vaultTxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          referenceType: "sales_order",
          referenceId: "o-xyz",
          type: VaultTransactionType.SALE,
        },
      })
    );
  });

  it("creates a negative CASH reversal when only cash was credited", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "b1",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(150),
      },
    ]);

    await reverseVaultForVoidedSale(tx, {
      orderId: "o1",
      orderNumber: "SO-001",
      performedById: "u1",
      reason: "Customer return",
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(1);
    const call = harness.vaultTxCreate.mock.calls[0][0];
    expect(call.data.type).toBe(VaultTransactionType.VOID_REVERSAL);
    expect(call.data.paymentMethod).toBe(VaultPaymentMethod.CASH);
    expect(call.data.amount.toString()).toBe("-150");
    expect(call.data.referenceType).toBe("sales_order");
    expect(call.data.referenceId).toBe("o1");
  });

  it("creates a negative ONLINE reversal when only online was credited", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "b1",
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: new Prisma.Decimal(500),
      },
    ]);

    await reverseVaultForVoidedSale(tx, {
      orderId: "o1",
      orderNumber: "SO-001",
      performedById: "u1",
      reason: "Customer return",
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(1);
    const call = harness.vaultTxCreate.mock.calls[0][0];
    expect(call.data.paymentMethod).toBe(VaultPaymentMethod.ONLINE);
    expect(call.data.amount.toString()).toBe("-500");
  });

  it("creates two reversal rows when both cash and online were credited (split tender)", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "b1",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(100),
      },
      {
        branchId: "b1",
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: new Prisma.Decimal(200),
      },
    ]);

    await reverseVaultForVoidedSale(tx, {
      orderId: "o1",
      orderNumber: "SO-001",
      performedById: "u1",
      reason: "Customer return",
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(2);
  });

  it("decrements BranchVault by the summed cash + online credits", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "b1",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(100),
      },
      {
        branchId: "b1",
        paymentMethod: VaultPaymentMethod.ONLINE,
        amount: new Prisma.Decimal(200),
      },
    ]);

    await reverseVaultForVoidedSale(tx, {
      orderId: "o1",
      orderNumber: "SO-001",
      performedById: "u1",
      reason: "Customer return",
    });

    expect(harness.branchVaultUpdate).toHaveBeenCalledTimes(1);
    const call = harness.branchVaultUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ branchId: "b1" });
    expect(call.data.cashBalance.decrement.toString()).toBe("100");
    expect(call.data.onlineBalance.decrement.toString()).toBe("200");
  });

  it("throws if credits span multiple branches (defensive invariant)", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "b1",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(100),
      },
      {
        branchId: "b2",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(50),
      },
    ]);

    await expect(
      reverseVaultForVoidedSale(tx, {
        orderId: "o1",
        orderNumber: "SO-001",
        performedById: "u1",
        reason: "Customer return",
      })
    ).rejects.toThrow(/multiple branches/);

    expect(harness.vaultTxCreate).not.toHaveBeenCalled();
    expect(harness.branchVaultUpdate).not.toHaveBeenCalled();
  });

  it("writes the order number and reason into the reversal row notes", async () => {
    harness.vaultTxFindMany.mockResolvedValue([
      {
        branchId: "b1",
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(100),
      },
    ]);

    await reverseVaultForVoidedSale(tx, {
      orderId: "o1",
      orderNumber: "SO-001",
      performedById: "u1",
      reason: "Customer return",
    });

    const call = harness.vaultTxCreate.mock.calls[0][0];
    expect(call.data.notes).toContain("SO-001");
    expect(call.data.notes).toContain("Customer return");
    expect(call.data.performedById).toBe("u1");
  });
});
