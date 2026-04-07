import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  description?: string;
  tone?: "default" | "primary" | "success" | "warning";
};

const toneClasses = {
  default: "from-white to-slate-50",
  primary: "from-[#eff5fb] to-white",
  success: "from-[#edf8f4] to-white",
  warning: "from-[#fff7eb] to-white",
} as const;

export function StatCard({
  label,
  value,
  description,
  tone = "default",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-white/70 bg-gradient-to-br p-5 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]",
        toneClasses[tone]
      )}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {description ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
