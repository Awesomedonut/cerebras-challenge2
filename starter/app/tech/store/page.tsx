"use client";

import { useReducer } from "react";
import { ScanInput } from "@/components/ScanInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AssetInfoCard } from "@/components/scan/AssetInfoCard";
import { SubmittingState } from "@/components/scan/SubmittingState";
import { SyncWarnings } from "@/components/scan/SyncWarnings";
import { ScanSuccess } from "@/components/scan/ScanSuccess";
import { api } from "@/lib/api-client";
import { scanClient, type ScanResponse } from "@/lib/scan-client";
import { getCurrentUserId } from "@/lib/auth";
import { parseLocation, formatLocation } from "@/lib/parse-location";
import { handleTagLookupError, handleScanSubmitError } from "@/lib/scan-errors";
import type { Asset } from "@/lib/types";

// --- State machine ---

type Step = "scan_tag" | "scan_location" | "submitting" | "success" | "error";

type State = {
  step: Step;
  asset: Asset | null;
  result: ScanResponse | null;
  error: { title: string; detail: string } | null;
};

type Action =
  | { type: "ASSET_LOADED"; asset: Asset }
  | { type: "INVALID_STATE"; asset: Asset }
  | { type: "SUBMIT" }
  | { type: "SUCCESS"; result: ScanResponse }
  | { type: "ERROR"; title: string; detail: string }
  | { type: "RESET" }
  | { type: "RETRY_TAG" };

const INITIAL: State = { step: "scan_tag", asset: null, result: null, error: null };
const STORABLE = new Set(["received", "in_service"]);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ASSET_LOADED":
      return { ...state, step: "scan_location", asset: action.asset, error: null };
    case "INVALID_STATE":
      return {
        ...state, step: "error", asset: action.asset,
        error: {
          title: "Cannot store this asset",
          detail: `${action.asset.asset_tag} is currently ${action.asset.state}. Only received or in-service assets can be stored.`,
        },
      };
    case "SUBMIT":
      return { ...state, step: "submitting" };
    case "SUCCESS":
      return { ...state, step: "success", result: action.result, error: null };
    case "ERROR":
      return { ...state, step: "error", error: { title: action.title, detail: action.detail } };
    case "RETRY_TAG":
      return { ...INITIAL, step: "scan_tag" };
    case "RESET":
      return INITIAL;
  }
}

// --- Page ---

export default function TechStorePage() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  async function handleTagScan(value: string) {
    try {
      const asset = await api.assets.get(value);
      dispatch(STORABLE.has(asset.state)
        ? { type: "ASSET_LOADED", asset }
        : { type: "INVALID_STATE", asset });
    } catch (err) {
      dispatch(handleTagLookupError(err, value));
    }
  }

  async function handleLocationScan(value: string) {
    if (!state.asset) return;

    const location = parseLocation(value);
    if (!location.site) {
      dispatch({ type: "ERROR", title: "Invalid location", detail: "Could not parse a site from the scanned value. Scan a location barcode or type one." });
      return;
    }

    dispatch({ type: "SUBMIT" });
    try {
      const result = await scanClient.store({
        asset_tag: state.asset.asset_tag, location,
        user_id: getCurrentUserId(), scan_payload: value,
      });
      dispatch({ type: "SUCCESS", result });
    } catch (err) {
      dispatch(handleScanSubmitError(err, "Store failed"));
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-display font-semibold text-tagline text-headline">Store Asset</h1>
        <p className="text-caption text-muted mt-1">Scan the asset tag, then scan the storage location.</p>
      </div>

      {state.step === "scan_tag" && (
        <ScanInput onScan={handleTagScan} label="Scan asset tag" />
      )}

      {state.asset && state.step !== "scan_tag" && state.step !== "success" && (
        <AssetInfoCard asset={state.asset} />
      )}

      {state.step === "scan_location" && (
        <ScanInput onScan={handleLocationScan} label="Scan storage location"
          placeholder="Scan or type location (e.g. Lab-Building-A/Storage-1//SHELF-3/)" />
      )}

      {state.step === "submitting" && (
        <SubmittingState message={`Storing ${state.asset?.asset_tag}...`} />
      )}

      {state.step === "error" && state.error && (
        <div className="space-y-3">
          <Alert variant="error" title={state.error.title}>
            {state.error.detail}
          </Alert>
          <div className="flex gap-3">
            <Button onClick={() => dispatch({ type: "RETRY_TAG" })}>Scan a different tag</Button>
          </div>
        </div>
      )}

      {state.step === "success" && state.result && (
        <div className="space-y-4">
          <ScanSuccess title="Stored">
            <strong>{state.result.asset_tag}</strong> moved to{" "}
            {formatLocation(state.result.location)}
          </ScanSuccess>
          <SyncWarnings warnings={state.result.sync_warnings} />
          <Button onClick={() => dispatch({ type: "RESET" })}>Scan Another</Button>
        </div>
      )}
    </div>
  );
}
