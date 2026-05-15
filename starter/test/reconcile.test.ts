import { describe, expect, it, vi, beforeEach } from "vitest";

// We test the reconciliation logic by mocking the API client and calling the
// route handler directly. The join is the testable part — the page just renders.

// Mock the api-client module
vi.mock("@/lib/api-client", () => ({
  api: {
    assets: { list: vi.fn() },
    mock: { facilities: vi.fn(), finance: vi.fn() },
  },
}));

import { api } from "@/lib/api-client";
import { GET } from "@/app/api/reconcile/route";

const mockAssets = api.assets.list as ReturnType<typeof vi.fn>;
const mockFacilities = api.mock.facilities as ReturnType<typeof vi.fn>;
const mockFinance = api.mock.finance as ReturnType<typeof vi.fn>;

async function getReport() {
  const res = await GET();
  return res.json();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reconciliation route", () => {
  it("returns empty report when all systems agree", async () => {
    mockAssets.mockResolvedValue([
      {
        asset_tag: "C0000001", serial: "SN-1", model: "M", manufacturer: "M",
        asset_class: "instrument", state: "in_service",
        location: { site: "A", room: "R1", row: "W1", rack: "RK1", ru: "U1" },
        custodian: "tech-jane", parent_asset_tag: null, procurement_note: null,
        created_at: "2025-01-01", updated_at: "2025-01-01",
      },
    ]);
    mockFacilities.mockResolvedValue([
      { space_id: "fac-1", tagged_id: "C0000001", rack_location: "A/R1/W1/RK1/U1", last_observed: "2025-05-01T00:00:00Z" },
    ]);
    mockFinance.mockResolvedValue([
      { finance_id: "EQ-1", tag: "C0000001", site: "A", book_value_usd: 1000, status: "capitalized", capitalized_on: "2025-01-01" },
    ]);

    const report = await getReport();
    expect(report.action_required.location_drift).toHaveLength(0);
    expect(report.action_required.disposed_but_capitalized).toHaveLength(0);
    expect(report.action_required.ghost_in_facilities).toHaveLength(0);
    expect(report.action_required.finance_orphan).toHaveLength(0);
    expect(report.needs_review.stale_facilities).toHaveLength(0);
    expect(report.needs_review.missing_from_finance).toHaveLength(0);
  });

  it("detects location drift between ops and facilities", async () => {
    mockAssets.mockResolvedValue([
      {
        asset_tag: "C0000110", serial: "SN", model: "M", manufacturer: "M",
        asset_class: "compute", state: "in_service",
        location: { site: "B", room: "Computing-1", row: "Aisle-1", rack: "C-12", ru: "U18" },
        custodian: "tech-priya", parent_asset_tag: null, procurement_note: null,
        created_at: "2025-01-01", updated_at: "2025-01-01",
      },
    ]);
    mockFacilities.mockResolvedValue([
      { space_id: "fac-1", tagged_id: "C0000110", rack_location: "B/Computing-1/Aisle-1/C-12/U16", last_observed: "2025-05-01T00:00:00Z" },
    ]);
    mockFinance.mockResolvedValue([
      { finance_id: "EQ-1", tag: "C0000110", site: "B", book_value_usd: 32000, status: "capitalized", capitalized_on: "2025-06-11" },
    ]);

    const report = await getReport();
    expect(report.action_required.location_drift).toHaveLength(1);
    expect(report.action_required.location_drift[0].asset_tag).toBe("C0000110");
    expect(report.action_required.location_drift[0].ops_location).toContain("U18");
    expect(report.action_required.location_drift[0].facilities_location).toContain("U16");
  });

  it("detects disposed asset still capitalized in finance", async () => {
    mockAssets.mockResolvedValue([
      {
        asset_tag: "C0000109", serial: "SN", model: "M", manufacturer: "M",
        asset_class: "instrument", state: "disposed",
        location: { site: "A", room: "Disposal", row: null, rack: "PALLET-9", ru: null },
        custodian: "vendor-erecycle", parent_asset_tag: null, procurement_note: null,
        created_at: "2025-01-01", updated_at: "2025-01-01",
      },
    ]);
    mockFacilities.mockResolvedValue([]);
    mockFinance.mockResolvedValue([
      { finance_id: "EQ-219", tag: "C0000109", site: "A", book_value_usd: 875000, status: "capitalized", capitalized_on: "2024-04-02" },
    ]);

    const report = await getReport();
    expect(report.action_required.disposed_but_capitalized).toHaveLength(1);
    expect(report.action_required.disposed_but_capitalized[0].asset_tag).toBe("C0000109");
  });

  it("detects ghost record in facilities with no ops match", async () => {
    mockAssets.mockResolvedValue([]);
    mockFacilities.mockResolvedValue([
      { space_id: "fac-9001", tagged_id: "C0000199", rack_location: "A/Bay-12/Aisle-3/B-07/U05", last_observed: "2025-05-08T00:00:00Z" },
    ]);
    mockFinance.mockResolvedValue([]);

    const report = await getReport();
    expect(report.action_required.ghost_in_facilities).toHaveLength(1);
    expect(report.action_required.ghost_in_facilities[0].tagged_id).toBe("C0000199");
  });

  it("detects finance orphan with no ops match", async () => {
    mockAssets.mockResolvedValue([]);
    mockFacilities.mockResolvedValue([]);
    mockFinance.mockResolvedValue([
      { finance_id: "EQ-230", tag: "C0000113", site: "A", book_value_usd: 1250000, status: "pending_receipt", capitalized_on: null },
    ]);

    const report = await getReport();
    expect(report.action_required.finance_orphan).toHaveLength(1);
    expect(report.action_required.finance_orphan[0].tag).toBe("C0000113");
  });

  it("detects stale facilities record for non-in_service asset", async () => {
    mockAssets.mockResolvedValue([
      {
        asset_tag: "C0000108", serial: "SN", model: "M", manufacturer: "M",
        asset_class: "instrument", state: "rma_pending",
        location: { site: "A", room: "Staging-RMA", row: null, rack: "BIN-RMA-1", ru: null },
        custodian: "container-rma-bin-1", parent_asset_tag: null, procurement_note: null,
        created_at: "2025-01-01", updated_at: "2025-01-01",
      },
    ]);
    mockFacilities.mockResolvedValue([
      { space_id: "fac-1108", tagged_id: "C0000108", rack_location: "A/Bay-12/Aisle-3/B-06/U30", last_observed: "2025-04-21T19:00:00Z" },
    ]);
    mockFinance.mockResolvedValue([]);

    const report = await getReport();
    expect(report.needs_review.stale_facilities).toHaveLength(1);
    expect(report.needs_review.stale_facilities[0].asset_tag).toBe("C0000108");
  });

  it("detects asset missing from finance", async () => {
    mockAssets.mockResolvedValue([
      {
        asset_tag: "C0000107", serial: "SN", model: "M", manufacturer: "M",
        asset_class: "instrument", state: "received",
        location: { site: "A", room: "Receiving", row: null, rack: "DOCK-2", ru: null },
        custodian: "tech-carlos", parent_asset_tag: null, procurement_note: null,
        created_at: "2025-01-01", updated_at: "2025-01-01",
      },
    ]);
    mockFacilities.mockResolvedValue([]);
    mockFinance.mockResolvedValue([]);

    const report = await getReport();
    expect(report.needs_review.missing_from_finance).toHaveLength(1);
    expect(report.needs_review.missing_from_finance[0].asset_tag).toBe("C0000107");
  });

  it("counts expected absences for non-in_service assets not in facilities", async () => {
    mockAssets.mockResolvedValue([
      {
        asset_tag: "C0000104", serial: "SN", model: "M", manufacturer: "M",
        asset_class: "instrument", state: "stored",
        location: { site: "A", room: "Storage-1", row: null, rack: "SHELF-3", ru: null },
        custodian: "container-storage-3", parent_asset_tag: null, procurement_note: null,
        created_at: "2025-01-01", updated_at: "2025-01-01",
      },
    ]);
    mockFacilities.mockResolvedValue([]);
    mockFinance.mockResolvedValue([
      { finance_id: "EQ-214", tag: "C0000104", site: "A", book_value_usd: 1250000, status: "capitalized", capitalized_on: "2026-01-15" },
    ]);

    const report = await getReport();
    expect(report.expected.not_in_facilities_by_scope.count).toBe(1);
  });

  it("returns 502 when API is unreachable", async () => {
    mockAssets.mockRejectedValue(new Error("fetch failed"));
    mockFacilities.mockResolvedValue([]);
    mockFinance.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(502);
  });

  it("classifies same asset in multiple categories when applicable", async () => {
    // C0000109: disposed in ops, still in facilities AND still capitalized
    mockAssets.mockResolvedValue([
      {
        asset_tag: "C0000109", serial: "SN", model: "M", manufacturer: "M",
        asset_class: "instrument", state: "disposed",
        location: { site: "A", room: "Disposal", row: null, rack: "PALLET-9", ru: null },
        custodian: "vendor-erecycle", parent_asset_tag: null, procurement_note: null,
        created_at: "2025-01-01", updated_at: "2025-01-01",
      },
    ]);
    mockFacilities.mockResolvedValue([
      { space_id: "fac-1109", tagged_id: "C0000109", rack_location: "A/Telecom-1/Aisle-1/T-02/U10", last_observed: "2025-03-15T08:00:00Z" },
    ]);
    mockFinance.mockResolvedValue([
      { finance_id: "EQ-219", tag: "C0000109", site: "A", book_value_usd: 875000, status: "capitalized", capitalized_on: "2024-04-02" },
    ]);

    const report = await getReport();
    expect(report.action_required.disposed_but_capitalized).toHaveLength(1);
    expect(report.needs_review.stale_facilities).toHaveLength(1);
    // Same asset appears in both categories
    expect(report.action_required.disposed_but_capitalized[0].asset_tag).toBe("C0000109");
    expect(report.needs_review.stale_facilities[0].asset_tag).toBe("C0000109");
  });
});
