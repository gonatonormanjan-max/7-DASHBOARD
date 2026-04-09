export const FLASH_SUCCESS_PARAM = "toastSuccess";
export const FLASH_ERROR_PARAM = "toastError";

export function withFlashMessage(
  path: string,
  options: {
    success?: string;
    error?: string;
  }
) {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);

  if (options.success) {
    params.set(FLASH_SUCCESS_PARAM, options.success);
  }

  if (options.error) {
    params.set(FLASH_ERROR_PARAM, options.error);
  }

  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}
