import { NextResponse } from "next/server";
import { api } from "@/lib/api-client";
import { toRackLocationString } from "@/lib/parse-location";
import type { Asset, FacilitiesRecord, FinanceRecord } from "@/lib/types";

type DriftItem = Record<string, unknown>;

type ReconciliationReport = {
  generated_at: string;
  summary: Record<string, number>;
  action_required: {
    location_drift: DriftItem[];
    disposed_but_capitalized: DriftItem[];
    ghost_in_facilities: DriftItem[];
    finance_orphan: DriftItem[];
  };
  needs_review: {
    stale_facilities: DriftItem[];
    missing_from_finance: DriftItem[];
    stale_observation: DriftItem[];
  };
  expected: {
    not_in_facilities_by_scope: { count: number; description: string };
  };
};

// Threshold for "stale" observation in facilities (90 days)
const STALE_OBSERVATION_DAYS = 90;

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

export async function GET(): Promise<NextResponse> {
  try {
    const [assets, facilities, finance] = await Promise.all([
      api.assets.list(),
      api.mock.facilities(),
      api.mock.finance(),
    ]);

    // Build lookup maps
    const opsMap = new Map<string, Asset>();
    for (const a of assets) opsMap.set(a.asset_tag, a);

    const facMap = new Map<string, FacilitiesRecord>();
    for (const f of facilities) facMap.set(f.tagged_id, f);

    const finMap = new Map<string, FinanceRecord>();
    for (const f of finance) finMap.set(f.tag, f);

    // Collect all unique tags
    const allTags = new Set<string>();
    for (const a of assets) allTags.add(a.asset_tag);
    for (const f of facilities) allTags.add(f.tagged_id);
    for (const f of finance) allTags.add(f.tag);

    // Find the most recent observation date for staleness comparison
    const observationDates = facilities
      .map((f) => f.last_observed)
      .filter(Boolean)
      .sort();
    const latestObservation = observationDates[observationDates.length - 1] || new Date().toISOString();

    const report: ReconciliationReport = {
      generated_at: new Date().toISOString(),
      summary: {},
      action_required: {
        location_drift: [],
        disposed_but_capitalized: [],
        ghost_in_facilities: [],
        finance_orphan: [],
      },
      needs_review: {
        stale_facilities: [],
        missing_from_finance: [],
        stale_observation: [],
      },
      expected: {
        not_in_facilities_by_scope: {
          count: 0,
          description: "Assets not in service (stored, received, RMA, disposed) correctly absent from facilities",
        },
      },
    };

    for (const tag of allTags) {
      const ops = opsMap.get(tag);
      const fac = facMap.get(tag);
      const fin = finMap.get(tag);

      // Ghost in facilities: tag in facilities but not in ops
      if (fac && !ops) {
        report.action_required.ghost_in_facilities.push({
          tagged_id: tag,
          facilities_rack_location: fac.rack_location,
          facilities_last_observed: fac.last_observed,
          space_id: fac.space_id,
        });
        continue;
      }

      // Finance orphan: tag in finance but not in ops
      if (fin && !ops) {
        report.action_required.finance_orphan.push({
          tag,
          finance_id: fin.finance_id,
          finance_status: fin.status,
          book_value_usd: fin.book_value_usd,
        });
        continue;
      }

      if (!ops) continue;

      // Missing from finance: in ops but not in finance
      if (!fin) {
        report.needs_review.missing_from_finance.push({
          asset_tag: tag,
          ops_state: ops.state,
          model: ops.model,
        });
      }

      // Disposed but capitalized: ops=disposed, finance=capitalized
      if (fin && ops.state === "disposed" && fin.status === "capitalized") {
        report.action_required.disposed_but_capitalized.push({
          asset_tag: tag,
          ops_state: ops.state,
          finance_id: fin.finance_id,
          finance_status: fin.status,
          book_value_usd: fin.book_value_usd,
        });
      }

      // Stale facilities: asset not in_service but still in facilities
      if (fac && ops.state !== "in_service") {
        report.needs_review.stale_facilities.push({
          asset_tag: tag,
          ops_state: ops.state,
          facilities_rack_location: fac.rack_location,
          facilities_last_observed: fac.last_observed,
        });
      }

      // Location drift: in_service in both ops and facilities, but locations differ
      if (fac && ops.state === "in_service") {
        const opsLocation = toRackLocationString(ops.location);
        if (opsLocation !== fac.rack_location) {
          report.action_required.location_drift.push({
            asset_tag: tag,
            ops_location: opsLocation,
            facilities_location: fac.rack_location,
            model: ops.model,
          });
        }

        // Stale observation: in facilities but last_observed is much older than peers
        if (daysBetween(fac.last_observed, latestObservation) > STALE_OBSERVATION_DAYS) {
          report.needs_review.stale_observation.push({
            asset_tag: tag,
            facilities_last_observed: fac.last_observed,
            latest_observation: latestObservation,
            days_stale: Math.round(daysBetween(fac.last_observed, latestObservation)),
          });
        }
      }

      // Expected: not in_service and correctly not in facilities
      if (!fac && ops.state !== "in_service") {
        report.expected.not_in_facilities_by_scope.count++;
      }
    }

    // Build summary counts
    for (const [key, items] of Object.entries(report.action_required)) {
      report.summary[key] = (items as DriftItem[]).length;
    }
    for (const [key, items] of Object.entries(report.needs_review)) {
      report.summary[key] = (items as DriftItem[]).length;
    }
    report.summary.not_in_facilities_by_scope =
      report.expected.not_in_facilities_by_scope.count;

    return NextResponse.json(report);
  } catch {
    return NextResponse.json(
      { error: { code: "reconcile_failed", message: "Failed to fetch data from one or more sources" } },
      { status: 502 },
    );
  }
}
