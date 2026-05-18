"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { buildCashOutTransactionNumber, canVoidCashOutTransaction } from "@/lib/cash-out";
import { getCurrentUser, getSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { createCashOutInVault, voidCashOutInVault } from "@/lib/dal/cash-out";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  cashOutAccountFormSchema,
  cashOutCreateFormSchema,
  cashOutVoidFormSchema,
  extractCashOutAccountFormValues,
  extractCashOutCreateFormValues,
  extractCashOutVoidFormValues,
  type CashOutFormState,
} from "@/lib/validators/cash-out";

function formValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value ?? "")])
  );
}

function decimalFromMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

async function canUseBranch(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, branchId: string) {
  if (user.role === "SALES_STAFF") {
    return (await getSalesStaffActiveLocationId(user)) === branchId;
  }

  if (user.role === "MANAGER") {
    return user.assignedLocationId === branchId;
  }

  return true;
}

function revalidateCashOutPaths(transactionId?: string) {
  revalidatePath("/dashboard/sales-orders");
  revalidatePath("/dashboard/sales-orders/cash-out");
  revalidatePath("/dashboard/vault");
  revalidatePath("/dashboard/vault/cash-out-service");
  revalidatePath("/dashboard/reports");

  if (transactionId) {
    revalidatePath(`/dashboard/sales-orders/cash-out/${transactionId}`);
  }
}

export async function createCashOutAction(
  _prevState: CashOutFormState,
  formData: FormData
): Promise<CashOutFormState> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "sales_orders", "create")) {
    return {
      status: "error",
      message: "You don't have permission to record cash-out transactions.",
    };
  }

  const values = extractCashOutCreateFormValues(formData);
  const parsed = cashOutCreateFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the form errors.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
      values: formValues(values),
    };
  }

  if (!(await canUseBranch(user, parsed.data.branchId))) {
    return {
      status: "error",
      message: "You can only record cash-out transactions for your active branch.",
      values: formValues(values),
    };
  }

  let transactionId: string | null = null;

  try {
    const [branch, account] = await Promise.all([
      prisma.stockLocation.findFirst({
        where: { id: parsed.data.branchId, isActive: true, type: "BRANCH" },
        select: { id: true, name: true },
      }),
      prisma.cashOutAccount.findFirst({
        where: { id: parsed.data.accountId, isActive: true },
        select: { id: true, name: true },
      }),
    ]);

    if (!branch) {
      return {
        status: "error",
        message: "Branch not found or no longer active.",
        values: formValues(values),
      };
    }

    if (!account) {
      return {
        status: "error",
        message: "Online account not found or no longer active.",
        values: formValues(values),
      };
    }

    const cashOutAmount = decimalFromMoney(parsed.data.cashOutAmount);
    const feeAmount = decimalFromMoney(parsed.data.feeAmount);
    const onlineReceivedAmount = cashOutAmount.plus(feeAmount);
    const transactionNumber = buildCashOutTransactionNumber();

    await prisma.$transaction(async (tx) => {
      const transaction = await createCashOutInVault(tx, {
        transactionNumber,
        branchId: parsed.data.branchId,
        accountId: parsed.data.accountId,
        customerName: parsed.data.customerName,
        customerContact: parsed.data.customerContact,
        cashOutAmount,
        feeAmount,
        onlineReceivedAmount,
        onlineReferenceNumber: parsed.data.onlineReferenceNumber,
        notes: parsed.data.notes,
        performedById: user.id,
      });

      transactionId = transaction.id;

      await logAudit(
        {
          userId: user.id,
          action: "cash_out.create",
          entity: "cash_out_transaction",
          entityId: transaction.id,
          details: {
            transactionNumber: transaction.transactionNumber,
            branchId: branch.id,
            branchName: branch.name,
            accountId: account.id,
            accountName: account.name,
            cashOutAmount: cashOutAmount.toFixed(2),
            feeAmount: feeAmount.toFixed(2),
            onlineReceivedAmount: onlineReceivedAmount.toFixed(2),
            onlineReferenceNumber: parsed.data.onlineReferenceNumber,
          },
        },
        tx
      );
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return {
      status: "error",
      message,
      values: formValues(values),
    };
  }

  revalidateCashOutPaths(transactionId ?? undefined);

  if (transactionId) {
    redirect(`/dashboard/sales-orders/cash-out/${transactionId}`);
  }

  return {
    status: "success",
    message: "Cash-out transaction recorded successfully.",
  };
}

export async function voidCashOutAction(
  _prevState: CashOutFormState,
  formData: FormData
): Promise<CashOutFormState> {
  const user = await getCurrentUser();
  if (!user || !canVoidCashOutTransaction(user.role)) {
    return {
      status: "error",
      message: "Only Admin and System Manager can void cash-out transactions.",
    };
  }

  const values = extractCashOutVoidFormValues(formData);
  const parsed = cashOutVoidFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the form errors.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
      values: formValues(values),
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await voidCashOutInVault(tx, {
        transactionId: parsed.data.transactionId,
        voidReason: parsed.data.voidReason,
        performedById: user.id,
      });

      await logAudit(
        {
          userId: user.id,
          action: "cash_out.void",
          entity: "cash_out_transaction",
          entityId: transaction.id,
          details: {
            transactionNumber: transaction.transactionNumber,
            voidReason: parsed.data.voidReason,
          },
        },
        tx
      );
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return {
      status: "error",
      message,
      values: formValues(values),
    };
  }

  revalidateCashOutPaths(parsed.data.transactionId);

  return {
    status: "success",
    message: "Cash-out transaction voided successfully.",
  };
}

export async function upsertCashOutAccountAction(
  _prevState: CashOutFormState,
  formData: FormData
): Promise<CashOutFormState> {
  const user = await getCurrentUser();
  if (!user || !canVoidCashOutTransaction(user.role)) {
    return {
      status: "error",
      message: "Only Admin and System Manager can manage cash-out accounts.",
    };
  }

  const values = extractCashOutAccountFormValues(formData);
  const parsed = cashOutAccountFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the account form errors.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
      values: formValues(values),
    };
  }

  try {
    const account = parsed.data.accountId
      ? await prisma.cashOutAccount.update({
          where: { id: parsed.data.accountId },
          data: {
            name: parsed.data.name,
            provider: parsed.data.provider,
            accountName: parsed.data.accountName,
            accountNumber: parsed.data.accountNumber,
            isActive: parsed.data.isActive,
          },
          select: { id: true, name: true },
        })
      : await prisma.cashOutAccount.create({
          data: {
            name: parsed.data.name,
            provider: parsed.data.provider,
            accountName: parsed.data.accountName,
            accountNumber: parsed.data.accountNumber,
            isActive: parsed.data.isActive,
          },
          select: { id: true, name: true },
        });

    await logAudit({
      userId: user.id,
      action: parsed.data.accountId ? "cash_out_account.update" : "cash_out_account.create",
      entity: "cash_out_account",
      entityId: account.id,
      details: {
        accountName: account.name,
        isActive: parsed.data.isActive,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return {
      status: "error",
      message,
      values: formValues(values),
    };
  }

  revalidatePath("/dashboard/vault/cash-out-service");
  revalidatePath("/dashboard/sales-orders/cash-out/new");
  revalidatePath("/dashboard/sales-orders/cash-out");
  revalidatePath("/dashboard/reports");

  return {
    status: "success",
    message: "Cash-out account saved successfully.",
  };
}
