"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveSalesOrderAction,
  unarchiveSalesOrderAction,
  bulkArchiveSalesOrdersAction,
} from "@/lib/actions/sales-orders";
import { Button } from "@/components/ui/button";

export function ArchiveOrderButton({
  orderId,
}: {
  orderId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  function handleArchive() {
    startTransition(async () => {
      const response = await archiveSalesOrderAction(orderId);
      setMessage(response.message);
      setIsError(response.status === "error");

      if (response.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-1">
      <Button
        disabled={isPending}
        onClick={handleArchive}
        type="button"
        variant="outline"
        className="text-xs"
      >
        {isPending ? "Archiving..." : "Archive"}
      </Button>
      {message ? (
        <p className={`text-xs ${isError ? "text-red-600" : "text-emerald-700"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function UnarchiveOrderButton({
  orderId,
}: {
  orderId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  function handleUnarchive() {
    startTransition(async () => {
      const response = await unarchiveSalesOrderAction(orderId);
      setMessage(response.message);
      setIsError(response.status === "error");

      if (response.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-1">
      <Button
        disabled={isPending}
        onClick={handleUnarchive}
        type="button"
        variant="outline"
        className="text-xs"
      >
        {isPending ? "Restoring..." : "Restore"}
      </Button>
      {message ? (
        <p className={`text-xs ${isError ? "text-red-600" : "text-emerald-700"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function BulkArchiveButton() {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [days, setDays] = useState(30);
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  function handleBulkArchive() {
    startTransition(async () => {
      const response = await bulkArchiveSalesOrdersAction(days);
      setResult(response.message);
      setIsError(response.status === "error");
      setShowConfirm(false);
      if (response.status === "success") {
        router.refresh();
      }
      setTimeout(() => setResult(null), 4000);
    });
  }

  if (result) {
    return (
      <p className={`text-sm ${isError ? "text-red-600" : "text-green-700"}`}>{result}</p>
    );
  }

  if (!showConfirm) {
    return (
      <Button
        onClick={() => setShowConfirm(true)}
        type="button"
        variant="outline"
        className="text-xs"
      >
        Bulk archive
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">Archive orders older than</span>
      <select
        className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      >
        <option value={7}>7 days</option>
        <option value={14}>14 days</option>
        <option value={30}>30 days</option>
        <option value={60}>60 days</option>
        <option value={90}>90 days</option>
      </select>
      <Button
        disabled={isPending}
        onClick={handleBulkArchive}
        type="button"
        variant="outline"
        className="text-xs"
      >
        {isPending ? "Archiving..." : "Confirm"}
      </Button>
      <Button
        onClick={() => setShowConfirm(false)}
        type="button"
        variant="ghost"
        className="text-xs"
      >
        Cancel
      </Button>
    </div>
  );
}
