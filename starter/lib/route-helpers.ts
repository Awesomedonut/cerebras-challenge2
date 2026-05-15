import { NextResponse } from "next/server";

/**
 * Converts an ApiError (or unknown error) into a NextResponse.
 * Shared across server-side scan route handlers to avoid duplication.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err && typeof err === "object" && "status" in err) {
    const e = err as {
      status: number;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
    return NextResponse.json(
      { error: { code: e.code, message: e.message, details: e.details } },
      { status: e.status },
    );
  }
  return NextResponse.json(
    { error: { code: "internal_error", message: "Unexpected error" } },
    { status: 500 },
  );
}
