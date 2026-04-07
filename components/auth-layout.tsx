export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="hidden w-[46%] flex-col justify-between border-r border-slate-200/80 bg-[linear-gradient(160deg,#18314d_0%,#21476c_45%,#3f6e92_100%)] px-10 py-10 text-slate-100 lg:flex">
          <div>
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
              Internal Operations
            </span>
            <h1 className="mt-8 max-w-sm text-4xl font-semibold leading-tight">
              Keep inventory, warehouses, and orders in one calm control center.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-200/82">
              Northstar Inventory is built for internal business teams managing stock,
              movement controls, supplier coordination, and delivery flow.
            </p>
          </div>

          <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/8 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-200/70">
                  Warehouses
                </p>
                <p className="mt-2 text-2xl font-semibold">3 Active</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-200/70">
                  Low Stock
                </p>
                <p className="mt-2 text-2xl font-semibold">12 Alerts</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-100/80">
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
