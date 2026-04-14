"use client";

type ChartCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}
