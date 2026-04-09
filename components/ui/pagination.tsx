import Link from "next/link";
import {
  DEFAULT_PAGE_SIZE,
  getPaginationWindow,
  type PaginationMeta,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";

type QueryValue = string | number | undefined | null;

type PaginationProps = {
  basePath: string;
  pagination: PaginationMeta;
  query?: Record<string, QueryValue>;
  itemLabel?: string;
};

function buildHref(
  basePath: string,
  query: Record<string, QueryValue>,
  page: number,
  pageSize: number
) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  params.set("page", String(page));

  if (pageSize !== DEFAULT_PAGE_SIZE || params.has("pageSize")) {
    params.set("pageSize", String(pageSize));
  }

  return `${basePath}?${params.toString()}`;
}

function PaginationLink({
  href,
  isActive,
  isDisabled,
  children,
}: {
  href: string;
  isActive?: boolean;
  isDisabled?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "inline-flex min-w-10 items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
    isActive
      ? "border-primary bg-primary text-primary-foreground"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
    isDisabled && "pointer-events-none opacity-50"
  );

  if (isDisabled) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

export function Pagination({
  basePath,
  pagination,
  query = {},
  itemLabel = "products",
}: PaginationProps) {
  if (pagination.totalCount === 0 || pagination.totalPages <= 1) {
    return null;
  }

  const visiblePages = getPaginationWindow(pagination.page, pagination.totalPages);
  const pageItems: Array<number | "ellipsis"> = [];

  visiblePages.forEach((page, index) => {
    const previousPage = visiblePages[index - 1];

    if (previousPage && page - previousPage > 1) {
      pageItems.push("ellipsis");
    }

    pageItems.push(page);
  });

  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)] sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Showing {pagination.from}-{pagination.to} of {pagination.totalCount} {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <PaginationLink
          href={buildHref(basePath, query, pagination.page - 1, pagination.pageSize)}
          isDisabled={!pagination.hasPrev}
        >
          Previous
        </PaginationLink>

        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex min-w-10 items-center justify-center px-2 text-sm font-semibold text-slate-400"
            >
              ...
            </span>
          ) : (
            <PaginationLink
              key={item}
              href={buildHref(basePath, query, item, pagination.pageSize)}
              isActive={item === pagination.page}
            >
              {item}
            </PaginationLink>
          )
        )}

        <PaginationLink
          href={buildHref(basePath, query, pagination.page + 1, pagination.pageSize)}
          isDisabled={!pagination.hasNext}
        >
          Next
        </PaginationLink>
      </div>
    </div>
  );
}