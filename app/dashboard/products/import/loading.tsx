export default function ImportLoading() {
  return (
    <div className="space-y-8">
      {/* Page header skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-slate-200" />
        <div className="h-10 w-80 rounded-full bg-slate-200" />
        <div className="h-4 w-full max-w-2xl rounded-full bg-slate-200" />
      </div>

      {/* Step indicator skeleton */}
      <div className="flex justify-center">
        <div className="flex items-center gap-4">
          {[1, 2, 3].map((n, i) => (
            <div key={n} className="flex items-center gap-4">
              <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
              {i < 2 && <div className="h-px w-12 bg-slate-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Wizard card skeleton */}
      <div className="animate-pulse rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div className="h-24 rounded-[20px] bg-slate-100" />
          <div className="h-48 rounded-[20px] bg-slate-100" />
          <div className="flex justify-end">
            <div className="h-10 w-28 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
