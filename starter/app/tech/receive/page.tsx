"use client";

import { useReducer } from "react";
import { ScanInput } from "@/components/ScanInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, ApiError } from "@/lib/api-client";
import { getCurrentUserId } from "@/lib/auth";
import { parseLocation } from "@/lib/parse-location";
import type { Asset, AssetClass } from "@/lib/types";

type Step = "scan_tag" | "fill_details" | "submitting" | "success" | "error";

type State = {
  step: Step;
  tag: string;
  asset: Asset | null;
  error: { title: string; detail: string } | null;
  isDuplicate: boolean;
};

type Action =
  | { type: "SCAN_TAG"; tag: string }
  | { type: "SUBMIT" }
  | { type: "SUCCESS"; asset: Asset; isDuplicate: boolean }
  | { type: "ERROR"; title: string; detail: string }
  | { type: "RESET" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SCAN_TAG":
      return { ...state, step: "fill_details", tag: action.tag, error: null };
    case "SUBMIT":
      return { ...state, step: "submitting" };
    case "SUCCESS":
      return { ...state, step: "success", asset: action.asset, isDuplicate: action.isDuplicate, error: null };
    case "ERROR":
      return { ...state, step: "error", error: { title: action.title, detail: action.detail } };
    case "RESET":
      return initialState;
  }
}

const initialState: State = {
  step: "scan_tag",
  tag: "",
  asset: null,
  error: null,
  isDuplicate: false,
};

const TAG_REGEX = /^C\d{7}$/;

export default function TechReceivePage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  function handleTagScan(value: string) {
    if (!TAG_REGEX.test(value)) {
      dispatch({
        type: "ERROR",
        title: "Invalid tag format",
        detail: `"${value}" doesn't match the expected format. Tags must start with C followed by 7 digits (e.g. C0009001).`,
      });
      return;
    }
    dispatch({ type: "SCAN_TAG", tag: value });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    dispatch({ type: "SUBMIT" });

    const form = new FormData(e.currentTarget);
    const locationStr = form.get("location") as string;
    const location = parseLocation(locationStr || "");

    if (!location.site) {
      dispatch({
        type: "ERROR",
        title: "Location required",
        detail: "At minimum, a site is needed. Scan a location barcode or type one (e.g. Lab-Building-A/Receiving//DOCK-2/).",
      });
      return;
    }

    try {
      const asset = await api.scans.receive({
        asset_tag: state.tag,
        serial: form.get("serial") as string,
        model: form.get("model") as string,
        manufacturer: form.get("manufacturer") as string,
        asset_class: form.get("asset_class") as AssetClass,
        location,
        user_id: getCurrentUserId(),
        scan_payload: state.tag,
      });

      // 200 = duplicate receive (same tag + serial), 201 = new asset
      // The api client doesn't expose the status code directly, but
      // duplicate receives return an asset whose created_at != updated_at
      // Actually, we check: if the asset already had events, it's a duplicate.
      // Simpler: just check if created_at is old (before our request).
      const isDuplicate = new Date(asset.created_at).getTime() < Date.now() - 5000;
      dispatch({ type: "SUCCESS", asset, isDuplicate });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "and_match_failed") {
          const details = err.details as { expected_serial?: string; provided_serial?: string } | undefined;
          dispatch({
            type: "ERROR",
            title: "Serial mismatch",
            detail: `Tag ${state.tag} already exists with serial ${details?.expected_serial ?? "unknown"}, but you scanned serial ${details?.provided_serial ?? "unknown"}. Check the label and try a different tag.`,
          });
        } else if (err.code === "invalid_tag_format") {
          dispatch({
            type: "ERROR",
            title: "Invalid tag format",
            detail: "Tag must start with C followed by 7 digits.",
          });
        } else {
          dispatch({ type: "ERROR", title: "Receive failed", detail: err.message });
        }
      } else {
        dispatch({ type: "ERROR", title: "Unexpected error", detail: "Could not reach the API. Check your connection and try again." });
      }
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-display font-semibold text-tagline text-headline">
          Receive Asset
        </h1>
        <p className="text-caption text-muted mt-1">
          Scan the asset tag, then fill in its details.
        </p>
      </div>

      {/* Step 1: Scan tag */}
      {(state.step === "scan_tag" || state.step === "error") && !state.tag && (
        <ScanInput
          onScan={handleTagScan}
          label="Scan asset tag"
          placeholder="Scan or type tag (e.g. C0009001)"
        />
      )}

      {/* Error alert */}
      {state.step === "error" && state.error && (
        <Alert
          variant="error"
          title={state.error.title}
          onDismiss={() => dispatch({ type: "RESET" })}
        >
          {state.error.detail}
        </Alert>
      )}

      {/* Step 2: Fill details form */}
      {state.step === "fill_details" && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <span className="font-mono text-body-strong font-semibold text-headline">
              {state.tag}
            </span>
          </div>

          <div className="grid gap-4">
            <label className="block">
              <span className="block text-caption-strong font-semibold text-headline mb-1">Serial</span>
              <input
                name="serial"
                required
                autoFocus
                autoComplete="off"
                className="w-full p-3 rounded-card border border-border text-body focus:border-action focus:outline-none"
                placeholder="SN-DEMO-1"
              />
            </label>

            <label className="block">
              <span className="block text-caption-strong font-semibold text-headline mb-1">Model</span>
              <input
                name="model"
                required
                autoComplete="off"
                className="w-full p-3 rounded-card border border-border text-body focus:border-action focus:outline-none"
                placeholder="Genomics Sequencer 2000"
              />
            </label>

            <label className="block">
              <span className="block text-caption-strong font-semibold text-headline mb-1">Manufacturer</span>
              <input
                name="manufacturer"
                required
                autoComplete="off"
                className="w-full p-3 rounded-card border border-border text-body focus:border-action focus:outline-none"
                placeholder="BioSystems Inc"
              />
            </label>

            <label className="block">
              <span className="block text-caption-strong font-semibold text-headline mb-1">Asset Class</span>
              <select
                name="asset_class"
                required
                className="w-full p-3 rounded-card border border-border text-body focus:border-action focus:outline-none bg-canvas"
              >
                <option value="instrument">Instrument</option>
                <option value="compute">Compute</option>
                <option value="network">Network</option>
                <option value="power">Power</option>
                <option value="consumable_durable">Consumable/Durable</option>
              </select>
            </label>

            <div>
              <span className="block text-caption-strong font-semibold text-headline mb-1">Location</span>
              <ScanInput
                onScan={(v) => {
                  const input = document.querySelector<HTMLInputElement>('input[name="location"]');
                  if (input) input.value = v;
                }}
                label=""
                placeholder="Scan location barcode or type (e.g. Lab-Building-A/Receiving//DOCK-2/)"
                autoFocus={false}
              />
              <input
                name="location"
                required
                className="w-full p-3 rounded-card border border-border text-body focus:border-action focus:outline-none mt-2"
                placeholder="Lab-Building-A/Receiving//DOCK-2/"
                defaultValue=""
              />
              <p className="text-fine-print text-muted mt-1">
                Format: site/room/row/rack/ru -- leave segments empty for nulls
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit">Receive Asset</Button>
            <Button variant="ghost" type="button" onClick={() => dispatch({ type: "RESET" })}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Step 3: Submitting */}
      {state.step === "submitting" && (
        <div className="card flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Receiving {state.tag}...
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {state.step === "success" && state.asset && (
        <div className="space-y-4">
          <Alert variant={state.isDuplicate ? "info" : "success"} title={state.isDuplicate ? "Already received" : "Asset received"}>
            {state.isDuplicate ? (
              <span>
                <strong>{state.asset.asset_tag}</strong> was already in the system with matching serial. Duplicate scan logged.
              </span>
            ) : (
              <span>
                <strong>{state.asset.asset_tag}</strong> is now in the system.
              </span>
            )}
          </Alert>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono font-semibold">{state.asset.asset_tag}</span>
              <StatusBadge state={state.asset.state} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-caption">
              <dt className="text-muted">Serial</dt>
              <dd>{state.asset.serial}</dd>
              <dt className="text-muted">Model</dt>
              <dd>{state.asset.model}</dd>
              <dt className="text-muted">Custodian</dt>
              <dd>{state.asset.custodian}</dd>
            </dl>
          </div>

          <Button onClick={() => dispatch({ type: "RESET" })}>Scan Another</Button>
        </div>
      )}
    </div>
  );
}
