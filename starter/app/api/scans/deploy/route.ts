import { NextRequest, NextResponse } from "next/server";
import { api } from "@/lib/api-client";
import { toRackLocationString } from "@/lib/parse-location";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const asset = await api.scans.deploy(body);

    // Write back to facilities and finance on successful deploy
    const rackLocation = toRackLocationString(body.location);
    const syncWarnings: string[] = [];

    const results = await Promise.allSettled([
      api.mock.updateFacilities({
        tagged_id: body.asset_tag,
        rack_location: rackLocation,
      }),
      api.mock.updateFinance({
        tag: body.asset_tag,
        status: "capitalized",
        site: body.location.site,
        capitalized_on: new Date().toISOString().split("T")[0],
      }),
    ]);

    if (results[0].status === "rejected") {
      syncWarnings.push("Failed to update facilities system");
    }
    if (results[1].status === "rejected") {
      syncWarnings.push("Failed to update finance system");
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
