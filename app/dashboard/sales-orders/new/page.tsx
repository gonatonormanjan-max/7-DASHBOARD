import { redirect } from "next/navigation";

type LegacyNewSalesOrderRedirectPageProps = {
  searchParams: Promise<{
    from?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LegacyNewSalesOrderRedirectPage({
  searchParams,
}: LegacyNewSalesOrderRedirectPageProps) {
  const resolvedSearchParams = await searchParams;
  const from = readParam(resolvedSearchParams.from);

  if (from) {
    redirect(`/dashboard/sales-orders/create/new?from=${encodeURIComponent(from)}`);
  }

  redirect("/dashboard/sales-orders/create/new");
}
