import { z } from "zod";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_PAGE).default(DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .catch(DEFAULT_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationParams = z.output<typeof paginationQuerySchema>;

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  from: number;
  to: number;
};

export type PaginatedResult<T> = {
  data: T;
  pagination: PaginationMeta;
};

export function parsePaginationParams(
  searchParams: Record<string, string | string[] | undefined>
) {
  return paginationQuerySchema.parse({
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });
}

export function getPaginationMeta(
  page: number,
  pageSize: number,
  totalCount: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = totalCount === 0 ? 0 : Math.min(safePage * pageSize, totalCount);

  return {
    page: safePage,
    pageSize,
    totalCount,
    totalPages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    from,
    to,
  };
}

export function getPaginationWindow(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
) {
  if (totalPages <= 1) {
    return [1];
  }

  const pages = new Set<number>([1, totalPages]);

  for (
    let page = Math.max(1, currentPage - siblingCount);
    page <= Math.min(totalPages, currentPage + siblingCount);
    page += 1
  ) {
    pages.add(page);
  }

  return [...pages].sort((left, right) => left - right);
}
