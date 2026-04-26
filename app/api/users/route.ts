import { LocationType, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getAssignableRolesForActor } from "@/lib/users";
import {
  createUserFormSchema,
  extractUserFormValues,
  type UserFormState,
} from "@/lib/validators/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildAbsoluteUrl(req: Request, path: string) {
  return new URL(path, req.url);
}

function isFetchRequest(req: Request) {
  return req.headers.get("x-requested-with") === "fetch";
}

function jsonFormError(state: UserFormState, status = 400) {
  return NextResponse.json(state, { status });
}

function routeFormError(req: Request, state: UserFormState, status = 400) {
  if (isFetchRequest(req)) {
    return jsonFormError(state, status);
  }

  return NextResponse.redirect(
    buildAbsoluteUrl(
      req,
      withFlashMessage("/dashboard/users/new", {
        error: state.message ?? "Unable to create the account right now.",
      })
    ),
    { status: 303 }
  );
}

async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
}

async function resolveAssignedLocation(role: Role, assignedLocationId?: string) {
  if (role !== "MANAGER") {
    return {
      assignedLocationId: null,
      assignedLocationName: null,
    };
  }

  if (!assignedLocationId) {
    return null;
  }

  const branch = await prisma.stockLocation.findFirst({
    where: {
      id: assignedLocationId,
      isActive: true,
      type: LocationType.BRANCH,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return branch
    ? {
        assignedLocationId: branch.id,
        assignedLocationName: branch.name,
      }
    : null;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const values = extractUserFormValues(formData);

  try {
    const actor = await getCurrentUser();

    if (!actor) {
      if (isFetchRequest(req)) {
        return NextResponse.json(
          { redirectTo: "/auth/login" },
          { status: 401 }
        );
      }

      return NextResponse.redirect(buildAbsoluteUrl(req, "/auth/login"), {
        status: 303,
      });
    }

    if (!actor.isActive) {
      return routeFormError(
        req,
        {
          status: "error",
          message: "Your account is inactive.",
          values,
        },
        403
      );
    }

    if (!hasPermission(actor.role, "users", "create")) {
      return routeFormError(
        req,
        {
          status: "error",
          message: "You do not have permission to create accounts.",
          values,
        },
        403
      );
    }

    const parsed = createUserFormSchema.safeParse(values);

    if (!parsed.success) {
      return routeFormError(req, {
        status: "error",
        message: "Please fix the user details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
        values,
      });
    }

    const assignableRoles = getAssignableRolesForActor(actor.role);

    if (!assignableRoles.includes(parsed.data.role)) {
      return routeFormError(
        req,
        {
          status: "error",
          message: "You cannot assign that role.",
          fieldErrors: {
            role: ["Choose a role you are allowed to assign."],
          },
          values,
        },
        403
      );
    }

    const existingUser = await findUserByEmail(parsed.data.email);

    if (existingUser) {
      return routeFormError(
        req,
        {
          status: "error",
          message: "A user with that email already exists.",
          fieldErrors: {
            email: ["Email address must be unique."],
          },
          values,
        },
        409
      );
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const assignedLocation = await resolveAssignedLocation(
      parsed.data.role,
      parsed.data.assignedLocationId
    );

    if (!assignedLocation) {
      return routeFormError(req, {
        status: "error",
        message: "Manager accounts must be assigned to an active branch.",
        fieldErrors: {
          assignedLocationId: ["Choose an active branch for this manager."],
        },
        values,
      });
    }

    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email: parsed.data.email,
          hashedPassword,
          role: parsed.data.role,
          isActive: parsed.data.isActive,
          assignedLocationId: assignedLocation.assignedLocationId,
        },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      await logAudit(
        {
          userId: actor.id,
          action: "user.create",
          entity: "user",
          entityId: createdUser.id,
          details: {
            email: createdUser.email,
            role: createdUser.role,
            assignedLocationName: assignedLocation.assignedLocationName,
          },
        },
        tx
      );
    });

    const redirectTo = withFlashMessage("/dashboard/users", {
      success: "User account created.",
    });

    if (isFetchRequest(req)) {
      return NextResponse.json({ redirectTo });
    }

    return NextResponse.redirect(buildAbsoluteUrl(req, redirectTo), {
      status: 303,
    });
  } catch (error) {
    console.error("Failed to create user account.", error);

    return routeFormError(
      req,
      {
        status: "error",
        message: "Unable to create the account right now. Please try again.",
        values,
      },
      500
    );
  }
}
