import "server-only";

import { cache } from "react";
import { LocationType, type Role } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getToken } from "next-auth/jwt";
import {
  hasPermission,
  type PermissionAction,
  type PermissionResource,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const SALES_STAFF_ACTIVE_LOCATION_COOKIE = "salesStaffActiveLocationId";

async function resolveSessionUserId() {
  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!authSecret) {
    return null;
  }

  const requestHeaders = new Headers(await headers());
  const secureCookie =
    requestHeaders.get("x-forwarded-proto") === "https" ||
    requestHeaders.get("origin")?.startsWith("https://") === true;
  const token = await getToken({
    req: { headers: requestHeaders },
    secret: authSecret,
    secureCookie,
  });

  if (typeof token?.id === "string") {
    return token.id;
  }

  return typeof token?.sub === "string" ? token.sub : null;
}

export const getCurrentUser = cache(async () => {
  const userId = await resolveSessionUserId();

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      assignedLocationId: true,
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
