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
import { parseLocation, isDeployComplete, formatLocation } from "@/lib/parse-location";
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
  | { type: "RETRY_LOCATION" }
  | { type: "RETRY_TAG" };

const INITIAL: State = { step: "scan_tag", asset: null, result: null, error: null };
const DEPLOYABLE = new Set(["received", "stored"]);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ASSET_LOADED":
      return { ...state, step: "scan_location", asset: action.asset, error: null };
    case "INVALID_STATE":
      return {
        ...state, step: "error", asset: action.asset,
        error: {
          title: "Cannot deploy this asset",
          detail: `${action.asset.asset_tag} is currently ${action.asset.state}. Only received or stored assets can be deployed.`,
        },
      };
    case "SUBMIT":
      return { ...state, step: "submitting" };
    case "SUCCESS":
      return { ...state, step: "success", result: action.result, error: null };
    case "ERROR":
      return { ...state, step: "error", error: { title: action.title, detail: action.detail } };
    case "RETRY_LOCATION":
      return { ...state, step: "scan_location", error: null };
    case "RETRY_TAG":
      return { ...INITIAL, step: "scan_tag" };
    case "RESET":
      return INITIAL;
  }
}

// --- Validation ---

function validateDeployLocation(scanned: string): { title: string; detail: string } | null {
  const location = parseLocation(scanned);
  if (isDeployComplete(location)) return null;

  const missing = [];
  if (!location.site) missing.push("site");
  if (!location.room) missing.push("room");
  if (!location.rack) missing.push("rack");
  if (!location.ru) missing.push("rack unit (ru)");

  return {
    title: "Incomplete location",
    detail: `Deploy requires a full rack location. Missing: ${missing.join(", ")}. Scan a deploy location barcode with all five segments.`,
  };
}

// --- Page ---

export default function TechDeployPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  async function handleTagScan(value: string) {
    try {
      const asset = await api.assets.get(value);
      dispatch(DEPLOYABLE.has(asset.state)
        ? { type: "ASSET_LOADED", asset }
        : { type: "INVALID_STATE", asset });
    } catch (err) {
      dispatch(handleTagLookupError(err, value));
    }
  }

  async function handleLocationScan(value: string) {
    if (!state.asset) return;

    const validationError = validateDeployLocation(value);
    if (validationError) {
      dispatch({ type: "ERROR", ...validationError });
      return;
    }

    dispatch({ type: "SUBMIT" });
    try {
      const result = await scanClient.deploy({
        asset_tag: state.asset.asset_tag, location: parseLocation(value),
        user_id: getCurrentUserId(), scan_payload: value,
      });
      dispatch({ type: "SUCCESS", result });
    } catch (err) {
      dispatch(handleScanSubmitError(err, "Deploy failed"));
    }
  }

  // Incomplete location errors let you rescan the location without re-scanning the tag
  const isLocationError = state.step === "error" && state.asset &&
    state.error?.title === "Incomplete location";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-display font-semibold text-tagline text-headline">Deploy Asset</h1>
        <p className="text-caption text-muted mt-1">Scan the asset tag, then scan the rack location (must include rack unit).</p>
      </div>

      {state.step === "scan_tag" && (
        <ScanInput onScan={handleTagScan} label="Scan asset tag" />
      )}

      {state.asset && state.step !== "scan_tag" && state.step !== "success" && (
        <AssetInfoCard asset={state.asset} />
      )}

      {state.step === "scan_location" && (
        <ScanInput onScan={handleLocationScan} label="Scan deploy location"
          placeholder="Full location: site/room/row/rack/ru" />
      )}

      {state.step === "submitting" && (
        <SubmittingState message={`Deploying ${state.asset?.asset_tag}...`} />
      )}

      {state.step === "error" && state.error && (
        <div className="space-y-3">
          <Alert variant="error" title={state.error.title}>
            {state.error.detail}
          </Alert>
          <div className="flex gap-3">
            {isLocationError ? (
              <Button onClick={() => dispatch({ type: "RETRY_LOCATION" })}>
                Scan location again
              </Button>
            ) : (
              <Button onClick={() => dispatch({ type: "RETRY_TAG" })}>
                Scan a different tag
              </Button>
            )}
          </div>
        </div>
      )}

      {state.step === "success" && state.result && (
        <div className="space-y-4">
          <ScanSuccess title="Deployed">
            <strong>{state.result.asset_tag}</strong> is now in service at{" "}
            {formatLocation(state.result.location)}
          </ScanSuccess>
          <SyncWarnings warnings={state.result.sync_warnings} />
          <Button onClick={() => dispatch({ type: "RESET" })}>Scan Another</Button>
        </div>
      )}
    </div>
  );
}
