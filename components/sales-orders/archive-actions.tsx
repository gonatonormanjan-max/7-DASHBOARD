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
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleArchive() {
    startTransition(async () => {
      await archiveSalesOrderAction(orderId);
      router.refresh();
    });
  }

  return (
    <Button
      disabled={isPending}
      onClick={handleArchive}
      type="button"
      variant="outline"
      className="text-xs"
    >
      {isPending ? "Archiving..." : "Archive"}
    </Button>
  );
}

export function UnarchiveOrderButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleUnarchive() {
    startTransition(async () => {
      await unarchiveSalesOrderAction(orderId);
      router.refresh();
    });
  }

  return (
    <Button
      disabled={isPending}
      onClick={handleUnarchive}
      type="button"
      variant="outline"
      className="text-xs"
    >
      {isPending ? "Restoring..." : "Restore"}
    </Button>
  );
}

export function BulkArchiveButton() {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [days, setDays] = useState(30);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  function handleBulkArchive() {
    startTransition(async () => {
      const response = await bulkArchiveSalesOrdersAction(days);
      setResult(response.message);
      setShowConfirm(false);
      router.refresh();
      setTimeout(() => setResult(null), 4000);
    });
  }

  if (result) {
    return (
      <p className="text-sm text-green-700">{result}</p>
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
