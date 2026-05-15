import { NextRequest, NextResponse } from "next/server";
import { api } from "@/lib/api-client";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Check current state before storing — need to know if de-racking from in_service
    const current = await api.assets.get(body.asset_tag);
    const wasInService = current.state === "in_service";

    const asset = await api.scans.store(body);

    const syncWarnings: string[] = [];

    // De-rack: remove from facilities when moving out of service
    // Store-from-received has no write-back per spec
    if (wasInService) {
      try {
        await api.mock.updateFacilities({
          tagged_id: body.asset_tag,
          rack_location: null,
        });
      } catch {
        syncWarnings.push("Failed to remove asset from facilities system");
      }
    }

    return NextResponse.json({ ...asset, sync_warnings: syncWarnings });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const e = err as { status: number; code: string; message: string; details?: Record<string, unknown> };
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
}
