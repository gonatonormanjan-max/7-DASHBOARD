"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requirePermission, getSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getBranchScope } from "@/lib/dal/scope";
import { withFlashMessage } from "@/lib/flash-toast";
import { prisma } from "@/lib/prisma";
import {
  changeFundAllocationSchema,
  getTodayBusinessDateInput,
  issueReportSchema,
  issueReportStatusSchema,
  parseStockCountLinesPayload,
  saveStockCountSchema,
} from "@/lib/validators/daily-ops";

function toDateOnlyValue(dateInput: string) {
  return new Date(`${dateInput}T00:00:00.000Z`);
}

async function resolveDailyOpsBranchId(
  user: Awaited<ReturnType<typeof requirePermission>>,
  requestedLocationId: string | null
) {
  const managerBranchId = getBranchScope(user);

  if (managerBranchId) {
    return managerBranchId;
  }

  if (user.role === "SALES_STAFF") {
    return getSalesStaffActiveLocationId(user);
  }

  return requestedLocationId;
}

async function getValidatedDailyOpsBranch(locationId: string | null) {
  if (!locationId) {
    return null;
  }

  return prisma.stockLocation.findFirst({
    where: {
      id: locationId,
      isActive: true,
      type: "BRANCH",
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });
}

async function upsertStockCountRecord(input: {
  user: Awaited<ReturnType<typeof requirePermission>>;
  countId?: string;
  locationId: string;
  type: "OPENING" | "CLOSING";
  countDate: string;
  lines: Array<{
    productId: string;
    countedQty: number;
    notes: string | null;
  }>;
  submit: boolean;
}) {
  return prisma.$transaction(
    async (tx) => {
      const branch = await tx.stockLocation.findFirst({
        where: {
          id: input.locationId,
          isActive: true,
          type: "BRANCH",
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
      });

      if (!branch) {
        throw new Error("Select a valid active branch.");
      }

      const uniqueProductIds = [...new Set(input.lines.map((line) => line.productId))];
      const stockRows = await tx.locationStock.findMany({
        where: {
          locationId: branch.id,
          productId: {
            in: uniqueProductIds,
          },
          product: {
            status: {
              in: ["ACTIVE", "INACTIVE"],
            },
          },
        },
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

      const stockByProductId = new Map(stockRows.map((row) => [row.productId, row]));

      if (stockByProductId.size !== uniqueProductIds.length) {
        throw new Error("One or more products are no longer available for this branch.");
      }

      const countDateValue = toDateOnlyValue(input.countDate);
      const existingCount = await tx.stockCount.findUnique({
        where: {
          locationId_type_countDate: {
            locationId: branch.id,
            type: input.type,
            countDate: countDateValue,
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (input.countId && existingCount && existingCount.id !== input.countId) {
        throw new Error("A stock count already exists for this branch, type, and date.");
      }

      if (existingCount?.status === "SUBMITTED") {
        throw new Error("This stock count has already been submitted and can no longer be edited.");
      }

      const count = existingCount
        ? await tx.stockCount.update({
            where: { id: existingCount.id },
            data: {
              status: input.submit ? "SUBMITTED" : "DRAFT",
              submittedById: input.user.id,
            },
            select: {
              id: true,
            },
          })
        : await tx.stockCount.create({
            data: {
              locationId: branch.id,
              type: input.type,
              countDate: countDateValue,
              status: input.submit ? "SUBMITTED" : "DRAFT",
              submittedById: input.user.id,
            },
            select: {
              id: true,
            },
          });

      await tx.stockCountLine.deleteMany({
        where: {
          stockCountId: count.id,
        },
      });

      const lineRecords = input.lines.map((line) => {
        const stockRow = stockByProductId.get(line.productId);

        if (!stockRow) {
          throw new Error("A product in this count is no longer available.");
        }

        return {
          stockCountId: count.id,
          productId: line.productId,
          systemQty: stockRow.quantity,
          countedQty: line.countedQty,
          notes: line.notes,
        };
      });

      if (lineRecords.length > 0) {
        await tx.stockCountLine.createMany({
          data: lineRecords,
        });
      }

      const discrepancies = input.submit
        ? lineRecords
            .map((line) => {
              const delta = line.countedQty - line.systemQty;
              if (Math.abs(delta) === 0) {
                return null;
              }

              const stockRow = stockByProductId.get(line.productId);

              return {
                productId: line.productId,
                productName: stockRow?.product.name ?? "Unknown Product",
                sku: stockRow?.product.sku ?? "",
                quantity: Math.abs(delta),
                direction: delta > 0 ? "increase" : "decrease",
                notes: line.notes,
                systemQty: line.systemQty,
                countedQty: line.countedQty,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
        : [];

      if (input.submit && discrepancies.length > 0) {
        await tx.adjustmentRequest.createMany({
          data: discrepancies.map((discrepancy) => ({
            branchId: branch.id,
            productId: discrepancy.productId,
            direction: discrepancy.direction,
            quantity: discrepancy.quantity,
            reason: "count_correction",
            notes: [
              `${input.type} stock count submitted for ${input.countDate}.`,
              `System quantity: ${discrepancy.systemQty}.`,
              `Counted quantity: ${discrepancy.countedQty}.`,
              discrepancy.notes ? `Notes: ${discrepancy.notes}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            requestedById: input.user.id,
          })),
        });
      }

      await logAudit(
        {
          userId: input.user.id,
          action: input.submit ? "daily_ops.stock_count.submit" : "daily_ops.stock_count.save",
          entity: "stock_count",
          entityId: count.id,
          details: {
            locationId: branch.id,
            locationName: branch.name,
            type: input.type,
            countDate: input.countDate,
            status: input.submit ? "SUBMITTED" : "DRAFT",
            lineCount: lineRecords.length,
            discrepancyCount: discrepancies.length,
          },
        },
        tx
      );

      return {
        branch,
        countId: count.id,
        discrepancyCount: discrepancies.length,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function saveStockCountAction(formData: FormData) {
  const user = await requirePermission("daily_ops", "create");
  const parsed = saveStockCountSchema.safeParse({
    countId: String(formData.get("countId") ?? "").trim() || undefined,
    locationId: String(formData.get("locationId") ?? "").trim(),
    type: String(formData.get("type") ?? "").trim(),
    countDate: String(formData.get("countDate") ?? getTodayBusinessDateInput()).trim(),
    lines: parseStockCountLinesPayload(formData),
  });

  const baseReturnPath = "/dashboard/daily-ops/stock-count";

  if (!parsed.success) {
    redirect(
      withFlashMessage(baseReturnPath, {
        error: parsed.error.issues[0]?.message ?? "Please fix the stock count details.",
      })
    );
  }

  const scopedBranchId = await resolveDailyOpsBranchId(user, parsed.data.locationId);
  const branch = await getValidatedDailyOpsBranch(scopedBranchId ?? null);

  if (!branch) {
    redirect(
      withFlashMessage(baseReturnPath, {
        error: "Select a valid active branch.",
      })
    );
  }

  try {
    await upsertStockCountRecord({
      user,
      countId: parsed.data.countId,
      locationId: branch.id,
      type: parsed.data.type,
      countDate: parsed.data.countDate,
      lines: parsed.data.lines,
      submit: false,
    });
  } catch (error) {
    redirect(
      withFlashMessage(`${baseReturnPath}?locationId=${branch.id}&type=${parsed.data.type}`, {
        error:
          error instanceof Error
            ? error.message
            : "Could not save the stock count draft.",
      })
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/daily-ops");
  revalidatePath("/dashboard/daily-ops/stock-count");

  redirect(
    withFlashMessage(
      `${baseReturnPath}?locationId=${branch.id}&type=${parsed.data.type}`,
      {
        success: `Saved ${parsed.data.type.toLowerCase()} stock count draft for ${branch.name}.`,
      }
    )
  );
}

export async function submitStockCountAction(formData: FormData) {
  const user = await requirePermission("daily_ops", "create");
  const parsed = saveStockCountSchema.safeParse({
    countId: String(formData.get("countId") ?? "").trim() || undefined,
    locationId: String(formData.get("locationId") ?? "").trim(),
    type: String(formData.get("type") ?? "").trim(),
    countDate: String(formData.get("countDate") ?? getTodayBusinessDateInput()).trim(),
    lines: parseStockCountLinesPayload(formData),
  });

  const baseReturnPath = "/dashboard/daily-ops/stock-count";

  if (!parsed.success) {
    redirect(
      withFlashMessage(baseReturnPath, {
        error: parsed.error.issues[0]?.message ?? "Please fix the stock count details.",
      })
    );
  }

  const scopedBranchId = await resolveDailyOpsBranchId(user, parsed.data.locationId);
  const branch = await getValidatedDailyOpsBranch(scopedBranchId ?? null);

  if (!branch) {
    redirect(
      withFlashMessage(baseReturnPath, {
        error: "Select a valid active branch.",
      })
    );
  }

  let result: Awaited<ReturnType<typeof upsertStockCountRecord>>;

  try {
    result = await upsertStockCountRecord({
      user,
      countId: parsed.data.countId,
      locationId: branch.id,
      type: parsed.data.type,
      countDate: parsed.data.countDate,
      lines: parsed.data.lines,
      submit: true,
    });
  } catch (error) {
    redirect(
      withFlashMessage(`${baseReturnPath}?locationId=${branch.id}&type=${parsed.data.type}`, {
        error:
          error instanceof Error
            ? error.message
            : "Could not submit the stock count.",
      })
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/daily-ops");
  revalidatePath("/dashboard/daily-ops/stock-count");
  revalidatePath("/dashboard/inventory/adjustment-requests");

  redirect(
    withFlashMessage(
      `${baseReturnPath}?locationId=${branch.id}&type=${parsed.data.type}`,
      {
        success:
          result.discrepancyCount > 0
            ? `Submitted ${parsed.data.type.toLowerCase()} count for ${branch.name}. ${result.discrepancyCount} discrepancy request${result.discrepancyCount === 1 ? "" : "s"} created for review.`
            : `Submitted ${parsed.data.type.toLowerCase()} count for ${branch.name} with no discrepancies.`,
      }
    )
  );
}

export async function submitIssueReportAction(formData: FormData) {
  const user = await requirePermission("issue_reports", "create");
  const parsed = issueReportSchema.safeParse({
    branchId: String(formData.get("branchId") ?? "").trim() || undefined,
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
  });

  const returnPath = "/dashboard/daily-ops/issue-reports";

  if (!parsed.success) {
    redirect(
      withFlashMessage("/dashboard/daily-ops/issue-reports/new", {
        error: parsed.error.issues[0]?.message ?? "Please fix the issue report details.",
      })
    );
  }

  const scopedBranchId = await resolveDailyOpsBranchId(user, parsed.data.branchId ?? null);
  const branch = await getValidatedDailyOpsBranch(scopedBranchId ?? null);

  if (!branch) {
    redirect(
      withFlashMessage("/dashboard/daily-ops/issue-reports/new", {
        error: "Select a valid active branch.",
      })
    );
  }

  let report: { id: string };

  try {
    report = await prisma.issueReport.create({
      data: {
        branchId: branch.id,
        title: parsed.data.title,
        body: parsed.data.body,
        submittedById: user.id,
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    redirect(
      withFlashMessage("/dashboard/daily-ops/issue-reports/new", {
        error:
          error instanceof Error
            ? error.message
            : "Could not submit the issue report.",
      })
    );
  }

  await logAudit({
    userId: user.id,
    action: "daily_ops.issue_report.submit",
    entity: "issue_report",
    entityId: report.id,
    details: {
      branchId: branch.id,
      branchName: branch.name,
      title: parsed.data.title,
    },
  });

  revalidatePath("/dashboard/daily-ops");
  revalidatePath(returnPath);

  redirect(
    withFlashMessage(returnPath, {
      success: `Issue report submitted for ${branch.name}.`,
    })
  );
}

export async function updateIssueReportStatusAction(formData: FormData) {
  const user = await requirePermission("issue_reports", "update");
  const issueReportId = String(formData.get("issueReportId") ?? "").trim();
  const status = issueReportStatusSchema.safeParse(String(formData.get("status") ?? "").trim());

  if (!issueReportId || !status.success) {
    redirect(
      withFlashMessage("/dashboard/daily-ops/issue-reports", {
        error: "Issue report update is invalid.",
      })
    );
  }

  const report = await prisma.issueReport.findUnique({
    where: {
      id: issueReportId,
    },
    select: {
      id: true,
      branchId: true,
      title: true,
    },
  });

  if (!report) {
    redirect(
      withFlashMessage("/dashboard/daily-ops/issue-reports", {
        error: "Issue report not found.",
      })
    );
  }

  try {
    await prisma.issueReport.update({
      where: {
        id: report.id,
      },
      data: {
        status: status.data,
        acknowledgedById: status.data === "ACKNOWLEDGED" ? user.id : undefined,
        resolvedById: status.data === "RESOLVED" ? user.id : undefined,
      },
    });
  } catch (error) {
    redirect(
      withFlashMessage("/dashboard/daily-ops/issue-reports", {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the issue report.",
      })
    );
  }

  await logAudit({
    userId: user.id,
    action: "daily_ops.issue_report.update_status",
    entity: "issue_report",
    entityId: report.id,
    details: {
      branchId: report.branchId,
      status: status.data,
      title: report.title,
    },
  });

  revalidatePath("/dashboard/daily-ops");
  revalidatePath("/dashboard/daily-ops/issue-reports");

  redirect(
    withFlashMessage("/dashboard/daily-ops/issue-reports", {
      success: `Issue report marked ${status.data.toLowerCase().replaceAll("_", " ")}.`,
    })
  );
}

export async function setChangeFundAllocationAction(formData: FormData) {
  const user = await requirePermission("daily_ops", "create");

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const parsed = changeFundAllocationSchema.safeParse({
    branchId: String(formData.get("branchId") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });

  const returnPath = "/dashboard/daily-ops/change-fund";

  if (!parsed.success) {
    redirect(
      withFlashMessage(returnPath, {
        error: parsed.error.issues[0]?.message ?? "Please fix the change fund details.",
      })
    );
  }

  const scopedBranchId = await resolveDailyOpsBranchId(user, parsed.data.branchId);
  const branch = await getValidatedDailyOpsBranch(scopedBranchId ?? null);

  if (!branch) {
    redirect(
      withFlashMessage(returnPath, {
        error: "Select a valid active branch.",
      })
    );
  }

  const amount = Number(parsed.data.amount.toFixed(2));

  let allocation: { id: string };

  try {
    allocation = await prisma.changeFundAllocation.upsert({
      where: {
        branchId: branch.id,
      },
      update: {
        amount,
        notes: parsed.data.notes,
        setById: user.id,
      },
      create: {
        branchId: branch.id,
        amount,
        notes: parsed.data.notes,
        setById: user.id,
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    redirect(
      withFlashMessage(`${returnPath}?branchId=${branch.id}`, {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the change fund target.",
      })
    );
  }

  await logAudit({
    userId: user.id,
    action: "daily_ops.change_fund.set",
    entity: "change_fund_allocation",
    entityId: allocation.id,
    details: {
      branchId: branch.id,
      branchName: branch.name,
      amount,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/dashboard/daily-ops");
  revalidatePath(returnPath);
  revalidatePath("/dashboard/vault");

  redirect(
    withFlashMessage(`${returnPath}?branchId=${branch.id}`, {
      success: `Change fund target updated for ${branch.name}.`,
    })
  );
}
