import "server-only";

import { prisma } from "@/lib/prisma";

type PriceLookupItem = {
  productId: string;
  locationId: string;
};

type RawPriceRow = {
  productId: string;
  locationId: string;
  price: string;
};

/**
 * Batch-fetches LocationProductPrice overrides for a set of
 * (productId, locationId) pairs and returns them as a Map keyed by
 * `"${productId}:${locationId}"`.
 *
 * Uses raw SQL so it works even when the Prisma client has not yet been
 * regenerated after the migration. If the table does not exist yet (migration
 * not yet applied), the catch returns an empty Map and all callers fall back
 * to the product's global unitPrice silently.
 */
export async function buildBranchPriceMap(
  items: PriceLookupItem[]
): Promise<Map<string, number>> {
  if (items.length === 0) return new Map();

  try {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const locationIds = [...new Set(items.map((i) => i.locationId))];

    // Fetch all overrides where both productId and locationId are in the sets,
    // then filter to exact (productId, locationId) pairs client-side.
    const rows: RawPriceRow[] = await prisma.$queryRaw`
      SELECT "productId", "locationId", price::text AS price
      FROM "LocationProductPrice"
      WHERE "productId" = ANY(${productIds}::text[])
        AND "locationId" = ANY(${locationIds}::text[])
    `;

    // Only keep rows that exactly match a requested pair (the ANY query can
    // over-fetch when multiple products share a location).
    const requestedPairs = new Set(
      items.map((i) => `${i.productId}:${i.locationId}`)
    );

    return new Map(
      rows
        .filter((r) => requestedPairs.has(`${r.productId}:${r.locationId}`))
        .map((r) => [`${r.productId}:${r.locationId}`, parseFloat(r.price)])
    );
  } catch {
    // Table doesn't exist yet (migration not applied) — silently fall back
    // to global product prices so the app stays functional.
    return new Map();
  }
}

/**
 * Returns the effective selling price for a single (product, branch) pair as
 * a number. Uses the LocationProductPrice override when one exists; falls back
 * to the product's global unitPrice otherwise.
 *
 * For batch use cases (e.g. inside a sales order action), prefer
 * buildBranchPriceMap + a manual fallback loop to avoid N+1 queries.
 */
export async function getEffectiveUnitPrice(
  productId: string,
  locationId: string
): Promise<number> {
  const map = await buildBranchPriceMap([{ productId, locationId }]);
  const override = map.get(`${productId}:${locationId}`);
  if (override !== undefined) return override;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { unitPrice: true },
  });

  return product?.unitPrice.toNumber() ?? 0;
}
