"use client";

import { useReducer, useRef } from "react";
import { ScanInput } from "@/components/ScanInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmittingState } from "@/components/scan/SubmittingState";
import { ScanSuccess } from "@/components/scan/ScanSuccess";
import { api, ApiError } from "@/lib/api-client";
import { getCurrentUserId } from "@/lib/auth";
import { parseLocation } from "@/lib/parse-location";
import type { Asset, AssetClass } from "@/lib/types";

// --- State machine ---

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

const INITIAL: State = {
  step: "scan_tag", tag: "", asset: null, error: null, isDuplicate: false,
};
const TAG_REGEX = /^C\d{7}$/;

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
      return INITIAL;
  }
}

// --- Error classification ---

function classifyReceiveError(err: unknown, tag: string): { title: string; detail: string } {
  if (!(err instanceof ApiError)) {
    return { title: "Unexpected error", detail: "Could not reach the API. Check your connection and try again." };
  }
  if (err.code === "and_match_failed") {
    const details = err.details as { expected_serial?: string; provided_serial?: string } | undefined;
    return {
      title: "Serial mismatch",
      detail: `Tag ${tag} already exists with serial ${details?.expected_serial ?? "unknown"}, but you scanned serial ${details?.provided_serial ?? "unknown"}. Check the label and try a different tag.`,
    };
  }
  if (err.code === "invalid_tag_format") {
    return { title: "Invalid tag format", detail: "Tag must start with C followed by 7 digits." };
  }
  return { title: "Receive failed", detail: err.message };
}

// --- Page ---

export default function TechReceivePage() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  function handleTagScan(value: string) {
    if (!TAG_REGEX.test(value)) {
      dispatch({
        type: "ERROR", title: "Invalid tag format",
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
    const location = parseLocation((form.get("location") as string) || "");

    if (!location.site) {
      dispatch({
        type: "ERROR", title: "Location required",
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
      // The API returns 201 for new, 200 for duplicate, but the api-client
      // doesn't expose the status code. We compare created_at to updated_at:
      // if they differ, the asset existed before this request.
      const isDuplicate = asset.created_at !== asset.updated_at;
      dispatch({ type: "SUCCESS", asset, isDuplicate });
    } catch (err) {
      dispatch({ type: "ERROR", ...classifyReceiveError(err, state.tag) });
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-display font-semibold text-tagline text-headline">Receive Asset</h1>
        <p className="text-caption text-muted mt-1">Scan the asset tag, then fill in its details.</p>
      </div>

      {/* Step 1: Scan tag */}
      {(state.step === "scan_tag" || state.step === "error") && !state.tag && (
        <ScanInput onScan={handleTagScan} label="Scan asset tag"
          placeholder="Scan or type tag (e.g. C0009001)" />
      )}

      {/* Error */}
      {state.step === "error" && state.error && (
        <div className="space-y-3">
          <Alert variant="error" title={state.error.title}>
            {state.error.detail}
          </Alert>
          <Button onClick={() => dispatch({ type: "RESET" })}>Start over</Button>
        </div>
      )}

      {/* Step 2: Details form */}
      {state.step === "fill_details" && (
        <ReceiveForm tag={state.tag} onSubmit={handleSubmit} onCancel={() => dispatch({ type: "RESET" })} />
      )}

      {/* Step 3: Submitting */}
      {state.step === "submitting" && (
        <SubmittingState message={`Receiving ${state.tag}...`} />
      )}

      {/* Step 4: Success */}
      {state.step === "success" && state.asset && (
        <ReceiveSuccess asset={state.asset} isDuplicate={state.isDuplicate}
          onReset={() => dispatch({ type: "RESET" })} />
      )}
    </div>
  );
}

// --- Sub-components (single responsibility) ---

function ReceiveForm({ tag, onSubmit, onCancel }: {
  tag: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const locationRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <span className="font-mono text-body-strong font-semibold text-headline">{tag}</span>
      </div>

      <div className="grid gap-4">
        <FormInput label="Serial" name="serial" placeholder="SN-DEMO-1" autoFocus />
        <FormInput label="Model" name="model" placeholder="Genomics Sequencer 2000" />
        <FormInput label="Manufacturer" name="manufacturer" placeholder="BioSystems Inc" />

        <label className="block">
          <span className="block text-caption-strong font-semibold text-headline mb-1">Asset Class</span>
          <select name="asset_class" required
            className="w-full p-3 rounded-card border border-border text-body focus:border-action focus:outline-none bg-canvas">
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
              if (locationRef.current) locationRef.current.value = v;
            }}
            label="" placeholder="Scan location barcode or type (e.g. Lab-Building-A/Receiving//DOCK-2/)"
            autoFocus={false}
          />
          <input ref={locationRef} name="location" required
            className="peer w-full p-3 rounded-card border border-border text-body focus:border-action focus:outline-none mt-2
              invalid:[&:not(:placeholder-shown)]:border-red-400"
            placeholder="Lab-Building-A/Receiving//DOCK-2/" />
          <span className="hidden peer-[&:not(:placeholder-shown)]:peer-invalid:block text-fine-print text-red-500 mt-1">
            Location is required
          </span>
          <p className="text-fine-print text-muted mt-1">
            Format: site/room/row/rack/ru -- leave segments empty for nulls
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit">Receive Asset</Button>
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function FormInput({ label, name, placeholder, autoFocus }: {
  label: string; name: string; placeholder: string; autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-caption-strong font-semibold text-headline mb-1">{label}</span>
      <input name={name} required autoFocus={autoFocus} autoComplete="off"
        className="peer w-full p-3 rounded-card border border-border text-body focus:border-action focus:outline-none
          invalid:[&:not(:placeholder-shown)]:border-red-400"
        placeholder={placeholder} />
      <span className="hidden peer-[&:not(:placeholder-shown)]:peer-invalid:block text-fine-print text-red-500 mt-1">
        {label} is required
      </span>
    </label>
  );
}

function ReceiveSuccess({ asset, isDuplicate, onReset }: {
  asset: Asset; isDuplicate: boolean; onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      {isDuplicate ? (
        <Alert variant="info" title="Already received">
          <strong>{asset.asset_tag}</strong> was already in the system with matching serial. Duplicate scan logged.
        </Alert>
      ) : (
        <ScanSuccess title="Received">
          <strong>{asset.asset_tag}</strong> ({asset.serial}) is now in the system
        </ScanSuccess>
      )}

      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-mono font-semibold">{asset.asset_tag}</span>
          <StatusBadge state={asset.state} />
        </div>
        <dl className="grid grid-cols-2 gap-2 text-caption">
          <dt className="text-muted">Serial</dt><dd>{asset.serial}</dd>
          <dt className="text-muted">Model</dt><dd>{asset.model}</dd>
          <dt className="text-muted">Custodian</dt><dd>{asset.custodian}</dd>
        </dl>
      </div>

      <Button onClick={onReset}>Scan Another</Button>
    </div>
  );
}
