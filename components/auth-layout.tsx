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

          <div className="space-y-3">
            {[
              "Multi-branch inventory tracking",
              "Role-based access by team level",
              "Real-time stock movement control",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="text-sm text-zinc-400">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
