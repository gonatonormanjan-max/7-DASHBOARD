"use client";

import { useEffect, startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FLASH_ERROR_PARAM, FLASH_SUCCESS_PARAM } from "@/lib/flash-toast";

export function FlashToast() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const successMessage = searchParams.get(FLASH_SUCCESS_PARAM);
    const errorMessage = searchParams.get(FLASH_ERROR_PARAM);

    if (!successMessage && !errorMessage) {
      return;
    }

    if (successMessage) {
      toast.success(successMessage);
    }

    if (errorMessage) {
      toast.error(errorMessage);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(FLASH_SUCCESS_PARAM);
    nextParams.delete(FLASH_ERROR_PARAM);

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }, [pathname, router, searchParams]);

  return null;
}
