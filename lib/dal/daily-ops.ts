import "server-only";

import { AdjustmentRequestStatus, LocationType, StockCountStatus, StockCountType } from "@prisma/client";
import type { CurrentUser } from "@/lib/dal/auth";
import { getSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getBranchScope } from "@/lib/dal/scope";
import { prisma } from "@/lib/prisma";
import {
  getTodayBusinessDateInput,
  type IssueReportStatusFilter,
} from "@/lib/validators/daily-ops";

function toDateOnlyValue(dateInput: string) {
  return new Date(`${dateInput}T00:00:00.000Z`);
}

export async function getAccessibleDailyOpsBranches(user: CurrentUser) {
  const branchScope = getBranchScope(user);
  const salesStaffLocationId =
    user.role === "SALES_STAFF" ? await getSalesStaffActiveLocationId(user) : null;
  const scopedBranchId = branchScope ?? salesStaffLocationId ?? undefined;

  return prisma.stockLocation.findMany({
    where: {
      isActive: true,
      type: LocationType.BRANCH,
      ...(scopedBranchId ? { id: scopedBranchId } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });
}

export async function getTodayStockCount(locationId: string, type: StockCountType) {
  const countDate = getTodayBusinessDateInput();
  const countDateValue = toDateOnlyValue(countDate);

  const [location, existingCount] = await Promise.all([
    prisma.stockLocation.findFirst({
      where: {
        id: locationId,
        isActive: true,
        type: LocationType.BRANCH,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
    prisma.stockCount.findUnique({
      where: {
        locationId_type_countDate: {
          locationId,
          type,
          countDate: countDateValue,
        },
      },
      select: {
        id: true,
        locationId: true,
        type: true,
        countDate: true,
        status: true,
        lines: {
          orderBy: [{ product: { name: "asc" } }],
          select: {
            productId: true,
            systemQty: true,
            countedQty: true,
            notes: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!location) {
    return null;
  }

  if (existingCount) {
    return {
      countDate,
      location,
      count: {
        id: existingCount.id,
        status: existingCount.status,
        type: existingCount.type,
      },
      lines: existingCount.lines.map((line) => ({
        productId: line.product.id,
        productName: line.product.name,
        sku: line.product.sku,
        systemQty: line.systemQty,
        countedQty: line.countedQty,
        discrepancy: line.countedQty - line.systemQty,
        notes: line.notes ?? "",
      })),
    };
  }

  const stockRows = await prisma.locationStock.findMany({
    where: {
      locationId,
      product: {
        status: {
          in: ["ACTIVE", "INACTIVE"],
        },
      },
    },
    orderBy: [{ product: { name: "asc" } }],
    select: {
      productId: true,
      quantity: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  });

  const lines = stockRows.map((row) => {
    const countedQty = row.quantity;

    return {
      productId: row.product.id,
      productName: row.product.name,
      sku: row.product.sku,
      systemQty: row.quantity,
      countedQty,
      discrepancy: countedQty - row.quantity,
      notes: "",
    };
  });

  return {
    countDate,
    location,
    count: null,
    lines,
  };
}

export async function getStockCountWithLines(id: string) {
  const count = await prisma.stockCount.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      countDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      location: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      submittedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      lines: {
        orderBy: [{ product: { name: "asc" } }],
        select: {
          id: true,
          systemQty: true,
          countedQty: true,
          notes: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      },
    },
  });

  if (!count) {
    return null;
  }

  return {
    ...count,
    lines: count.lines.map((line) => ({
      ...line,
      discrepancy: line.countedQty - line.systemQty,
    })),
  };
}

export async function getDiscrepancySummary(user: CurrentUser) {
  const branchScope = getBranchScope(user);
  const salesStaffLocationId =
    user.role === "SALES_STAFF" ? await getSalesStaffActiveLocationId(user) : null;
  const scopedBranchId = branchScope ?? salesStaffLocationId ?? undefined;

  const rows = await prisma.stockCount.findMany({
    where: {
      status: StockCountStatus.SUBMITTED,
      ...(scopedBranchId ? { locationId: scopedBranchId } : {}),
    },
    orderBy: [{ countDate: "desc" }, { location: { name: "asc" } }],
    select: {
      id: true,
      type: true,
      countDate: true,
      location: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      lines: {
        select: {
          systemQty: true,
          countedQty: true,
        },
      },
    },
  });

  return rows
    .map((row) => {
      const discrepancyLines = row.lines.filter(
        (line) => Math.abs(line.countedQty - line.systemQty) > 0
      );

      if (discrepancyLines.length === 0) {
        return null;
      }

      return {
        id: row.id,
        type: row.type,
        countDate: row.countDate,
        location: row.location,
        discrepancyLineCount: discrepancyLines.length,
        totalVarianceUnits: discrepancyLines.reduce(
          (sum, line) => sum + Math.abs(line.countedQty - line.systemQty),
          0
        ),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function getIssueReports(
  user: CurrentUser,
  status: IssueReportStatusFilter = "all"
) {
  const branchScope = getBranchScope(user);

  return prisma.issueReport.findMany({
    where: {
      ...(branchScope ? { branchId: branchScope } : {}),
      ...(status !== "all" ? { status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      submittedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      acknowledgedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      resolvedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

export async function getChangeFundAllocation(branchId: string) {
  return prisma.changeFundAllocation.findUnique({
    where: { branchId },
    select: {
      id: true,
      branchId: true,
      amount: true,
      notes: true,
      updatedAt: true,
      setBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

export async function getDailyOpsOverview(user: CurrentUser) {
  const branches = await getAccessibleDailyOpsBranches(user);
  const branchIds = branches.map((branch) => branch.id);
  const countDate = toDateOnlyValue(getTodayBusinessDateInput());

  const [counts, discrepancySummary, openIssueCount, pendingAdjustmentCount] = await Promise.all([
    prisma.stockCount.findMany({
      where: {
        locationId: { in: branchIds.length > 0 ? branchIds : [""] },
        countDate,
      },
      select: {
        id: true,
        type: true,
        status: true,
        locationId: true,
      },
    }),
    getDiscrepancySummary(user),
    prisma.issueReport.count({
      where: {
        branchId: { in: branchIds.length > 0 ? branchIds : [""] },
        status: { not: "RESOLVED" },
      },
    }),
    prisma.adjustmentRequest.count({
      where: {
        branchId: { in: branchIds.length > 0 ? branchIds : [""] },
        status: AdjustmentRequestStatus.PENDING,
      },
    }),
  ]);

  return {
    branches,
    counts,
    discrepancySummary,
    openIssueCount,
    pendingAdjustmentCount,
    today: getTodayBusinessDateInput(),
  };
}
