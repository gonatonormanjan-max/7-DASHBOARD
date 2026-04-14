"use server";

import { LocationType } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { requireUser, SALES_STAFF_ACTIVE_LOCATION_COOKIE } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath) {
    return "/dashboard";
  }

  const trimmed = nextPath.trim();
  const pathname = trimmed.split("?")[0].split("#")[0];
  if (!trimmed.startsWith("/dashboard")) {
    return "/dashboard";
  }

  if (pathname.split("/").some((segment) => segment === "..")) {
    return "/dashboard";
  }

  return trimmed;
}

export async function setSalesStaffActiveLocationAction(formData: FormData) {
  const user = await requireUser();
  const nextPath = normalizeNextPath(String(formData.get("next") ?? null));

  if (user.role !== "SALES_STAFF") {
    redirect("/dashboard");
  }

  const locationId = String(formData.get("locationId") ?? "").trim();

  if (!locationId) {
    redirect(`/auth/select-location?error=required&next=${encodeURIComponent(nextPath)}`);
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

  if (!location) {
    redirect(`/auth/select-location?error=invalid&next=${encodeURIComponent(nextPath)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: SALES_STAFF_ACTIVE_LOCATION_COOKIE,
    value: location.id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect(nextPath);
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SALES_STAFF_ACTIVE_LOCATION_COOKIE);
  await signOut({ redirectTo: "/auth/login" });
}
