import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaginationMeta } from "@/lib/pagination";
import type { AuditLogFilters } from "@/lib/validators/audit-logs";

export type AuditLogRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: Prisma.JsonValue;
  createdAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: "ADMIN" | "SYSTEM_MANAGER" | "SALES_STAFF";
  };
};

export async function getAuditLogListData(filters: AuditLogFilters) {
  const where: Prisma.AuditLogWhereInput = {};

  // Filter by module prefix — action starts with "<module>."
  if (filters.module && filters.module !== "all") {
    where.action = { startsWith: `${filters.module}.` };
  }

  // Date range — both bounds are optional
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      // dateTo is end-of-day inclusive: advance by 1 day and use lt
      ...(filters.dateTo
        ? {
            lt: new Date(
              filters.dateTo.getFullYear(),
              filters.dateTo.getMonth(),
              filters.dateTo.getDate() + 1
            ),
          }
        : {}),
    };
  }

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        details: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs as AuditLogRow[],
    pagination: getPaginationMeta(filters.page, filters.pageSize, totalCount),
  };
}
