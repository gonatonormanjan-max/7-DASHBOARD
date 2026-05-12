"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
};

function isSupportedImageSrc(src: string) {
  if (src.startsWith("/")) {
    return true;
  }

  try {
    const url = new URL(src);

    return (
      url.protocol === "https:" &&
      (url.hostname === "public.blob.vercel-storage.com" ||
        url.hostname.endsWith(".public.blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

export function ProductImage({
  src,
  alt,
  className,
  imageClassName,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const trimmedSrc = src?.trim();
  const canRenderImage = trimmedSrc && !failed && isSupportedImageSrc(trimmedSrc);

  return (
    <div
      className={cn(
        "relative flex overflow-hidden rounded-lg border border-slate-200 bg-slate-100",
        className
      )}
    >
      {canRenderImage ? (
        <Image
          alt={alt}
          className={cn("object-cover", imageClassName)}
          fill
          onError={() => setFailed(true)}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px"
          src={trimmedSrc}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-100 px-3 text-center text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
          No photo
        </div>
      )}
    </div>
  );
}
