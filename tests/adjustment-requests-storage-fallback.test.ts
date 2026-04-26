import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared mock handles — hoisted so they're available inside vi.mock factories.
const harness = vi.hoisted(() => {
  return {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));

// Mock the Prisma client so `prisma.adjustmentRequest` exists (truthy — passes
// the `if (!prisma.adjustmentRequest)` guard) and every method is controllable.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adjustmentRequest: {
      findMany: harness.findMany,
      findFirst: harness.findFirst,
      count: harness.count,
    },
  },
}));

// Mock the branch-scope helper — it reads user.role, but we don't need its
// real logic; return null (ADMIN-equivalent: no scope).
vi.mock("@/lib/dal/scope", () => ({
  getBranchScope: vi.fn(() => null),
}));

import {
  getAdjustmentRequests,
  getAdjustmentRequestById,
  getPendingAdjustmentRequestCount,
} from "@/lib/dal/adjustment-requests";
import type { CurrentUser } from "@/lib/dal/auth";

// Minimal CurrentUser stand-in — the DAL only reads role/branch-related fields
// indirectly via getBranchScope, which we've mocked to return null.
const adminUser = {
  id: "admin-1",
  role: "ADMIN",
  branchId: null,
} as unknown as CurrentUser;

// Simulates Postgres "relation does not exist" bubbling up through Prisma.
// Matches the `code === "42P01"` branch of isMissingAdjustmentRequestStorageError.
function missingTableError() {
  const err = new Error('relation "AdjustmentRequest" does not exist') as Error & {
    code?: string;
  };
  err.code = "42P01";
  return err;
}

describe("adjustment-requests DAL — storage fallback", () => {
  beforeEach(() => {
    harness.findMany.mockReset();
    harness.findFirst.mockReset();
    harness.count.mockReset();
  });

  describe("getAdjustmentRequests", () => {
    it("returns [] when the AdjustmentRequest table is missing", async () => {
      harness.findMany.mockRejectedValue(missingTableError());

      const result = await getAdjustmentRequests(adminUser);

      expect(result).toEqual([]);
    });

    it("re-throws errors that are not missing-table errors", async () => {
      const other = new Error("connection refused");
      harness.findMany.mockRejectedValue(other);

      await expect(getAdjustmentRequests(adminUser)).rejects.toThrow(
        "connection refused"
      );
    });
  });

  describe("getAdjustmentRequestById", () => {
    it("returns null when the AdjustmentRequest table is missing", async () => {
      harness.findFirst.mockRejectedValue(missingTableError());

      const result = await getAdjustmentRequestById(adminUser, "any-id");

      expect(result).toBeNull();
    });

    it("re-throws errors that are not missing-table errors", async () => {
      const other = new Error("timeout");
      harness.findFirst.mockRejectedValue(other);

      await expect(
        getAdjustmentRequestById(adminUser, "any-id")
      ).rejects.toThrow("timeout");
    });
  });

  describe("getPendingAdjustmentRequestCount", () => {
    it("returns 0 when the AdjustmentRequest table is missing", async () => {
      harness.count.mockRejectedValue(missingTableError());

      const result = await getPendingAdjustmentRequestCount(adminUser);

      expect(result).toBe(0);
    });

    it("re-throws errors that are not missing-table errors", async () => {
      const other = new Error("boom");
      harness.count.mockRejectedValue(other);

      await expect(
        getPendingAdjustmentRequestCount(adminUser)
      ).rejects.toThrow("boom");
    });
  });
});
