"use client";

import { useReducer } from "react";
import { ScanInput } from "@/components/ScanInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LocationDisplay } from "@/components/ui/LocationDisplay";
import { api, ApiError } from "@/lib/api-client";
import { getCurrentUserId } from "@/lib/auth";
import type { Asset } from "@/lib/types";

type Step = "scan_tag" | "scan_badge" | "submitting" | "success" | "error";

type State = {
  step: Step;
  asset: Asset | null;
  result: Asset | null;
  previousCustodian: string;
  error: { title: string; detail: string } | null;
};

type Action =
  | { type: "ASSET_LOADED"; asset: Asset }
  | { type: "INVALID_STATE"; asset: Asset }
  | { type: "SUBMIT" }
  | { type: "SUCCESS"; result: Asset; previousCustodian: string }
  | { type: "ERROR"; title: string; detail: string }
  | { type: "RESET" };

const initialState: State = {
  step: "scan_tag",
  asset: null,
  result: null,
  previousCustodian: "",
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ASSET_LOADED":
      return { ...state, step: "scan_badge", asset: action.asset, error: null };
    case "INVALID_STATE":
      return {
        ...state,
        step: "error",
        asset: action.asset,
        error: {
          title: "Cannot transfer this asset",
          detail: `${action.asset.asset_tag} is currently ${action.asset.state}. Disposed and unreceived assets cannot be transferred.`,
        },
      };
    case "SUBMIT":
      return { ...state, step: "submitting" };
    case "SUCCESS":
      return { ...state, step: "success", result: action.result, previousCustodian: action.previousCustodian, error: null };
    case "ERROR":
      return { ...state, step: "error", error: { title: action.title, detail: action.detail } };
    case "RESET":
      return initialState;
  }
}

const NON_TRANSFERABLE = new Set(["disposed", "unreceived"]);

export default function TechTransferPage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  async function handleTagScan(value: string) {
    try {
      const asset = await api.assets.get(value);
      if (NON_TRANSFERABLE.has(asset.state)) {
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

  async function handleBadgeScan(value: string) {
    if (!state.asset) return;

    // Client-side guard: same custodian
    if (value === state.asset.custodian) {
      dispatch({
        type: "ERROR",
        title: "Same custodian",
        detail: `${value} is already the custodian of this asset. Scan a different badge.`,
      });
      return;
    }

    dispatch({ type: "SUBMIT" });

    const previousCustodian = state.asset.custodian;

    try {
      const result = await api.scans.transfer({
        asset_tag: state.asset.asset_tag,
        to_custodian: value,
        user_id: getCurrentUserId(),
        scan_payload: value,
      });
      dispatch({ type: "SUCCESS", result, previousCustodian });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "same_custodian") {
          dispatch({ type: "ERROR", title: "Same custodian", detail: "The scanned badge belongs to the current custodian." });
        } else {
          dispatch({ type: "ERROR", title: "Transfer failed", detail: err.message });
        }
      } else {
        dispatch({ type: "ERROR", title: "Unexpected error", detail: "Could not reach the API." });
      }
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-display font-semibold text-tagline text-headline">
          Transfer Custody
        </h1>
        <p className="text-caption text-muted mt-1">
          Scan the asset, then scan the receiving party's badge.
          You ({getCurrentUserId()}) are the outgoing custodian.
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
            <dt className="text-muted font-semibold text-headline">Current custodian</dt>
            <dd className="font-semibold text-headline">{state.asset.custodian}</dd>
          </dl>
        </div>
      )}

      {/* Step 2: Scan badge */}
      {state.step === "scan_badge" && (
        <ScanInput
          onScan={handleBadgeScan}
          label="Scan receiving party's badge"
          placeholder="Scan or type badge ID (e.g. tech-mike)"
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
            Transferring custody...
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
          <Alert variant="success" title="Custody transferred">
            <strong>{state.result.asset_tag}</strong> transferred from{" "}
            <strong>{state.previousCustodian}</strong> to{" "}
            <strong>{state.result.custodian}</strong>. State unchanged ({state.result.state}).
          </Alert>
          <Button onClick={() => dispatch({ type: "RESET" })}>Scan Another</Button>
        </div>
      )}
    </div>
  );
}
