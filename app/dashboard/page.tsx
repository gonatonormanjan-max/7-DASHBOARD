import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top Bar */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-zinc-900">7Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/auth/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h2 className="text-2xl font-semibold text-zinc-900">
          Welcome back, {session.user.name?.split(" ")[0]}!
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Here&apos;s an overview of your dashboard.
        </p>

        {/* Stats Cards */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Users", value: "—" },
            { label: "Active Sessions", value: "—" },
            { label: "New Signups", value: "—" },
            { label: "Uptime", value: "99.9%" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-zinc-200 bg-white p-6"
            >
              <p className="text-sm text-zinc-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
