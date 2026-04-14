import { Prisma } from "@prisma/client";
import { logServerWarning } from "@/lib/logger";

export const MOVING_AVERAGE_VALUATION_METHOD = "Moving Average (per location)";
export const COST_SHOCK_WARNING_THRESHOLD = 0.1;
export const COST_SHOCK_ESCALATION_THRESHOLD = 0.15;

type CostingClient = Prisma.TransactionClient;
type SqlQueryClient = Pick<CostingClient, "$queryRaw">;

type DecimalInput = Prisma.Decimal | number | string;

export type SaleCostSnapshot = {
  unitCost: Prisma.Decimal;
  isEstimatedCost: boolean;
  source: "location_avg" | "product_default";
};

type ApplyInboundMovingAverageInput = {
  tx: CostingClient;
  locationId: string;
  productId: string;
  onHandBefore: number;
  inboundQty: number;
  inboundUnitCost: DecimalInput;
  performedById: string;
  sourceType: string;
  sourceId?: string | null;
  reason?: string | null;
};

type RecordOutboundCostHistoryInput = {
  tx: CostingClient;
  locationId: string;
  productId: string;
  outboundQty: number;
  outboundUnitCost: DecimalInput;
  performedById: string;
  sourceType: string;
  sourceId?: string | null;
  reason?: string | null;
};

export type InboundMovingAverageResult = {
  prevAvgUnitCost: Prisma.Decimal;
  newAvgUnitCost: Prisma.Decimal;
  changePct: Prisma.Decimal | null;
  isCostShock: boolean;
};

const COSTING_TABLE_CHECK_CACHE_MS = 60_000;
let costingPersistenceCache: { checkedAt: number; isAvailable: boolean } | null = null;
let hasLoggedMissingCostingTable = false;

export function toMoneyDecimal(value: DecimalInput) {
  const numeric = typeof value === "string" ? Number(value) : Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;
  return new Prisma.Decimal(safeValue.toFixed(2));
}

function updateCostingPersistenceCache(isAvailable: boolean) {
  costingPersistenceCache = {
    checkedAt: Date.now(),
    isAvailable,
  };
}

function logMissingCostingTableWarning(context: string, error: unknown) {
  if (hasLoggedMissingCostingTable) {
    return;
  }

  hasLoggedMissingCostingTable = true;
  const detail = error instanceof Error ? error.message : "Unknown Prisma error.";
  logServerWarning("costing.missing_costing_tables", {
    context,
    detail,
    fallback:
      "Using product default cost and skipping moving-average persistence until migrations are applied.",
  });
}

export function isMissingCostingTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    const modelName =
      typeof error.meta === "object" && error.meta && "modelName" in error.meta
        ? String((error.meta as { modelName?: unknown }).modelName ?? "")
        : "";
    return modelName === "LocationProductCost" || modelName === "ProductCostHistory";
  }

  if (error instanceof Error) {
    return (
      error.message.includes("LocationProductCost") || error.message.includes("ProductCostHistory")
    );
  }

  return false;
}

export async function isCostingPersistenceAvailable(client: SqlQueryClient) {
  if (
    costingPersistenceCache &&
    Date.now() - costingPersistenceCache.checkedAt <= COSTING_TABLE_CHECK_CACHE_MS
  ) {
    return costingPersistenceCache.isAvailable;
  }

  try {
    const rows = await client.$queryRaw<
      Array<{
        locationProductCostTable: string | null;
        productCostHistoryTable: string | null;
      }>
    >(Prisma.sql`
      SELECT
        to_regclass('public."LocationProductCost"') AS "locationProductCostTable",
        to_regclass('public."ProductCostHistory"') AS "productCostHistoryTable"
    `);
    const row = rows[0];
    const isAvailable = Boolean(row?.locationProductCostTable && row?.productCostHistoryTable);
    updateCostingPersistenceCache(isAvailable);
    return isAvailable;
  } catch {
    // If introspection fails, keep existing behavior and let normal queries decide.
    updateCostingPersistenceCache(true);
    return true;
  }
}

function toPercentDecimal(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Prisma.Decimal(value.toFixed(4));
}

export function calculateWeightedAverageCost(input: {
  onHandBefore: number;
  prevAvgUnitCost: number;
  inboundQty: number;
  inboundUnitCost: number;
}) {
  const safeOnHandBefore = Math.max(0, Math.floor(input.onHandBefore));
  const safeInboundQty = Math.max(0, Math.floor(input.inboundQty));

  if (safeInboundQty === 0) {
    return {
      nextAvgUnitCost: input.prevAvgUnitCost,
      onHandAfter: safeOnHandBefore,
    };
  }

  if (safeOnHandBefore === 0) {
    return {
      nextAvgUnitCost: input.inboundUnitCost,
      onHandAfter: safeInboundQty,
    };
  }

  const onHandAfter = safeOnHandBefore + safeInboundQty;
  const nextAvgUnitCost =
    (safeOnHandBefore * input.prevAvgUnitCost + safeInboundQty * input.inboundUnitCost) /
    onHandAfter;

  return {
    nextAvgUnitCost,
    onHandAfter,
  };
}

export async function getSaleCostSnapshot(
  tx: CostingClient,
  input: {
    locationId: string;
    productId: string;
  }
): Promise<SaleCostSnapshot> {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { costPrice: true },
  });

  if (!product) {
    throw new Error(`Product ${input.productId} was not found while resolving sale cost.`);
  }

  if (!(await isCostingPersistenceAvailable(tx))) {
    return {
      unitCost: product.costPrice,
      isEstimatedCost: true,
      source: "product_default",
    };
  }

  try {
    const locationCost = await tx.locationProductCost.findUnique({
      where: {
        locationId_productId: {
          locationId: input.locationId,
          productId: input.productId,
        },
      },
      select: {
        avgUnitCost: true,
      },
    });

    if (locationCost && locationCost.avgUnitCost.toNumber() > 0) {
      return {
        unitCost: locationCost.avgUnitCost,
        isEstimatedCost: false,
        source: "location_avg",
      };
    }
  } catch (error) {
    if (!isMissingCostingTableError(error)) {
      throw error;
    }
    updateCostingPersistenceCache(false);
    logMissingCostingTableWarning("resolving sale cost snapshot", error);
  }

  return {
    unitCost: product.costPrice,
    isEstimatedCost: true,
    source: "product_default",
  };
}

function buildFallbackInboundResult(inboundUnitCost: Prisma.Decimal): InboundMovingAverageResult {
  return {
    prevAvgUnitCost: inboundUnitCost,
    newAvgUnitCost: inboundUnitCost,
    changePct: null,
    isCostShock: false,
  };
}

export async function syncLocationCostSnapshot(
  tx: CostingClient,
  input: {
    locationId: string;
    productId: string;
    onHandQtySnapshot: number;
  }
) {
  if (!(await isCostingPersistenceAvailable(tx))) {
    return;
  }

  try {
    await tx.locationProductCost.updateMany({
      where: {
        locationId: input.locationId,
        productId: input.productId,
      },
      data: {
        onHandQtySnapshot: Math.max(0, Math.floor(input.onHandQtySnapshot)),
      },
    });
  } catch (error) {
    if (!isMissingCostingTableError(error)) {
      throw error;
    }
    updateCostingPersistenceCache(false);
    logMissingCostingTableWarning("syncing location cost snapshot", error);
  }
}

export async function recordOutboundCostHistory({
  tx,
  locationId,
  productId,
  outboundQty,
  outboundUnitCost,
  performedById,
  sourceType,
  sourceId = null,
  reason = null,
}: RecordOutboundCostHistoryInput): Promise<void> {
  const outboundQtyWhole = Math.max(0, Math.floor(outboundQty));

  if (outboundQtyWhole === 0) {
    return;
  }

  const outboundCostDecimal = toMoneyDecimal(outboundUnitCost);

  if (!(await isCostingPersistenceAvailable(tx))) {
    return;
  }

  try {
    const existingCost = await tx.locationProductCost.findUnique({
      where: {
        locationId_productId: {
          locationId,
          productId,
        },
      },
      select: {
        avgUnitCost: true,
      },
    });

    const avgUnitCostDecimal =
      existingCost?.avgUnitCost && existingCost.avgUnitCost.toNumber() > 0
        ? existingCost.avgUnitCost
        : outboundCostDecimal;

    await tx.productCostHistory.create({
      data: {
        locationId,
        productId,
        inboundQty: -outboundQtyWhole,
        inboundUnitCost: outboundCostDecimal,
        prevAvgUnitCost: avgUnitCostDecimal,
        newAvgUnitCost: avgUnitCostDecimal,
        sourceType,
        sourceId,
        changePct: toPercentDecimal(0),
        reason,
        changedById: performedById,
      },
    });
  } catch (error) {
    if (!isMissingCostingTableError(error)) {
      throw error;
    }
    updateCostingPersistenceCache(false);
    logMissingCostingTableWarning("recording outbound cost history", error);
  }
}

export async function applyInboundMovingAverage({
  tx,
  locationId,
  productId,
  onHandBefore,
  inboundQty,
  inboundUnitCost,
  performedById,
  sourceType,
  sourceId = null,
  reason = null,
}: ApplyInboundMovingAverageInput): Promise<InboundMovingAverageResult> {
  const inboundQtyWhole = Math.max(0, Math.floor(inboundQty));
  const inboundCostDecimal = toMoneyDecimal(inboundUnitCost);
  const inboundCostNumber = inboundCostDecimal.toNumber();
  const safeOnHandBefore = Math.max(0, Math.floor(onHandBefore));

  if (!(await isCostingPersistenceAvailable(tx))) {
    return buildFallbackInboundResult(inboundCostDecimal);
  }

  try {
    const existingCost = await tx.locationProductCost.findUnique({
      where: {
        locationId_productId: {
          locationId,
          productId,
        },
      },
      select: {
        avgUnitCost: true,
      },
    });

    const prevAvgUnitCostDecimal =
      existingCost?.avgUnitCost && existingCost.avgUnitCost.toNumber() > 0
        ? existingCost.avgUnitCost
        : inboundCostDecimal;
    const prevAvgUnitCost = prevAvgUnitCostDecimal.toNumber();

    const { nextAvgUnitCost, onHandAfter } = calculateWeightedAverageCost({
      onHandBefore: safeOnHandBefore,
      prevAvgUnitCost,
      inboundQty: inboundQtyWhole,
      inboundUnitCost: inboundCostNumber,
    });

    const newAvgUnitCostDecimal = toMoneyDecimal(nextAvgUnitCost);
    const changePctValue =
      prevAvgUnitCost > 0
        ? (newAvgUnitCostDecimal.toNumber() - prevAvgUnitCost) / prevAvgUnitCost
        : null;
    const changePctDecimal = toPercentDecimal(changePctValue);
    const isCostShock =
      changePctValue !== null && Math.abs(changePctValue) >= COST_SHOCK_WARNING_THRESHOLD;

    await tx.locationProductCost.upsert({
      where: {
        locationId_productId: {
          locationId,
          productId,
        },
      },
      create: {
        locationId,
        productId,
        avgUnitCost: newAvgUnitCostDecimal,
        lastInboundUnitCost: inboundCostDecimal,
        onHandQtySnapshot: onHandAfter,
      },
      update: {
        avgUnitCost: newAvgUnitCostDecimal,
        lastInboundUnitCost: inboundCostDecimal,
        onHandQtySnapshot: onHandAfter,
      },
    });

    await tx.productCostHistory.create({
      data: {
        locationId,
        productId,
        inboundQty: inboundQtyWhole,
        inboundUnitCost: inboundCostDecimal,
        prevAvgUnitCost: prevAvgUnitCostDecimal,
        newAvgUnitCost: newAvgUnitCostDecimal,
        sourceType,
        sourceId,
        changePct: changePctDecimal,
        reason,
        changedById: performedById,
      },
    });

    return {
      prevAvgUnitCost: prevAvgUnitCostDecimal,
      newAvgUnitCost: newAvgUnitCostDecimal,
      changePct: changePctDecimal,
      isCostShock,
    };
  } catch (error) {
    if (!isMissingCostingTableError(error)) {
      throw error;
    }
    updateCostingPersistenceCache(false);
    logMissingCostingTableWarning("applying inbound moving average", error);
    return buildFallbackInboundResult(inboundCostDecimal);
  }
}
