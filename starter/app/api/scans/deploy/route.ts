import { NextRequest, NextResponse } from "next/server";
import { api } from "@/lib/api-client";
import { toRackLocationString } from "@/lib/parse-location";
import { errorResponse } from "@/lib/route-helpers";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const asset = await api.scans.deploy(body);

    const rackLocation = toRackLocationString(body.location);
    const syncWarnings = await writeback(body.asset_tag, rackLocation, body.location.site);

    return NextResponse.json({ ...asset, sync_warnings: syncWarnings });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

/** Write to facilities and finance after a successful deploy. */
async function writeback(
  assetTag: string,
  rackLocation: string,
  site: string,
): Promise<string[]> {
  const warnings: string[] = [];

  const results = await Promise.allSettled([
    api.mock.updateFacilities({ tagged_id: assetTag, rack_location: rackLocation }),
    api.mock.updateFinance({
      tag: assetTag,
      status: "capitalized",
      site,
      capitalized_on: new Date().toISOString().split("T")[0],
    }),
  ]);

  if (results[0].status === "rejected") warnings.push("Failed to update facilities system");
  if (results[1].status === "rejected") warnings.push("Failed to update finance system");

  return warnings;
}
