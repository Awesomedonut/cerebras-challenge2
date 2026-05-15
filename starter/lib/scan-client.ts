import type {
  Asset,
  StoreScanInput,
  DeployScanInput,
  ApiErrorBody,
} from "./types";
import { ApiError } from "./api-client";

/** Asset response extended with optional sync warnings from write-back. */
export type ScanResponse = Asset & { sync_warnings?: string[] };

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const errBody = json as ApiErrorBody | null;
    const code = errBody?.error?.code ?? "unknown_error";
    const message = errBody?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, code, message, errBody?.error?.details);
  }

  return json as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((res) => handleResponse<T>(res));
}

/**
 * Client-side wrappers for scan operations that need server-side write-back.
 * Deploy and store go through custom Next.js API routes that orchestrate
 * the upstream call + facilities/finance writes (token stays server-side).
 *
 * Receive and transfer have no write-backs, so they use the existing
 * api client (which proxies through /api/upstream) directly.
 */
export const scanClient = {
  store: (input: StoreScanInput) => post<ScanResponse>("/api/scans/store", input),
  deploy: (input: DeployScanInput) => post<ScanResponse>("/api/scans/deploy", input),
};
