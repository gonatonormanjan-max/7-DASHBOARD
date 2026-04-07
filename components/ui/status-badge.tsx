import { cn } from "@/lib/utils";

type Status = "active" | "locked" | "draft" | "warning" | "success";

const statusStyles: Record<Status, string> = {
  active: "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]",
  locked: "border-slate-200 bg-slate-100 text-slate-600",
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  warning: "border-[#f2d2a2] bg-[#fff4e4] text-[#8a5610]",
  success: "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        statusStyles[variant]
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
