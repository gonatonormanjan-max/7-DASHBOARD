export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="hidden w-[46%] flex-col justify-between border-r border-sidebar-border bg-sidebar-background px-10 py-10 text-sidebar-foreground lg:flex">
          <div>
            <span className="tracking-label inline-flex rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1 text-[10px] text-sidebar-label">
              Internal Operations
            </span>
            <h1 className="mt-8 max-w-sm text-4xl font-semibold leading-tight">
              Keep inventory, warehouses, and orders in one calm control center.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-sidebar-foreground/80">
              Northstar Inventory is built for internal business teams managing stock,
              movement controls, supplier coordination, and delivery flow.
            </p>
          </div>

          <div className="space-y-4 rounded-lg border border-sidebar-border bg-sidebar-accent p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-sidebar-border bg-sidebar-background/40 p-4">
                <p className="tracking-label text-[10px] text-sidebar-label">
                  Warehouses
                </p>
                <p className="mt-2 text-2xl font-semibold">3 Active</p>
              </div>
              <div className="rounded-lg border border-sidebar-border bg-sidebar-background/40 p-4">
                <p className="tracking-label text-[10px] text-sidebar-label">
                  Low Stock
                </p>
                <p className="mt-2 text-2xl font-semibold">12 Alerts</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-sidebar-foreground/80">
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
