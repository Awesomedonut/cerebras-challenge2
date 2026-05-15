"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

type DriftItem = Record<string, unknown>;

type Report = {
  generated_at: string;
  summary: Record<string, number>;
  action_required: Record<string, DriftItem[]>;
  needs_review: Record<string, DriftItem[]>;
  expected: {
    not_in_facilities_by_scope: { count: number; description: string };
  };
};

const CATEGORY_META: Record<
  string,
  { label: string; description: string; action: string; color: string }
> = {
  location_drift: {
    label: "Location Mismatch",
    description: "Operations and facilities disagree on where this asset is racked.",
    action: "Send a tech to verify the physical location and update whichever system is wrong.",
    color: "bg-red-50 border-red-200 text-red-800",
  },
  disposed_but_capitalized: {
    label: "Disposed but Still Capitalized",
    description: "Operations marked this disposed, but finance still shows it capitalized.",
    action: "Contact finance to retire this asset and remove it from the books.",
    color: "bg-red-50 border-red-200 text-red-800",
  },
  ghost_in_facilities: {
    label: "Unknown to Operations",
    description: "Facilities has a record for this tag, but operations has no matching asset.",
    action: "Check if this asset was received outside the system. If not, remove the facilities record.",
    color: "bg-red-50 border-red-200 text-red-800",
  },
  finance_orphan: {
    label: "Unknown to Operations (Finance)",
    description: "Finance has a record for this tag, but operations has no matching asset.",
    action: "Verify the purchase order. The asset may not have been received yet, or the tag may be wrong.",
    color: "bg-red-50 border-red-200 text-red-800",
  },
  stale_facilities: {
    label: "Stale Facilities Record",
    description: "This asset is no longer in service, but facilities still shows it racked.",
    action: "Update facilities to reflect the current state. This may be a timing lag or a missed de-rack.",
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  missing_from_finance: {
    label: "Missing from Finance",
    description: "This asset exists in operations but has no finance record.",
    action: "Check if a purchase order exists. May need to be added to the finance system.",
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  stale_observation: {
    label: "Stale Observation",
    description: "Facilities record exists but hasn't been observed in over 90 days.",
    action: "Schedule a physical audit of this rack position to confirm the asset is still there.",
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
};

function CategorySection({
  categoryKey,
  items,
}: {
  categoryKey: string;
  items: DriftItem[];
}) {
  const [expanded, setExpanded] = useState(true);
  const meta = CATEGORY_META[categoryKey];
  if (!meta || items.length === 0) return null;

  const tag = (item: DriftItem) =>
    (item.asset_tag as string) || (item.tagged_id as string) || (item.tag as string) || "unknown";

  return (
    <div className={`rounded-card border p-4 ${meta.color}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between min-h-[44px]"
      >
        <div className="text-left">
          <h3 className="font-semibold text-body-strong">
            {meta.label}
            <span className="ml-2 font-normal text-caption">({items.length})</span>
          </h3>
          <p className="text-caption opacity-80 mt-0.5">{meta.description}</p>
          <p className="text-caption font-medium mt-0.5">Next step: {meta.action}</p>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="bg-white/60 rounded-card p-3 text-caption flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <Link
                  href={`/manager/assets/${tag(item)}`}
                  className="font-mono font-semibold text-action hover:underline"
                >
                  {tag(item)}
                </Link>
                <div className="text-muted mt-0.5 space-x-3">
                  {Object.entries(item)
                    .filter(
                      ([k]) =>
                        k !== "asset_tag" &&
                        k !== "tagged_id" &&
                        k !== "tag" &&
                        k !== "space_id" &&
                        k !== "finance_id",
                    )
                    .map(([k, v]) => (
                      <span key={k}>
                        {k.replace(/_/g, " ")}: <strong>{String(v)}</strong>
                      </span>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ManagerReconcilePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reconcile")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setReport)
      .catch(() => setError("Failed to load reconciliation data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageSpinner />;
  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-body text-red-600">{error}</p>
      </div>
    );
  }
  if (!report) return null;

  const actionCount = Object.values(report.action_required).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const reviewCount = Object.values(report.needs_review).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const expectedCount = report.expected.not_in_facilities_by_scope.count;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <nav className="text-caption text-muted mb-2">
          <Link href="/manager" className="text-action hover:underline">
            Assets
          </Link>
          <span className="mx-2">/</span>
          <span>Reconciliation</span>
        </nav>
        <h1 className="font-display font-semibold text-tagline text-headline">
          Three-Way Reconciliation
        </h1>
        <p className="text-caption text-muted mt-1">
          Comparing operations, facilities, and finance as of{" "}
          {new Date(report.generated_at).toLocaleString()}.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card border-red-200 bg-red-50">
          <p className="text-fine-print text-red-600 font-semibold uppercase tracking-wide">
            Action Required
          </p>
          <p className="text-display-md font-display font-semibold text-red-800 mt-1">
            {actionCount}
          </p>
        </div>
        <div className="card border-amber-200 bg-amber-50">
          <p className="text-fine-print text-amber-600 font-semibold uppercase tracking-wide">
            Needs Review
          </p>
          <p className="text-display-md font-display font-semibold text-amber-800 mt-1">
            {reviewCount}
          </p>
        </div>
        <div className="card border-emerald-200 bg-emerald-50">
          <p className="text-fine-print text-emerald-600 font-semibold uppercase tracking-wide">
            Expected
          </p>
          <p className="text-display-md font-display font-semibold text-emerald-800 mt-1">
            {expectedCount}
          </p>
          <p className="text-fine-print text-emerald-600 mt-1">
            {report.expected.not_in_facilities_by_scope.description}
          </p>
        </div>
      </div>

      {/* Action Required */}
      {actionCount > 0 && (
        <section>
          <h2 className="font-display font-semibold text-body-strong text-headline mb-3">
            Action Required
          </h2>
          <div className="space-y-4">
            {Object.entries(report.action_required).map(([key, items]) => (
              <CategorySection key={key} categoryKey={key} items={items} />
            ))}
          </div>
        </section>
      )}

      {/* Needs Review */}
      {reviewCount > 0 && (
        <section>
          <h2 className="font-display font-semibold text-body-strong text-headline mb-3">
            Needs Review
          </h2>
          <div className="space-y-4">
            {Object.entries(report.needs_review).map(([key, items]) => (
              <CategorySection key={key} categoryKey={key} items={items} />
            ))}
          </div>
        </section>
      )}

      {/* All clear state */}
      {actionCount === 0 && reviewCount === 0 && (
        <EmptyState
          title="All clear"
          description="No mismatches found across operations, facilities, and finance."
        />
      )}
    </div>
  );
}
