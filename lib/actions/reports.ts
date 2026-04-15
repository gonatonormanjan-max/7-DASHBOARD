"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { prisma } from "@/lib/prisma";
import {
  branchQuotaSettingsSchema,
  buildReportsFieldErrors,
  extractBranchQuotaSettingsValues,
  initialBranchQuotaSettingsState,
  type BranchQuotaSettingsState,
} from "@/lib/validators/reports";

function normalizeTarget(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function isMissingBranchQuotaSettingsTableError(error: unknown) {
  const errorLike = error as
    | {
        code?: unknown;
        message?: unknown;
        meta?: unknown;
      }
    | undefined;
  const code = typeof errorLike?.code === "string" ? errorLike.code : "";
  const message = typeof errorLike?.message === "string" ? errorLike.message : "";
  const metaCode =
    typeof errorLike?.meta === "object" &&
    errorLike.meta !== null &&
    "code" in errorLike.meta &&
    typeof errorLike.meta.code === "string"
      ? errorLike.meta.code
      : "";

  if (code === "P2021" || code === "42P01") {
    return true;
  }

  if (code === "P2010" && metaCode === "42P01") {
    return true;
  }

  if (metaCode === "42P01") {
    return true;
  }

  return (
    message.includes('relation "BranchQuotaSetting" does not exist') ||
    message.includes('relation "branchquotasetting" does not exist')
  );
}

export async function saveBranchQuotaSettingsAction(
  _prevState: BranchQuotaSettingsState,
  formData: FormData
): Promise<BranchQuotaSettingsState> {
  const user = await requirePermission("reports", "update");
  const values = extractBranchQuotaSettingsValues(formData);
  const parsed = branchQuotaSettingsSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ...initialBranchQuotaSettingsState,
      status: "error",
      message: "Please fix the branch quota settings before saving.",
      fieldErrors: buildReportsFieldErrors(parsed.error),
      values,
    };
  }

  const branchIds = [...new Set(parsed.data.rows.map((row) => row.branchId))];
  const activeBranches = await prisma.stockLocation.findMany({
    where: {
      id: {
        in: branchIds,
      },
      type: "BRANCH",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });
  const activeBranchIds = new Set(activeBranches.map((branch) => branch.id));

  if (activeBranches.length !== branchIds.length) {
    return {
      ...initialBranchQuotaSettingsState,
      status: "error",
      message: "One or more selected branches are no longer active.",
      fieldErrors: {
        rows: ["Refresh this page and try again. Branch availability changed."],
      },
      values,
    };
  }

  const rowsToDelete = new Set<string>();
  const rowsToUpsert: Array<{
    branchId: string;
    rollingWindowDays: number;
    revenueTarget: number | null;
    unitsTarget: number | null;
  }> = [];

  for (const row of parsed.data.rows) {
    if (!activeBranchIds.has(row.branchId)) {
      continue;
    }

    const revenueTarget = normalizeTarget(row.revenueTarget);
    const unitsTarget = normalizeTarget(row.unitsTarget);

    if (revenueTarget === null && unitsTarget === null) {
      rowsToDelete.add(row.branchId);
      continue;
    }

    rowsToUpsert.push({
      branchId: row.branchId,
      rollingWindowDays: row.rollingWindowDays,
      revenueTarget,
      unitsTarget,
    });
  }

  const upsertedByBranch = new Set(rowsToUpsert.map((row) => row.branchId));
  for (const branchId of upsertedByBranch) {
    if (rowsToDelete.has(branchId)) {
      rowsToDelete.delete(branchId);
    }
  }

  const branchById = new Map(activeBranches.map((branch) => [branch.id, branch]));
  let hasBranchQuotaSettingsTable = false;
  try {
    const tableCheckRows = await prisma.$queryRaw<Array<{ tableExists: boolean }>>(
      Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = current_schema()
            AND LOWER(table_name) = 'branchquotasetting'
        ) AS "tableExists"
      `
    );
    hasBranchQuotaSettingsTable = Boolean(tableCheckRows[0]?.tableExists);
  } catch (error) {
    if (!isMissingBranchQuotaSettingsTableError(error)) {
      throw error;
    }
  }

  if (!hasBranchQuotaSettingsTable) {
    return {
      ...initialBranchQuotaSettingsState,
      status: "error",
      message:
        "Branch quota storage is not ready yet. Run the latest Prisma migration, then try saving again.",
      values,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (rowsToDelete.size > 0) {
        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "BranchQuotaSetting"
            WHERE "branchId" IN (${Prisma.join([...rowsToDelete])})
          `
        );
      }

      for (const row of rowsToUpsert) {
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO "BranchQuotaSetting" (
              "id",
              "branchId",
              "rollingWindowDays",
              "revenueTarget",
              "unitsTarget",
              "createdAt",
              "updatedAt"
            )
            VALUES (
              ${randomUUID()},
              ${row.branchId},
              ${row.rollingWindowDays},
              ${row.revenueTarget},
              ${row.unitsTarget},
              NOW(),
              NOW()
            )
            ON CONFLICT ("branchId")
            DO UPDATE SET
              "rollingWindowDays" = EXCLUDED."rollingWindowDays",
              "revenueTarget" = EXCLUDED."revenueTarget",
              "unitsTarget" = EXCLUDED."unitsTarget",
              "updatedAt" = NOW()
          `
        );
      }

      await logAudit(
        {
          userId: user.id,
          action: "reports.branch_quota_settings.update",
          entity: "branch_quota_settings",
          entityId: "all-active-branches",
          details: {
            metric: parsed.data.metric,
            updatedCount: rowsToUpsert.length,
            removedCount: rowsToDelete.size,
            updatedBranches: rowsToUpsert.map((row) => ({
              branchId: row.branchId,
              branchName: branchById.get(row.branchId)?.name,
              branchCode: branchById.get(row.branchId)?.code,
              rollingWindowDays: row.rollingWindowDays,
              revenueTarget: row.revenueTarget,
              unitsTarget: row.unitsTarget,
            })),
            removedBranchIds: [...rowsToDelete],
          },
        },
        tx
      );
    });
  } catch (error) {
    if (isMissingBranchQuotaSettingsTableError(error)) {
      return {
        ...initialBranchQuotaSettingsState,
        status: "error",
        message:
          "Branch quota storage is not ready yet. Run the latest Prisma migration, then try saving again.",
        values,
      };
    }

    throw error;
  }

  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/reports/branch-quotas");

  redirect(
    withFlashMessage(`/dashboard/reports/branch-quotas?metric=${parsed.data.metric}`, {
      success: "Branch quota settings saved.",
    })
  );
}
