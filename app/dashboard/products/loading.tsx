export default function ProductsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-slate-200" />
        <div className="h-10 w-72 rounded-full bg-slate-200" />
        <div className="h-4 w-full max-w-2xl rounded-full bg-slate-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>

      <div className="h-44 animate-pulse rounded-lg border border-border bg-card" />
      <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
    </div>
  );
}
