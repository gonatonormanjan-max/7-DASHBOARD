import "server-only";

import type { CurrentUser } from "@/lib/dal/auth";

/**
 * Returns the locationId that should be used to filter branch-level data
 * for the given user.
 *
 * - MANAGER: always scoped to their assignedLocationId
 * - All other roles: null (unrestricted — they see all branches)
 *
 * Usage in DAL queries:
 *   const branchScope = getBranchScope(user);
 *   where: {
 *     ...(branchScope ? { locationId: branchScope } : {}),
 *     ...otherFilters,
 *   }
 */
export function getBranchScope(user: CurrentUser): string | null {
  if (user.role === "MANAGER") {
    return user.assignedLocationId ?? null;
  }
  return null;
}

/**
 * Returns true if the given locationId is accessible to the user.
 * MANAGER can only access their own branch. All other roles can access any location.
 */
export function canAccessLocation(user: CurrentUser, locationId: string): boolean {
  if (user.role === "MANAGER") {
    return user.assignedLocationId === locationId;
  }
  return true;
}

/**
 * Builds a Prisma `where` clause fragment scoping by locationId for MANAGER.
 * Returns an empty object for roles with unrestricted access.
 *
 * @param user       The current authenticated user
 * @param field      The Prisma field name to scope on (default: "locationId")
 */
export function buildLocationScope(
  user: CurrentUser,
  field: string = "locationId"
): Record<string, string> {
  const branchScope = getBranchScope(user);
  if (!branchScope) return {};
  return { [field]: branchScope };
}
