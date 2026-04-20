import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CashDropDestination,
  Prisma,
  VaultPaymentMethod,
  VaultTransactionType,
} from "@prisma/client";

// ── Mock hoisted handles ────────────────────────────────────────────────────
const harness = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  vaultTxCreate: vi.fn(),
  branchVaultUpdate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { createCashDropInVault } from "@/lib/dal/vault";

// ── Test-client factory ─────────────────────────────────────────────────────
function buildTx() {
  return {
    $queryRaw: harness.queryRaw,
    vaultTransaction: { create: harness.vaultTxCreate },
    branchVault: { update: harness.branchVaultUpdate },
  } as unknown as Prisma.TransactionClient;
}

const BRANCH_ID = "branch-1";
const PERFORMER_ID = "user-1";
const VAULT_TX_ID = "vt-001";

const baseInput = {
  branchId: BRANCH_ID,
  destination: CashDropDestination.SAFE,
  performedById: PERFORMER_ID,
};

/** Simulate a BranchVault row returned by $queryRaw FOR UPDATE. */
function mockVaultRow(cashBalance: string) {
  harness.queryRaw.mockResolvedValueOnce([{ cashBalance }]);
}

/** Simulate no BranchVault row (vault not yet initialized). */
function mockNoVaultRow() {
  harness.queryRaw.mockResolvedValueOnce([]);
}

describe("createCashDropInVault", () => {
  beforeEach(() => {
    harness.queryRaw.mockReset();
    harness.vaultTxCreate.mockReset();
    harness.branchVaultUpdate.mockReset();

    harness.vaultTxCreate.mockResolvedValue({ id: VAULT_TX_ID });
    harness.branchVaultUpdate.mockResolvedValue({});
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it("records a drop when amount < current balance", async () => {
    mockVaultRow("500.00");

    const result = await createCashDropInVault(buildTx(), {
      ...baseInput,
      cashAmount: new Prisma.Decimal(200),
    });

    expect(result).toEqual({ id: VAULT_TX_ID });

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(1);
    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branchId: BRANCH_ID,
        type: VaultTransactionType.CASH_DROP,
        paymentMethod: VaultPaymentMethod.CASH,
        amount: new Prisma.Decimal(-200),
        cashDropDestination: CashDropDestination.SAFE,
        performedById: PERFORMER_ID,
      }),
      select: { id: true },
    });

    expect(harness.branchVaultUpdate).toHaveBeenCalledTimes(1);
    expect(harness.branchVaultUpdate).toHaveBeenCalledWith({
      where: { branchId: BRANCH_ID },
      data: { cashBalance: { decrement: new Prisma.Decimal(200) } },
    });
  });

  it("succeeds when amount exactly equals the current balance (zero-out)", async () => {
    mockVaultRow("150.00");

    await createCashDropInVault(buildTx(), {
      ...baseInput,
      cashAmount: new Prisma.Decimal(150),
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledTimes(1);
    expect(harness.branchVaultUpdate).toHaveBeenCalledTimes(1);
  });

  // ── Destination handling ───────────────────────────────────────────────────

  it("stores destinationNote when destination is OTHERS", async () => {
    mockVaultRow("1000.00");

    await createCashDropInVault(buildTx(), {
      ...baseInput,
      cashAmount: new Prisma.Decimal(50),
      destination: CashDropDestination.OTHERS,
      destinationNote: "Given to the delivery courier",
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cashDropDestination: CashDropDestination.OTHERS,
        destinationNote: "Given to the delivery courier",
      }),
      select: { id: true },
    });
  });

  it("strips destinationNote when destination is not OTHERS", async () => {
    mockVaultRow("1000.00");

    await createCashDropInVault(buildTx(), {
      ...baseInput,
      cashAmount: new Prisma.Decimal(50),
      destination: CashDropDestination.BANK_DEPOSIT,
      destinationNote: "should be ignored",
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cashDropDestination: CashDropDestination.BANK_DEPOSIT,
        destinationNote: null,
      }),
      select: { id: true },
    });
  });

  it("stores optional notes on the ledger row", async () => {
    mockVaultRow("300.00");

    await createCashDropInVault(buildTx(), {
      ...baseInput,
      cashAmount: new Prisma.Decimal(100),
      notes: "End-of-day float handoff",
    });

    expect(harness.vaultTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notes: "End-of-day float handoff",
      }),
      select: { id: true },
    });
  });

  // ── Guard: no vault row ────────────────────────────────────────────────────

  it("throws when no BranchVault row exists for the branch", async () => {
    mockNoVaultRow();

    await expect(
      createCashDropInVault(buildTx(), {
        ...baseInput,
        cashAmount: new Prisma.Decimal(100),
      })
    ).rejects.toThrow(/no vault/i);

    expect(harness.vaultTxCreate).not.toHaveBeenCalled();
    expect(harness.branchVaultUpdate).not.toHaveBeenCalled();
  });

  // ── Guard: amount exceeds balance ──────────────────────────────────────────

  it("throws when amount exceeds current cash balance", async () => {
    mockVaultRow("99.00");

    await expect(
      createCashDropInVault(buildTx(), {
        ...baseInput,
        cashAmount: new Prisma.Decimal(100),
      })
    ).rejects.toThrow(/exceeds current cash balance/i);

    expect(harness.vaultTxCreate).not.toHaveBeenCalled();
    expect(harness.branchVaultUpdate).not.toHaveBeenCalled();
  });

  it("throws when amount exceeds balance by a fraction", async () => {
    mockVaultRow("99.99");

    await expect(
      createCashDropInVault(buildTx(), {
        ...baseInput,
        cashAmount: new Prisma.Decimal("100.00"),
      })
    ).rejects.toThrow(/exceeds current cash balance/i);
  });

  // ── Guard: non-positive amount ─────────────────────────────────────────────

  it("throws when amount is zero", async () => {
    await expect(
      createCashDropInVault(buildTx(), {
        ...baseInput,
        cashAmount: new Prisma.Decimal(0),
      })
    ).rejects.toThrow(/greater than zero/i);

    expect(harness.queryRaw).not.toHaveBeenCalled();
  });

  // ── Error propagation ──────────────────────────────────────────────────────

  it("propagates db errors from vaultTransaction.create", async () => {
    mockVaultRow("500.00");
    harness.vaultTxCreate.mockRejectedValueOnce(new Error("db write failure"));

    await expect(
      createCashDropInVault(buildTx(), {
        ...baseInput,
        cashAmount: new Prisma.Decimal(100),
      })
    ).rejects.toThrow("db write failure");
  });

  it("propagates db errors from branchVault.update", async () => {
    mockVaultRow("500.00");
    harness.branchVaultUpdate.mockRejectedValueOnce(new Error("balance update failed"));

    await expect(
      createCashDropInVault(buildTx(), {
        ...baseInput,
        cashAmount: new Prisma.Decimal(100),
      })
    ).rejects.toThrow("balance update failed");
  });
});
