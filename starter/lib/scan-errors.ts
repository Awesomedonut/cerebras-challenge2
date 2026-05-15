import { ApiError } from "./api-client";

type ErrorAction = { type: "ERROR"; title: string; detail: string };

/** Shared error handler for tag-lookup failures across scan pages. */
export function handleTagLookupError(err: unknown, tag: string): ErrorAction {
  if (err instanceof ApiError && err.code === "unknown_asset") {
    return {
      type: "ERROR",
      title: "Unknown asset",
      detail: `No asset found with tag "${tag}". Check the label and scan again.`,
    };
  }
  return {
    type: "ERROR",
    title: "Lookup failed",
    detail: "Could not reach the API. Check your connection.",
  };
}

/** Shared error handler for scan submission failures. */
export function handleScanSubmitError(
  err: unknown,
  fallbackTitle: string,
): ErrorAction {
  if (err instanceof ApiError) {
    return { type: "ERROR", title: fallbackTitle, detail: err.message };
  }
  return {
    type: "ERROR",
    title: "Unexpected error",
    detail: "Could not reach the API.",
  };
}
