import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/branch-prices?locationId=<id>
 *
 * Returns a map of { [productId]: priceString } for a given branch location.
 * Used by the sales order form to display the correct branch-specific price
 * when the user changes the "selling from" branch.
 *
 * Falls back to an empty object if the LocationProductPrice table doesn't
 * exist yet (migration not applied) — the form will use global prices instead.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user.role, "branch_pricing", "read")) {
    return NextResponse.json({});
  }

  const locationId = req.nextUrl.searchParams.get("locationId");

  if (!locationId) {
    return NextResponse.json({});
  }

  try {
    type RawRow = { productId: string; price: string };
    const rows = await (
      prisma.$queryRaw`
        SELECT "productId", price::text AS price
        FROM "LocationProductPrice"
        WHERE "locationId" = ${locationId}
      ` as Promise<RawRow[]>
    ).catch(() => [] as RawRow[]);

    const priceMap: Record<string, string> = {};
    for (const row of rows) {
      priceMap[row.productId] = row.price;
    }

    return NextResponse.json(priceMap);
  } catch {
    return NextResponse.json({});
  }
}
