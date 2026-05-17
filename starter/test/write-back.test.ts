import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-client", () => ({
  api: {
    assets: { get: vi.fn() },
    scans: { deploy: vi.fn(), store: vi.fn() },
    mock: { updateFacilities: vi.fn(), updateFinance: vi.fn() },
  },
}));

import { api } from "@/lib/api-client";

const mockDeploy = api.scans.deploy as ReturnType<typeof vi.fn>;
const mockStore = api.scans.store as ReturnType<typeof vi.fn>;
const mockGetAsset = api.assets.get as ReturnType<typeof vi.fn>;
const mockUpdateFacilities = api.mock.updateFacilities as ReturnType<typeof vi.fn>;
const mockUpdateFinance = api.mock.updateFinance as ReturnType<typeof vi.fn>;

// Import route handlers after mocking
import { POST as deployPOST } from "@/app/api/scans/deploy/route";
import { POST as storePOST } from "@/app/api/scans/store/route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/scans/deploy", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const DEPLOY_BODY = {
  asset_tag: "C0009001",
  location: { site: "A", room: "R1", row: "W1", rack: "RK1", ru: "U1" },
  user_id: "tech-jane",
  scan_payload: "C0009001",
};

const STORE_BODY = {
  asset_tag: "C0009001",
  location: { site: "A", room: "Storage-1", row: null, rack: "SHELF-3", ru: null },
  user_id: "tech-jane",
  scan_payload: "C0009001",
};

const MOCK_ASSET = {
  asset_tag: "C0009001", serial: "SN-1", model: "M", manufacturer: "M",
  asset_class: "instrument", state: "in_service",
  location: { site: "A", room: "R1", row: "W1", rack: "RK1", ru: "U1" },
  custodian: "tech-jane", parent_asset_tag: null, procurement_note: null,
  created_at: "2025-01-01", updated_at: "2025-01-01",
};

beforeEach(() => vi.clearAllMocks());

describe("deploy write-back", () => {
  it("writes to facilities and finance on success", async () => {
    mockDeploy.mockResolvedValue(MOCK_ASSET);
    mockUpdateFacilities.mockResolvedValue({ ok: true });
    mockUpdateFinance.mockResolvedValue({ ok: true });

    const res = await deployPOST(makeRequest(DEPLOY_BODY));
    const data = await res.json();

    expect(mockUpdateFacilities).toHaveBeenCalledWith({
      tagged_id: "C0009001",
      rack_location: "A/R1/W1/RK1/U1",
    });
    expect(mockUpdateFinance).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: "C0009001",
        status: "capitalized",
        site: "A",
      }),
    );
    expect(data.sync_warnings).toEqual([]);
  });

  it("surfaces sync_warnings when facilities write fails", async () => {
    mockDeploy.mockResolvedValue(MOCK_ASSET);
    mockUpdateFacilities.mockRejectedValue(new Error("network error"));
    mockUpdateFinance.mockResolvedValue({ ok: true });

    const res = await deployPOST(makeRequest(DEPLOY_BODY));
    const data = await res.json();

    expect(data.asset_tag).toBe("C0009001");
    expect(data.sync_warnings).toContain("Failed to update facilities system");
  });

  it("surfaces sync_warnings when finance write fails", async () => {
    mockDeploy.mockResolvedValue(MOCK_ASSET);
    mockUpdateFacilities.mockResolvedValue({ ok: true });
    mockUpdateFinance.mockRejectedValue(new Error("network error"));

    const res = await deployPOST(makeRequest(DEPLOY_BODY));
    const data = await res.json();

    expect(data.sync_warnings).toContain("Failed to update finance system");
  });
});

describe("store write-back", () => {
  it("de-racks from facilities when storing an in-service asset", async () => {
    mockGetAsset.mockResolvedValue({ ...MOCK_ASSET, state: "in_service" });
    mockStore.mockResolvedValue({ ...MOCK_ASSET, state: "stored" });
    mockUpdateFacilities.mockResolvedValue({ ok: true });

    const res = await storePOST(makeRequest(STORE_BODY));
    const data = await res.json();

    expect(mockUpdateFacilities).toHaveBeenCalledWith({
      tagged_id: "C0009001",
      rack_location: null,
    });
    expect(data.sync_warnings).toEqual([]);
  });

  it("does NOT write to facilities when storing a received asset", async () => {
    mockGetAsset.mockResolvedValue({ ...MOCK_ASSET, state: "received" });
    mockStore.mockResolvedValue({ ...MOCK_ASSET, state: "stored" });

    await storePOST(makeRequest(STORE_BODY));

    expect(mockUpdateFacilities).not.toHaveBeenCalled();
  });

  it("surfaces sync_warnings when de-rack fails", async () => {
    mockGetAsset.mockResolvedValue({ ...MOCK_ASSET, state: "in_service" });
    mockStore.mockResolvedValue({ ...MOCK_ASSET, state: "stored" });
    mockUpdateFacilities.mockRejectedValue(new Error("network error"));

    const res = await storePOST(makeRequest(STORE_BODY));
    const data = await res.json();

    expect(data.sync_warnings).toContain("Failed to remove asset from facilities system");
  });
});
