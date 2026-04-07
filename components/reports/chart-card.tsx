"use client";

type ChartCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}
