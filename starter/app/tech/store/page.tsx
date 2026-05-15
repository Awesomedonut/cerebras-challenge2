"use client";

import { useReducer } from "react";
import { ScanInput } from "@/components/ScanInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LocationDisplay } from "@/components/ui/LocationDisplay";
import { api, ApiError } from "@/lib/api-client";
import { scanClient, type ScanResponse } from "@/lib/scan-client";
import { getCurrentUserId } from "@/lib/auth";
import { parseLocation } from "@/lib/parse-location";
import type { Asset } from "@/lib/types";

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
  | { type: "RESET" };

const initialState: State = { step: "scan_tag", asset: null, result: null, error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ASSET_LOADED":
      return { ...state, step: "scan_location", asset: action.asset, error: null };
    case "INVALID_STATE":
      return {
        ...state,
        step: "error",
        asset: action.asset,
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
    case "RESET":
      return initialState;
  }
}

const STORABLE_STATES = new Set(["received", "in_service"]);

export default function TechStorePage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  async function handleTagScan(value: string) {
    try {
      const asset = await api.assets.get(value);
      if (!STORABLE_STATES.has(asset.state)) {
        dispatch({ type: "INVALID_STATE", asset });
      } else {
        dispatch({ type: "ASSET_LOADED", asset });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "unknown_asset") {
        dispatch({ type: "ERROR", title: "Unknown asset", detail: `No asset found with tag "${value}". Check the label and scan again.` });
      } else {
        dispatch({ type: "ERROR", title: "Lookup failed", detail: "Could not reach the API. Check your connection." });
      }
    }
  }

  async function handleLocationScan(value: string) {
    if (!state.asset) return;
    dispatch({ type: "SUBMIT" });

    const location = parseLocation(value);
    if (!location.site) {
      dispatch({ type: "ERROR", title: "Invalid location", detail: "Could not parse a site from the scanned value. Scan a location barcode or type one." });
      return;
    }

    try {
      const result = await scanClient.store({
        asset_tag: state.asset.asset_tag,
        location,
        user_id: getCurrentUserId(),
        scan_payload: value,
      });
      dispatch({ type: "SUCCESS", result });
    } catch (err) {
      if (err instanceof ApiError) {
        dispatch({ type: "ERROR", title: "Store failed", detail: err.message });
      } else {
        dispatch({ type: "ERROR", title: "Unexpected error", detail: "Could not reach the API." });
      }
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-display font-semibold text-tagline text-headline">
          Store Asset
        </h1>
        <p className="text-caption text-muted mt-1">
          Scan the asset tag, then scan the storage location.
        </p>
      </div>

      {/* Step 1: Scan tag */}
      {state.step === "scan_tag" && (
        <ScanInput onScan={handleTagScan} label="Scan asset tag" />
      )}

      {/* Asset info card */}
      {state.asset && state.step !== "scan_tag" && (
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono font-semibold text-body-strong">{state.asset.asset_tag}</span>
            <StatusBadge state={state.asset.state} />
          </div>
          <dl className="grid grid-cols-2 gap-2 text-caption">
            <dt className="text-muted">Serial</dt>
            <dd>{state.asset.serial}</dd>
            <dt className="text-muted">Model</dt>
            <dd>{state.asset.model}</dd>
            <dt className="text-muted">Location</dt>
            <dd><LocationDisplay location={state.asset.location} /></dd>
            <dt className="text-muted">Custodian</dt>
            <dd>{state.asset.custodian}</dd>
          </dl>
        </div>
      )}

      {/* Step 2: Scan location */}
      {state.step === "scan_location" && (
        <ScanInput
          onScan={handleLocationScan}
          label="Scan storage location"
          placeholder="Scan or type location (e.g. Lab-Building-A/Storage-1//SHELF-3/)"
        />
      )}

      {/* Submitting */}
      {state.step === "submitting" && (
        <div className="card flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-muted">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Storing {state.asset?.asset_tag}...
          </div>
        </div>
      )}

      {/* Error */}
      {state.step === "error" && state.error && (
        <Alert variant="error" title={state.error.title} onDismiss={() => dispatch({ type: "RESET" })}>
          {state.error.detail}
        </Alert>
      )}

      {/* Success */}
      {state.step === "success" && state.result && (
        <div className="space-y-4">
          <Alert variant="success" title="Asset stored">
            <strong>{state.result.asset_tag}</strong> is now in storage.
          </Alert>
          {state.result.sync_warnings && state.result.sync_warnings.length > 0 && (
            <Alert variant="warning" title="Sync warning">
              {state.result.sync_warnings.join(". ")}. Run reconciliation to verify.
            </Alert>
          )}
          <Button onClick={() => dispatch({ type: "RESET" })}>Scan Another</Button>
        </div>
      )}
    </div>
  );
}
