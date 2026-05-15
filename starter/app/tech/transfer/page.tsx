"use client";

import { useReducer } from "react";
import { ScanInput } from "@/components/ScanInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AssetInfoCard } from "@/components/scan/AssetInfoCard";
import { SubmittingState } from "@/components/scan/SubmittingState";
import { ScanSuccess } from "@/components/scan/ScanSuccess";
import { api, ApiError } from "@/lib/api-client";
import { getCurrentUserId } from "@/lib/auth";
import { handleTagLookupError } from "@/lib/scan-errors";
import type { Asset } from "@/lib/types";

// --- State machine ---

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
  | { type: "RETRY_BADGE" }
  | { type: "RETRY_TAG" }
  | { type: "RESET" };

const INITIAL: State = {
  step: "scan_tag", asset: null, result: null,
  previousCustodian: "", error: null,
};
const NON_TRANSFERABLE = new Set(["disposed", "unreceived"]);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ASSET_LOADED":
      return { ...state, step: "scan_badge", asset: action.asset, error: null };
    case "INVALID_STATE":
      return {
        ...state, step: "error", asset: action.asset,
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
    case "RETRY_BADGE":
      return { ...state, step: "scan_badge", error: null };
    case "RETRY_TAG":
      return { ...INITIAL, step: "scan_tag" };
    case "RESET":
      return INITIAL;
  }
}

// --- Page ---

export default function TechTransferPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  async function handleTagScan(value: string) {
    try {
      const asset = await api.assets.get(value);
      dispatch(NON_TRANSFERABLE.has(asset.state)
        ? { type: "INVALID_STATE", asset }
        : { type: "ASSET_LOADED", asset });
    } catch (err) {
      dispatch(handleTagLookupError(err, value));
    }
  }

  async function handleBadgeScan(value: string) {
    if (!state.asset) return;

    if (value === state.asset.custodian) {
      dispatch({ type: "ERROR", title: "Same custodian",
        detail: `${value} is already the custodian of this asset. Scan a different badge.` });
      return;
    }

    dispatch({ type: "SUBMIT" });
    const previousCustodian = state.asset.custodian;

    try {
      const result = await api.scans.transfer({
        asset_tag: state.asset.asset_tag, to_custodian: value,
        user_id: getCurrentUserId(), scan_payload: value,
      });
      dispatch({ type: "SUCCESS", result, previousCustodian });
    } catch (err) {
      if (err instanceof ApiError && err.code === "same_custodian") {
        dispatch({ type: "ERROR", title: "Same custodian",
          detail: "The scanned badge belongs to the current custodian." });
      } else {
        dispatch({ type: "ERROR", title: "Transfer failed",
          detail: err instanceof ApiError ? err.message : "Could not reach the API." });
      }
    }
  }

  // Same-custodian errors let you rescan the badge without re-scanning the tag
  const isBadgeError = state.step === "error" && state.asset &&
    state.error?.title === "Same custodian";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-display font-semibold text-tagline text-headline">Transfer Custody</h1>
        <p className="text-caption text-muted mt-1">
          Scan the asset, then scan the receiving party's badge.
          You ({getCurrentUserId()}) are the outgoing custodian.
        </p>
      </div>

      {state.step === "scan_tag" && (
        <ScanInput onScan={handleTagScan} label="Scan asset tag" />
      )}

      {state.asset && state.step !== "scan_tag" && state.step !== "success" && (
        <AssetInfoCard asset={state.asset} highlightCustodian />
      )}

      {state.step === "scan_badge" && (
        <ScanInput onScan={handleBadgeScan} label="Scan receiving party's badge"
          placeholder="Scan or type badge ID (e.g. tech-mike)" />
      )}

      {state.step === "submitting" && (
        <SubmittingState message="Transferring custody..." />
      )}

      {state.step === "error" && state.error && (
        <div className="space-y-3">
          <Alert variant="error" title={state.error.title}>
            {state.error.detail}
          </Alert>
          <div className="flex gap-3">
            {isBadgeError ? (
              <Button onClick={() => dispatch({ type: "RETRY_BADGE" })}>
                Scan a different badge
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
          <ScanSuccess title="Transferred">
            <strong>{state.result.asset_tag}</strong> custody moved from{" "}
            <strong>{state.previousCustodian}</strong> to{" "}
            <strong>{state.result.custodian}</strong>
          </ScanSuccess>
          <Button onClick={() => dispatch({ type: "RESET" })}>Scan Another</Button>
        </div>
      )}
    </div>
  );
}
