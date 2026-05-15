import { NextResponse } from "next/server";
import { api } from "@/lib/api-client";
import { toRackLocationString } from "@/lib/parse-location";
import type { Asset, FacilitiesRecord, FinanceRecord } from "@/lib/types";

// --- Types ---

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

type SystemMaps = {
  ops: Map<string, Asset>;
  fac: Map<string, FacilitiesRecord>;
  fin: Map<string, FinanceRecord>;
};

const STALE_THRESHOLD_DAYS = 90;

// --- Route handler ---

export async function GET(): Promise<NextResponse> {
  try {
    const [assets, facilities, finance] = await Promise.all([
      api.assets.list(),
      api.mock.facilities(),
      api.mock.finance(),
    ]);

    const maps = buildMaps(assets, facilities, finance);
    const allTags = collectTags(assets, facilities, finance);
    const latestObservation = findLatestObservation(facilities);
    const report = classify(allTags, maps, latestObservation);

    return NextResponse.json(report);
  } catch {
    return NextResponse.json(
      { error: { code: "reconcile_failed", message: "Failed to fetch data from one or more sources" } },
      { status: 502 },
    );
  }
}

// --- Data preparation ---

function buildMaps(
  assets: Asset[],
  facilities: FacilitiesRecord[],
  finance: FinanceRecord[],
): SystemMaps {
  const ops = new Map<string, Asset>();
  for (const a of assets) ops.set(a.asset_tag, a);

  const fac = new Map<string, FacilitiesRecord>();
  for (const f of facilities) fac.set(f.tagged_id, f);

  const fin = new Map<string, FinanceRecord>();
  for (const f of finance) fin.set(f.tag, f);

  return { ops, fac, fin };
}

function collectTags(
  assets: Asset[],
  facilities: FacilitiesRecord[],
  finance: FinanceRecord[],
): Set<string> {
  const tags = new Set<string>();
  for (const a of assets) tags.add(a.asset_tag);
  for (const f of facilities) tags.add(f.tagged_id);
  for (const f of finance) tags.add(f.tag);
  return tags;
}

function findLatestObservation(facilities: FacilitiesRecord[]): string {
  const dates = facilities.map((f) => f.last_observed).filter(Boolean).sort();
  return dates[dates.length - 1] || new Date().toISOString();
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

// --- Classification ---

function classify(
  allTags: Set<string>,
  { ops, fac, fin }: SystemMaps,
  latestObservation: string,
): ReconciliationReport {
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
    const asset = ops.get(tag);
    const facRec = fac.get(tag);
    const finRec = fin.get(tag);

    // Orphans: exist in one system but not in ops
    if (!asset) {
      classifyOrphan(tag, facRec, finRec, report);
      continue;
    }

    // Cross-system checks for assets that exist in ops
    checkFinanceDrift(asset, finRec, report);
    checkFacilitiesDrift(asset, facRec, latestObservation, report);
    checkExpectedAbsence(asset, facRec, report);
  }

  buildSummary(report);
  return report;
}

function classifyOrphan(
  tag: string,
  fac: FacilitiesRecord | undefined,
  fin: FinanceRecord | undefined,
  report: ReconciliationReport,
): void {
  if (fac) {
    report.action_required.ghost_in_facilities.push({
      tagged_id: tag,
      facilities_rack_location: fac.rack_location,
      facilities_last_observed: fac.last_observed,
      space_id: fac.space_id,
    });
  }
  if (fin) {
    report.action_required.finance_orphan.push({
      tag,
      finance_id: fin.finance_id,
      finance_status: fin.status,
      book_value_usd: fin.book_value_usd,
    });
  }
}

function checkFinanceDrift(
  asset: Asset,
  fin: FinanceRecord | undefined,
  report: ReconciliationReport,
): void {
  if (!fin) {
    report.needs_review.missing_from_finance.push({
      asset_tag: asset.asset_tag,
      ops_state: asset.state,
      model: asset.model,
    });
    return;
  }
  if (asset.state === "disposed" && fin.status === "capitalized") {
    report.action_required.disposed_but_capitalized.push({
      asset_tag: asset.asset_tag,
      ops_state: asset.state,
      finance_id: fin.finance_id,
      finance_status: fin.status,
      book_value_usd: fin.book_value_usd,
    });
  }
}

function checkFacilitiesDrift(
  asset: Asset,
  fac: FacilitiesRecord | undefined,
  latestObservation: string,
  report: ReconciliationReport,
): void {
  if (!fac) return;

  // Stale: asset not in_service but still tracked in facilities
  if (asset.state !== "in_service") {
    report.needs_review.stale_facilities.push({
      asset_tag: asset.asset_tag,
      ops_state: asset.state,
      facilities_rack_location: fac.rack_location,
      facilities_last_observed: fac.last_observed,
    });
    return;
  }

  // Location drift: both say in_service but locations disagree
  const opsLocation = toRackLocationString(asset.location);
  if (opsLocation !== fac.rack_location) {
    report.action_required.location_drift.push({
      asset_tag: asset.asset_tag,
      ops_location: opsLocation,
      facilities_location: fac.rack_location,
      model: asset.model,
    });
  }

  // Stale observation: in facilities but not observed recently
  if (daysBetween(fac.last_observed, latestObservation) > STALE_THRESHOLD_DAYS) {
    report.needs_review.stale_observation.push({
      asset_tag: asset.asset_tag,
      facilities_last_observed: fac.last_observed,
      latest_observation: latestObservation,
      days_stale: Math.round(daysBetween(fac.last_observed, latestObservation)),
    });
  }
}

function checkExpectedAbsence(
  asset: Asset,
  fac: FacilitiesRecord | undefined,
  report: ReconciliationReport,
): void {
  if (!fac && asset.state !== "in_service") {
    report.expected.not_in_facilities_by_scope.count++;
  }
}

function buildSummary(report: ReconciliationReport): void {
  for (const [key, items] of Object.entries(report.action_required)) {
    report.summary[key] = (items as DriftItem[]).length;
  }
  for (const [key, items] of Object.entries(report.needs_review)) {
    report.summary[key] = (items as DriftItem[]).length;
  }
  report.summary.not_in_facilities_by_scope = report.expected.not_in_facilities_by_scope.count;
}
