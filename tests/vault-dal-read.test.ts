import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, VaultPaymentMethod, VaultTransactionType } from "@prisma/client";

// Hoisted mock handles.
const harness = vi.hoisted(() => {
  return {
    branchVaultFindUnique: vi.fn(),
    vaultTxCount: vi.fn(),
    vaultTxFindMany: vi.fn(),
    stockLocationFindMany: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    branchVault: { findUnique: harness.branchVaultFindUnique },
    vaultTransaction: {
      count: harness.vaultTxCount,
      findMany: harness.vaultTxFindMany,
    },
    stockLocation: { findMany: harness.stockLocationFindMany },
  },
}));

vi.mock("@/lib/dal/scope", () => ({
  getBranchScope: (user: { role: string; assignedLocationId?: string | null }) =>
    user.role === "MANAGER" ? user.assignedLocationId ?? null : null,
}));

import {
  getAccessibleVaultBranches,
  getBranchVaultBalance,
  getVaultLedger,
} from "@/lib/dal/vault";
import type { CurrentUser } from "@/lib/dal/auth";

const adminUser = {
  id: "admin-1",
  role: "ADMIN",
  assignedLocationId: null,
} as unknown as CurrentUser;

const managerUser = {
  id: "manager-1",
  role: "MANAGER",
  assignedLocationId: "branch-b",
} as unknown as CurrentUser;

function missingTableError() {
  const err = new Error('relation "BranchVault" does not exist') as Error & {
    code?: string;
  };
  err.code = "42P01";
  return err;
}

describe("vault DAL — read helpers", () => {
  beforeEach(() => {
    harness.branchVaultFindUnique.mockReset();
    harness.vaultTxCount.mockReset();
    harness.vaultTxFindMany.mockReset();
    harness.stockLocationFindMany.mockReset();
  });

  describe("getAccessibleVaultBranches", () => {
    it("returns all active BRANCH locations for ADMIN", async () => {
      harness.stockLocationFindMany.mockResolvedValue([
        { id: "branch-a", name: "Main", code: "MAIN" },
        { id: "branch-b", name: "North", code: "NORTH" },
      ]);

      const result = await getAccessibleVaultBranches(adminUser);

      expect(result).toHaveLength(2);
      expect(harness.stockLocationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, type: "BRANCH" },
        })
      );
    });

    it("scopes MANAGER to their assigned branch only", async () => {
      harness.stockLocationFindMany.mockResolvedValue([
        { id: "branch-b", name: "North", code: "NORTH" },
      ]);

      await getAccessibleVaultBranches(managerUser);

      expect(harness.stockLocationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, type: "BRANCH", id: "branch-b" },
        })
      );
    });
  });

  describe("getBranchVaultBalance", () => {
    it("returns the row when it exists", async () => {
      const updatedAt = new Date("2026-04-18T10:00:00Z");
      harness.branchVaultFindUnique.mockResolvedValue({
        branchId: "branch-a",
        cashBalance: new Prisma.Decimal(500),
        onlineBalance: new Prisma.Decimal(1200.5),
        lastUpdatedAt: updatedAt,
      });

      const result = await getBranchVaultBalance("branch-a");

      expect(result.cashBalance.toString()).toBe("500");
      expect(result.onlineBalance.toString()).toBe("1200.5");
      expect(result.lastUpdatedAt).toEqual(updatedAt);
    });

    it("returns zeros with null lastUpdatedAt when no BranchVault row exists", async () => {
      harness.branchVaultFindUnique.mockResolvedValue(null);

      const result = await getBranchVaultBalance("branch-a");

      expect(result.cashBalance.toString()).toBe("0");
      expect(result.onlineBalance.toString()).toBe("0");
      expect(result.lastUpdatedAt).toBeNull();
    });

    it("returns zero-balance fallback when the BranchVault table is missing", async () => {
      harness.branchVaultFindUnique.mockRejectedValue(missingTableError());

      const result = await getBranchVaultBalance("branch-a");

      expect(result.cashBalance.toString()).toBe("0");
      expect(result.lastUpdatedAt).toBeNull();
    });

    it("re-throws errors that are not missing-table errors", async () => {
      harness.branchVaultFindUnique.mockRejectedValue(
        new Error("connection refused")
      );

      await expect(getBranchVaultBalance("branch-a")).rejects.toThrow(
        "connection refused"
      );
    });
  });

  describe("getVaultLedger", () => {
    it("passes branchId, type, and method filters to the Prisma query", async () => {
      harness.vaultTxCount.mockResolvedValue(0);
      harness.vaultTxFindMany.mockResolvedValue([]);

      await getVaultLedger({
        branchId: "branch-a",
        type: VaultTransactionType.SALE,
        paymentMethod: VaultPaymentMethod.CASH,
        page: 1,
        pageSize: 25,
      });

      expect(harness.vaultTxFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            branchId: "branch-a",
            type: VaultTransactionType.SALE,
            paymentMethod: VaultPaymentMethod.CASH,
          },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 25,
        })
      );
    });

    it("builds a createdAt range when dateFrom/dateTo are provided", async () => {
      harness.vaultTxCount.mockResolvedValue(0);
      harness.vaultTxFindMany.mockResolvedValue([]);

      const from = new Date("2026-04-01T16:00:00Z");
      const to = new Date("2026-04-15T16:00:00Z");

      await getVaultLedger({
        branchId: "branch-a",
        dateFrom: from,
        dateTo: to,
        page: 1,
        pageSize: 25,
      });

      expect(harness.vaultTxFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            branchId: "branch-a",
            createdAt: { gte: from, lt: to },
          },
        })
      );
    });

    it("computes correct skip/take for page 3 with pageSize 10", async () => {
      harness.vaultTxCount.mockResolvedValue(0);
      harness.vaultTxFindMany.mockResolvedValue([]);

      await getVaultLedger({
        branchId: "branch-a",
        page: 3,
        pageSize: 10,
      });

      expect(harness.vaultTxFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });

    it("returns the rows and pagination meta", async () => {
      harness.vaultTxCount.mockResolvedValue(1);
      harness.vaultTxFindMany.mockResolvedValue([
        {
          id: "vt-1",
          type: VaultTransactionType.SALE,
          paymentMethod: VaultPaymentMethod.CASH,
          amount: new Prisma.Decimal(100),
          referenceType: "sales_order",
          referenceId: "order-1",
          notes: "Cash payment",
          createdAt: new Date("2026-04-18T10:00:00Z"),
          performedBy: { id: "u-1", firstName: "Ana", lastName: "Cruz" },
        },
      ]);

      const result = await getVaultLedger({
        branchId: "branch-a",
        page: 1,
        pageSize: 25,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe("vt-1");
      expect(result.pagination.totalCount).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it("returns empty rows + zero pagination when the VaultTransaction table is missing", async () => {
      harness.vaultTxCount.mockRejectedValue(missingTableError());
      harness.vaultTxFindMany.mockRejectedValue(missingTableError());

      const result = await getVaultLedger({
        branchId: "branch-a",
        page: 1,
        pageSize: 25,
      });

      expect(result.rows).toEqual([]);
      expect(result.pagination.totalCount).toBe(0);
    });

    it("re-throws errors that are not missing-table errors", async () => {
      harness.vaultTxCount.mockRejectedValue(new Error("boom"));
      harness.vaultTxFindMany.mockRejectedValue(new Error("boom"));

      await expect(
        getVaultLedger({ branchId: "branch-a", page: 1, pageSize: 25 })
      ).rejects.toThrow("boom");
    });
  });
});
