import "server-only";

import { prisma } from "@/lib/prisma";
import { getBranchScope } from "@/lib/dal/scope";
import type { CurrentUser } from "@/lib/dal/auth";

export type LocationProductPriceRow = {
  id: string;
  locationId: string;
  productId: string;
  price: string; // serialized Decimal as string
  updatedAt: Date;
  location: { id: string; name: string; code: string };
};

// Raw shape returned by $queryRaw — column aliases are lowercase
type RawPriceWithLocation = {
  id: string;
  locationId: string;
  productId: string;
  price: string;
  updatedAt: Date;
  loc_id: string;
  loc_name: string;
  loc_code: string;
};

/**
 * Returns all branch-level price overrides for a product.
 *
 * Scope rules:
 * - MANAGER   → only the override for their assigned branch (if any)
 * - All others → all overrides, ordered by branch name
 *
 * Uses raw SQL so it works even before `prisma generate` is re-run.
 * Returns [] gracefully when the table does not yet exist.
 */
export async function getBranchPricesForProduct(
  productId: string,
  user: CurrentUser
): Promise<LocationProductPriceRow[]> {
  const branchScope = getBranchScope(user);

  try {
    const rows: RawPriceWithLocation[] = branchScope
      ? await prisma.$queryRaw`
          SELECT
            lpp.id,
            lpp."locationId",
            lpp."productId",
            lpp.price::text AS price,
            lpp."updatedAt",
            sl.id      AS loc_id,
            sl.name    AS loc_name,
            sl.code    AS loc_code
          FROM "LocationProductPrice" lpp
          JOIN "StockLocation" sl ON sl.id = lpp."locationId"
          WHERE lpp."productId"  = ${productId}
            AND lpp."locationId" = ${branchScope}
          ORDER BY sl.name
        `
      : await prisma.$queryRaw`
          SELECT
            lpp.id,
            lpp."locationId",
            lpp."productId",
            lpp.price::text AS price,
            lpp."updatedAt",
            sl.id      AS loc_id,
            sl.name    AS loc_name,
            sl.code    AS loc_code
          FROM "LocationProductPrice" lpp
          JOIN "StockLocation" sl ON sl.id = lpp."locationId"
          WHERE lpp."productId" = ${productId}
          ORDER BY sl.name
        `;

    return rows.map((r) => ({
      id: r.id,
      locationId: r.locationId,
      productId: r.productId,
      price: r.price,
      updatedAt: r.updatedAt,
      location: { id: r.loc_id, name: r.loc_name, code: r.loc_code },
    }));
  } catch {
    return [];
  }
}

/**
 * Returns active BRANCH locations that do NOT yet have a price override for
 * the given product. Used to populate the "Add override" branch selector.
 *
 * Scope rules:
 * - MANAGER   → at most one result: their own branch, only if it has no override
 * - All others → all unpriced active branches
 *
 * Falls back to returning all active branches if the table doesn't exist yet
 * (migration not applied), so the form still renders.
 */
export async function getUnpricedBranchesForProduct(
  productId: string,
  user: CurrentUser
): Promise<{ id: string; name: string; code: string }[]> {
  const branchScope = getBranchScope(user);

  try {
    if (branchScope) {
      return prisma.$queryRaw`
        SELECT sl.id, sl.name, sl.code
        FROM "StockLocation" sl
        WHERE sl.type = 'BRANCH'
          AND sl."isActive" = true
          AND sl.id = ${branchScope}
          AND NOT EXISTS (
            SELECT 1 FROM "LocationProductPrice" lpp
            WHERE lpp."locationId" = sl.id
              AND lpp."productId"  = ${productId}
          )
        ORDER BY sl.name
      `;
    }

    return prisma.$queryRaw`
      SELECT sl.id, sl.name, sl.code
      FROM "StockLocation" sl
      WHERE sl.type = 'BRANCH'
        AND sl."isActive" = true
        AND NOT EXISTS (
          SELECT 1 FROM "LocationProductPrice" lpp
          WHERE lpp."locationId" = sl.id
            AND lpp."productId"  = ${productId}
        )
      ORDER BY sl.name
    `;
  } catch {
    // Table doesn't exist yet — fall back to all active branches so the
    // "Add override" selector still populates.
    return prisma.stockLocation.findMany({
      where: {
        type: "BRANCH",
        isActive: true,
        ...(branchScope ? { id: branchScope } : {}),
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }
}
