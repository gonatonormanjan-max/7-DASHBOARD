import "server-only";

import { LocationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserListFilters } from "@/lib/validators/users";

export async function getUserListData(filters: UserListFilters) {
  const where: Prisma.UserWhereInput = {
    ...(filters.query
      ? {
          OR: [
            { firstName: { contains: filters.query, mode: "insensitive" } },
            { lastName: { contains: filters.query, mode: "insensitive" } },
            { email: { contains: filters.query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.role !== "all" ? { role: filters.role } : {}),
    ...(filters.status === "active"
      ? { isActive: true }
      : filters.status === "inactive"
        ? { isActive: false }
        : {}),
  };

  const [users, groupedByRole, groupedByStatus] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        assignedLocation: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdAt: true,
      },
    }),
    prisma.user.groupBy({
      by: ["role"],
      where,
      _count: {
        _all: true,
      },
    }),
    prisma.user.groupBy({
      by: ["isActive"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);

  return {
    users,
    summary: {
      total: users.length,
      admins: groupedByRole.find((item) => item.role === "ADMIN")?._count._all ?? 0,
      systemManagers:
        groupedByRole.find((item) => item.role === "SYSTEM_MANAGER")?._count._all ?? 0,
      managers:
        groupedByRole.find((item) => item.role === "MANAGER")?._count._all ?? 0,
      salesStaff:
        groupedByRole.find((item) => item.role === "SALES_STAFF")?._count._all ?? 0,
      active:
        groupedByStatus.find((item) => item.isActive === true)?._count._all ?? 0,
      inactive:
        groupedByStatus.find((item) => item.isActive === false)?._count._all ?? 0,
    },
  };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      assignedLocationId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getManagerBranchOptions(currentAssignedLocationId?: string) {
  const where: Prisma.StockLocationWhereInput = {
    type: LocationType.BRANCH,
    ...(currentAssignedLocationId
      ? {
          OR: [{ isActive: true }, { id: currentAssignedLocationId }],
        }
      : {
          isActive: true,
        }),
  };

  return prisma.stockLocation.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  });
}
