export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="hidden w-[46%] flex-col justify-between border-r border-zinc-800/20 bg-zinc-950 px-10 py-10 text-zinc-200 lg:flex">
          <div>
            <span className="tracking-label inline-flex rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-[10px] text-amber-200">
              Internal Operations
            </span>
            <h1 className="mt-8 max-w-sm text-4xl font-semibold leading-tight">
              Keep inventory, warehouses, and orders in one calm control center.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-zinc-300">
              7-Dashboard is built for internal business teams managing stock,
              movement controls, supplier coordination, and delivery flow.
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="tracking-label text-[10px] text-zinc-500">
                  Warehouses
                </p>
                <p className="mt-2 text-2xl font-semibold">3 Active</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="tracking-label text-[10px] text-zinc-500">
                  Low Stock
                </p>
                <p className="mt-2 text-2xl font-semibold">12 Alerts</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-zinc-300">
              Ledger-based stock movements, role-based dashboards, and reporting all live
              under the same protected workspace.
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
