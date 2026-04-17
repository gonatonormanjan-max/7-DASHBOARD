import { z } from "zod";

// Defined here explicitly so validation is never dependent on the Prisma
// generated client being up to date. Keep in sync with the Role enum in
// prisma/schema.prisma whenever new roles are added.
export const USER_ROLES = [
  "ADMIN",
  "SYSTEM_MANAGER",
  "MANAGER",
  "SALES_STAFF",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

const baseUserFields = {
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(160)
    .transform((value) => value.toLowerCase()),
  role: z.enum(USER_ROLES),
  assignedLocationId: z.string().optional().transform(normalizeOptionalString),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
} satisfies z.ZodRawShape;

function addManagerAssignmentValidation(
  value: {
    role: UserRole;
    assignedLocationId?: string;
  },
  ctx: z.RefinementCtx
) {
  if (value.role === "MANAGER" && !value.assignedLocationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Assign an active branch to this manager.",
      path: ["assignedLocationId"],
    });
  }
}

export const createUserFormSchema = z
  .object({
    ...baseUserFields,
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm the password."),
  })
  .superRefine((value, ctx) => {
    addManagerAssignmentValidation(value, ctx);

    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });

export const updateUserFormSchema = z
  .object({
    ...baseUserFields,
    password: z.string().optional().default(""),
    confirmPassword: z.string().optional().default(""),
  })
  .superRefine((value, ctx) => {
    addManagerAssignmentValidation(value, ctx);

    const nextPassword = value.password?.trim() ?? "";
    const nextConfirmPassword = value.confirmPassword?.trim() ?? "";

    if (!nextPassword && !nextConfirmPassword) {
      return;
    }

    if (nextPassword.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password must be at least 8 characters.",
        path: ["password"],
      });
    }

    if (nextPassword !== nextConfirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });

export const userListQuerySchema = z.object({
  query: z.string().trim().max(120).optional().default(""),
  role: z
    .enum(["all", "ADMIN", "SYSTEM_MANAGER", "MANAGER", "SALES_STAFF"])
    .optional()
    .catch("all")
    .default("all"),
  status: z
    .enum(["all", "active", "inactive"])
    .optional()
    .catch("all")
    .default("all"),
});

export type UserListFilters = z.output<typeof userListQuerySchema>;
export type UserFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export const initialUserFormState: UserFormState = {
  status: "idle",
};

export function parseUserListFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  return userListQuerySchema.parse({
    query: firstString(searchParams.query),
    role: firstString(searchParams.role),
    status: firstString(searchParams.status),
  });
}

export function extractUserFormValues(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "SALES_STAFF"),
    assignedLocationId: String(formData.get("assignedLocationId") ?? ""),
    isActive: String(formData.get("isActive") ?? "true"),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };
}
