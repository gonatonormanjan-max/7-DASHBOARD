import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  description?: string;
  tone?: "default" | "primary" | "success" | "warning";
};

const toneClasses = {
  default: "border-t-info",
  primary: "border-t-info",
  success: "border-t-success",
  warning: "border-t-warning",
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
        "rounded-lg border border-border border-t-2 bg-card p-5",
        toneClasses[tone]
      )}
    >
      <p className="tracking-label text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
      {description ? (
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
