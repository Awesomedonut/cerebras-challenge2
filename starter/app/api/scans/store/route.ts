import { NextRequest, NextResponse } from "next/server";
import { api } from "@/lib/api-client";
import { errorResponse } from "@/lib/route-helpers";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    const current = await api.assets.get(body.asset_tag);
    const wasInService = current.state === "in_service";

    const asset = await api.scans.store(body);
    const syncWarnings = wasInService ? await derack(body.asset_tag) : [];

    return NextResponse.json({ ...asset, sync_warnings: syncWarnings });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

/** Remove asset from facilities when de-racking (store from in_service). */
async function derack(assetTag: string): Promise<string[]> {
  try {
    await api.mock.updateFacilities({ tagged_id: assetTag, rack_location: null });
    return [];
  } catch {
    return ["Failed to remove asset from facilities system"];
  }
}
