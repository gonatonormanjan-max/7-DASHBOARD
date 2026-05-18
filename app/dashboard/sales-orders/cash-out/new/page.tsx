import Link from "next/link";
import { redirect } from "next/navigation";
import { createCashOutAction } from "@/lib/actions/cash-out";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import {
  getAccessibleCashOutBranches,
  getCashOutAccounts,
} from "@/lib/dal/cash-out";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CashOutForm } from "@/components/cash-out/cash-out-form";

export default async function NewCashOutPage() {
  const user = await requirePermission("sales_orders", "create");

  if (user.role === "SYSTEM_MANAGER") {
    redirect("/dashboard/sales-orders/cash-out");
  }

  await requireSalesStaffActiveLocationId({
    user,
    returnTo: "/dashboard/sales-orders/cash-out/new",
  });

  const [branches, accounts] = await Promise.all([
    getAccessibleCashOutBranches(user),
    getCashOutAccounts(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sales"
        title="New Cash Out"
        description="Record a completed cash-out service transaction after the customer has sent the online transfer."
        action={
          <Link href="/dashboard/sales-orders/cash-out">
            <Button type="button" variant="outline">
              Back to Cash Out
            </Button>
          </Link>
        }
      />

      <CashOutForm
        accounts={accounts}
        action={createCashOutAction}
        branches={branches}
      />
    </div>
  );
}
