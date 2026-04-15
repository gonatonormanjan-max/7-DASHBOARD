"use client";

import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ReportsView = "overview" | "analytics" | "quota";

type SaveReportsPdfButtonProps = {
  view: ReportsView;
};

function getViewLabel(view: ReportsView) {
  if (view === "analytics") {
    return "analytics";
  }

  if (view === "quota") {
    return "quota";
  }

  return "overview";
}

function buildFallbackFileName(view: ReportsView) {
  const datePart = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date());

  return `7dashboard-reports-${getViewLabel(view)}-${datePart}.pdf`;
}

function parseFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return plainMatch?.[1] ?? null;
}

export function SaveReportsPdfButton({ view }: SaveReportsPdfButtonProps) {
  const searchParams = useSearchParams();
  const [isGenerating, setIsGenerating] = useState(false);

  const endpoint = useMemo(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("view", view);
    return `/api/reports/pdf?${nextParams.toString()}`;
  }, [searchParams, view]);

  const handleDownload = async () => {
    if (isGenerating) {
      return;
    }

    try {
      setIsGenerating(true);
      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        let message = "Failed to generate the report PDF.";

        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {}

        toast.error(message);
        return;
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName =
        parseFileName(response.headers.get("content-disposition")) ??
        buildFallbackFileName(view);

      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
      toast.success("Report PDF generated.");
    } catch (error) {
      console.error("Failed to download report PDF.", error);
      toast.error("Could not download the report PDF right now.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      disabled={isGenerating}
      onClick={handleDownload}
      variant="outline"
    >
      <FileDown className="mr-2 size-4" />
      {isGenerating ? "Generating PDF..." : "Download PDF"}
    </Button>
  );
}
