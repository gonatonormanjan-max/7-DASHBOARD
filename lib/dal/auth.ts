import "server-only";

import { cache } from "react";
import { LocationType, type Role } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  hasPermission,
  type PermissionAction,
  type PermissionResource,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const SALES_STAFF_ACTIVE_LOCATION_COOKIE = "salesStaffActiveLocationId";

export const getCurrentUser = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

function normalizeDashboardReturnTo(returnTo?: string) {
  if (typeof returnTo !== "string") {
    return "/dashboard";
  }

  const trimmed = returnTo.trim();
  const pathname = trimmed.split("?")[0].split("#")[0];
  if (!trimmed.startsWith("/dashboard")) {
    return "/dashboard";
  }

  if (pathname.split("/").some((segment) => segment === "..")) {
    return "/dashboard";
  }

  return trimmed;
}

function buildSalesStaffLocationRedirect(returnTo?: string) {
  const params = new URLSearchParams({
    next: normalizeDashboardReturnTo(returnTo),
  });
  return `/auth/select-location?${params.toString()}`;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (!user.isActive) {
    redirect("/auth/login?error=inactive");
  }

  return user;
}

export async function getSalesStaffActiveLocationId(user?: CurrentUser) {
  const resolvedUser = user ?? (await requireUser());

  return getSalesStaffActiveLocationIdForUser(resolvedUser.id, resolvedUser.role);
}

const getSalesStaffActiveLocationIdForUser = cache(
  async (_userId: string, role: Role) => {
    if (role !== "SALES_STAFF") {
      return null;
    }

    const cookieStore = await cookies();
    const locationId = cookieStore.get(SALES_STAFF_ACTIVE_LOCATION_COOKIE)?.value?.trim();

    if (!locationId) {
      return null;
    }

    const location = await prisma.stockLocation.findFirst({
      where: {
        id: locationId,
        isActive: true,
        type: LocationType.BRANCH,
      },
      select: {
        id: true,
      },
    });

    return location?.id ?? null;
  }
);

export async function requireSalesStaffActiveLocationId(options?: {
  user?: CurrentUser;
  returnTo?: string;
}) {
  const resolvedUser = options?.user ?? (await requireUser());

  if (resolvedUser.role !== "SALES_STAFF") {
    return null;
  }

  const locationId = await getSalesStaffActiveLocationId(resolvedUser);

  if (!locationId) {
    redirect(buildSalesStaffLocationRedirect(options?.returnTo));
  }

  return locationId;
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requirePermission(
  resource: PermissionResource,
  action: PermissionAction
) {
  const user = await requireUser();

  if (!hasPermission(user.role, resource, action)) {
    redirect("/dashboard");
  }

  await requireSalesStaffActiveLocationId({ user });

  return user;
}
