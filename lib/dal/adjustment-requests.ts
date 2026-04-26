import "server-only";

import { AdjustmentRequestStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/dal/auth";
import { getBranchScope } from "@/lib/dal/scope";

const adjustmentRequestSelect = {
  id: true,
  direction: true,
  quantity: true,
  reason: true,
  notes: true,
  status: true,
  requestedAt: true,
  reviewedAt: true,
  reviewNotes: true,
  branch: {
    select: { id: true, name: true, code: true },
  },
  product: {
    select: { id: true, name: true, sku: true },
  },
  requestedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  reviewedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

export type AdjustmentRequestRow = {
  id: string;
  direction: string;
  quantity: number;
  reason: string;
  notes: string | null;
  status: AdjustmentRequestStatus;
  requestedAt: Date;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  branch: { id: string; name: string; code: string };
  product: { id: string; name: string; sku: string };
  requestedBy: { id: string; firstName: string; lastName: string };
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
};

function isMissingAdjustmentRequestStorageError(error: unknown) {
  const errorLike = error as
    | {
        code?: unknown;
        message?: unknown;
        meta?: unknown;
      }
    | undefined;
  const code = typeof errorLike?.code === "string" ? errorLike.code : "";
  const message = typeof errorLike?.message === "string" ? errorLike.message : "";
  const metaCode =
    typeof errorLike?.meta === "object" &&
    errorLike.meta !== null &&
    "code" in errorLike.meta &&
    typeof errorLike.meta.code === "string"
      ? errorLike.meta.code
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
    message.includes('relation "AdjustmentRequest" does not exist') ||
    message.includes('relation "adjustmentrequest" does not exist')
  );
}

/**
 * Returns all adjustment requests visible to the given user.
 * - MANAGER: only requests for their own branch
 * - ADMIN / SYSTEM_MANAGER: all requests
 *
 * Results are sorted: PENDING first, then by requestedAt descending.
 * Returns [] safely if the Prisma client hasn't been regenerated yet.
 */
export async function getAdjustmentRequests(
  user: CurrentUser,
  statusFilter?: AdjustmentRequestStatus | "all"
): Promise<AdjustmentRequestRow[]> {
  if (!prisma.adjustmentRequest) {
    return [];
  }

  const branchScope = getBranchScope(user);

  try {
    const rows = await prisma.adjustmentRequest.findMany({
      where: {
        ...(branchScope ? { branchId: branchScope } : {}),
        ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
      },
      select: adjustmentRequestSelect,
      orderBy: [
        // PENDING requests always surface first
        { status: "asc" },
        { requestedAt: "desc" },
      ],
    });

    return rows as AdjustmentRequestRow[];
  } catch (error) {
    if (isMissingAdjustmentRequestStorageError(error)) {
      return [];
    }
    throw error;
  }
}

/**
 * Returns a single adjustment request by id.
 * Enforces branch scope for MANAGER role.
 * Returns null safely if the Prisma client hasn't been regenerated yet.
 */
export async function getAdjustmentRequestById(
  id: string,
  user: CurrentUser
): Promise<AdjustmentRequestRow | null> {
  if (!prisma.adjustmentRequest) {
    return null;
  }

  const branchScope = getBranchScope(user);

  try {
    const row = await prisma.adjustmentRequest.findFirst({
      where: {
        id,
        ...(branchScope ? { branchId: branchScope } : {}),
      },
      select: adjustmentRequestSelect,
    });

    return (row as AdjustmentRequestRow | null) ?? null;
  } catch (error) {
    if (isMissingAdjustmentRequestStorageError(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Returns the count of PENDING adjustment requests visible to the user.
 * Used to show the badge on the admin dashboard.
 *
 * Returns 0 safely if the Prisma client has not yet been regenerated after
 * the schema migration (prisma generate not yet run locally or on deploy).
 */
export async function getPendingAdjustmentRequestCount(
  user: CurrentUser
): Promise<number> {
  // Guard: prisma.adjustmentRequest is undefined if the client hasn't been
  // regenerated with the new schema yet. Safe fallback until `prisma generate`
  // is run.
  if (!prisma.adjustmentRequest) {
    return 0;
  }

  const branchScope = getBranchScope(user);

  try {
    return await prisma.adjustmentRequest.count({
      where: {
        status: AdjustmentRequestStatus.PENDING,
        ...(branchScope ? { branchId: branchScope } : {}),
      },
    });
  } catch (error) {
    if (isMissingAdjustmentRequestStorageError(error)) {
      return 0;
    }
    throw error;
  }
}
