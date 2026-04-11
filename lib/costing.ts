import { Prisma } from "@prisma/client";

export const MOVING_AVERAGE_VALUATION_METHOD = "Moving Average (per location)";
export const COST_SHOCK_WARNING_THRESHOLD = 0.1;
export const COST_SHOCK_ESCALATION_THRESHOLD = 0.15;

type CostingClient = Prisma.TransactionClient;

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

export type InboundMovingAverageResult = {
  prevAvgUnitCost: Prisma.Decimal;
  newAvgUnitCost: Prisma.Decimal;
  changePct: Prisma.Decimal | null;
  isCostShock: boolean;
};

export function toMoneyDecimal(value: DecimalInput) {
  const numeric = typeof value === "string" ? Number(value) : Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;
  return new Prisma.Decimal(safeValue.toFixed(2));
}

function toPercentDecimal(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Prisma.Decimal(value.toFixed(4));
}

function calcWeightedAverageCost(input: {
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
  const [locationCost, product] = await Promise.all([
    tx.locationProductCost.findUnique({
      where: {
        locationId_productId: {
          locationId: input.locationId,
          productId: input.productId,
        },
      },
      select: {
        avgUnitCost: true,
      },
    }),
    tx.product.findUnique({
      where: { id: input.productId },
      select: { costPrice: true },
    }),
  ]);

  if (!product) {
    throw new Error(`Product ${input.productId} was not found while resolving sale cost.`);
  }

  if (locationCost && locationCost.avgUnitCost.toNumber() > 0) {
    return {
      unitCost: locationCost.avgUnitCost,
      isEstimatedCost: false,
      source: "location_avg",
    };
  }

  return {
    unitCost: product.costPrice,
    isEstimatedCost: true,
    source: "product_default",
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
  await tx.locationProductCost.updateMany({
    where: {
      locationId: input.locationId,
      productId: input.productId,
    },
    data: {
      onHandQtySnapshot: Math.max(0, Math.floor(input.onHandQtySnapshot)),
    },
  });
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

  const { nextAvgUnitCost, onHandAfter } = calcWeightedAverageCost({
    onHandBefore: safeOnHandBefore,
    prevAvgUnitCost,
    inboundQty: inboundQtyWhole,
    inboundUnitCost: inboundCostNumber,
  });

  const newAvgUnitCostDecimal = toMoneyDecimal(nextAvgUnitCost);
  const changePctValue =
    prevAvgUnitCost > 0 ? (newAvgUnitCostDecimal.toNumber() - prevAvgUnitCost) / prevAvgUnitCost : null;
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
}
