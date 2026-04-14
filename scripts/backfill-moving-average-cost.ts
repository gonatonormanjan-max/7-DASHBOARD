import "dotenv/config";
import { prisma } from "../lib/prisma";

async function backfillLocationCosts() {
  const stocks = await prisma.locationStock.findMany({
    where: {
      quantity: {
        gt: 0,
      },
      product: {
        status: {
          in: ["ACTIVE", "INACTIVE"],
        },
      },
    },
    select: {
      locationId: true,
      productId: true,
      quantity: true,
      product: {
        select: {
          costPrice: true,
        },
      },
    },
  });

  for (const stock of stocks) {
    await prisma.locationProductCost.upsert({
      where: {
        locationId_productId: {
          locationId: stock.locationId,
          productId: stock.productId,
        },
      },
      create: {
        locationId: stock.locationId,
        productId: stock.productId,
        avgUnitCost: stock.product.costPrice,
        lastInboundUnitCost: stock.product.costPrice,
        onHandQtySnapshot: stock.quantity,
      },
      update: {
        onHandQtySnapshot: stock.quantity,
      },
    });
  }

  return stocks.length;
}

async function backfillSalesCostSnapshots() {
  const items = await prisma.salesOrderItem.findMany({
    where: {
      OR: [
        { unitCostAtSale: { equals: 0 } },
        { lineCogs: { equals: 0 } },
        { lineGrossProfit: { equals: 0 } },
      ],
    },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      product: {
        select: {
          costPrice: true,
        },
      },
    },
  });

  for (const item of items) {
    const fallbackCost = item.product.costPrice;
    const lineCogs = fallbackCost.mul(item.quantity);
    const lineRevenue = item.unitPrice.mul(item.quantity);
    const lineGrossProfit = lineRevenue.minus(lineCogs);

    await prisma.salesOrderItem.update({
      where: { id: item.id },
      data: {
        unitCostAtSale: fallbackCost,
        lineCogs,
        lineGrossProfit,
        isEstimatedCost: true,
      },
    });
  }

  return items.length;
}

async function main() {
  const [locationCostRows, salesRows] = await Promise.all([
    backfillLocationCosts(),
    backfillSalesCostSnapshots(),
  ]);

  console.log(
    `Backfill complete. Updated ${locationCostRows} location cost rows and ${salesRows} sales lines.`
  );
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
