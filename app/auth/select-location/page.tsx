import { redirect } from "next/navigation";
import { setSalesStaffActiveLocationAction } from "@/lib/actions/auth";
import { getSalesStaffActiveLocationId, requireUser } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import AuthLayout from "@/components/auth-layout";

type SelectLocationPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeNextPath(nextPath: string | undefined) {
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

function getErrorMessage(error: string | undefined) {
  if (error === "required") {
    return "Choose a branch before continuing.";
  }

  if (error === "invalid") {
    return "The selected branch is not active. Choose another branch.";
  }

  return null;
}

export default async function SelectLocationPage({ searchParams }: SelectLocationPageProps) {
  const user = await requireUser();

  if (user.role !== "SALES_STAFF") {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const nextPath = normalizeNextPath(readParam(resolvedSearchParams.next));
  const errorMessage = getErrorMessage(readParam(resolvedSearchParams.error));
  const [locations, activeLocationId] = await Promise.all([
    prisma.stockLocation.findMany({
      where: {
        isActive: true,
        type: "BRANCH",
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
    getSalesStaffActiveLocationId(user),
  ]);

  if (locations.length === 0) {
    return (
      <AuthLayout>
        <h2 className="text-2xl font-semibold text-zinc-900">No branch available</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          No active branch is available for today. Please contact an admin or system manager.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold text-zinc-900">Choose your branch</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Select the branch you are working from today before entering the dashboard.
      </p>

      {errorMessage ? (
        <div className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <form action={setSalesStaffActiveLocationAction} className="mt-6 space-y-4">
        <input name="next" type="hidden" value={nextPath} />

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">Working branch</span>
          <select
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            defaultValue={activeLocationId ?? ""}
            name="locationId"
            required
          >
            <option value="">Select a branch</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.code})
              </option>
            ))}
          </select>
        </label>

        <button
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          type="submit"
        >
          Continue to dashboard
        </button>
      </form>
    </AuthLayout>
  );
}
