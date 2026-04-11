import { cn } from "@/lib/utils";

type Status = "active" | "locked" | "draft" | "warning" | "success";

const statusStyles: Record<Status, string> = {
  active: "bg-info/10 text-info",
  locked: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
};

function normalizeStatus(status: string): Status {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("cancel") ||
    normalized.includes("void") ||
    normalized.includes("locked")
  ) {
    return "locked";
  }

  if (normalized.includes("draft")) {
    return "draft";
  }

  if (normalized.includes("partial") || normalized.includes("warning")) {
    return "warning";
  }

  if (
    normalized.includes("received") ||
    normalized.includes("completed") ||
    normalized.includes("delivered") ||
    normalized.includes("active") ||
    normalized.includes("success")
  ) {
    return "success";
  }

  return "active";
}

export function StatusBadge({ status }: { status: string }) {
  const variant = normalizeStatus(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        statusStyles[variant]
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
