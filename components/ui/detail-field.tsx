type DetailFieldProps = {
  label: string;
  value: React.ReactNode;
};

export function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm leading-6 text-slate-700">{value}</div>
    </div>
  );
}
