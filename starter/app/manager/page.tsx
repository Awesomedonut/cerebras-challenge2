"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import type { Asset, AssetState } from "@/lib/types";

const STATE_LABELS: Record<AssetState, string> = {
  in_service: "In Service",
  stored: "Stored",
  received: "Received",
  rma_pending: "RMA",
  disposed: "Disposed",
  unreceived: "Unreceived",
};

const STATES: AssetState[] = [
  "in_service",
  "stored",
  "received",
  "rma_pending",
  "disposed",
  "unreceived",
];

const PAGE_SIZE = 25;

type SortKey = "asset_tag" | "state" | "updated_at";
type SortDir = "asc" | "desc";

export default function ManagerListPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [stateFilter, setStateFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [custodianFilter, setCustodianFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    api.assets
      .list()
      .then(setAssets)
      .catch(() => setError("Failed to load assets. Is the API running?"))
      .finally(() => setLoading(false));
  }, []);

  // Extract unique sites for dropdown
  const sites = useMemo(
    () => [...new Set(assets.map((a) => a.location.site))].sort(),
    [assets],
  );

  // State counts for summary bar
  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assets) counts[a.state] = (counts[a.state] || 0) + 1;
    return counts;
  }, [assets]);

  // Filter
  const filtered = useMemo(() => {
    let result = assets;
    if (stateFilter) result = result.filter((a) => a.state === stateFilter);
    if (siteFilter) result = result.filter((a) => a.location.site === siteFilter);
    if (custodianFilter) {
      const q = custodianFilter.toLowerCase();
      result = result.filter((a) => a.custodian.toLowerCase().includes(q));
    }
    return result;
  }, [assets, stateFilter, siteFilter, custodianFilter]);

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "asset_tag") cmp = a.asset_tag.localeCompare(b.asset_tag);
      else if (sortKey === "state") cmp = a.state.localeCompare(b.state);
      else if (sortKey === "updated_at") cmp = a.updated_at.localeCompare(b.updated_at);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => setPage(1), [stateFilter, siteFilter, custodianFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  }

  if (loading) return <FullPageSpinner />;

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-body text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-semibold text-tagline text-headline">
            Assets
          </h1>
          <p className="text-caption text-muted mt-1">
            {assets.length.toLocaleString()} total assets
          </p>
        </div>
        <Link href="/manager/reconcile" className="btn-secondary text-caption px-4 py-2">
          Reconciliation Report
        </Link>
      </div>

      {/* Summary bar -- what a manager needs in 60 seconds */}
      <div className="flex flex-wrap gap-2">
        {STATES.filter((s) => stateCounts[s]).map((s) => (
          <button
            key={s}
            onClick={() => setStateFilter(stateFilter === s ? "" : s)}
            className={`px-3 py-1.5 rounded-pill text-caption border transition-colors ${
              stateFilter === s
                ? "bg-action text-white border-action"
                : "bg-canvas border-border hover:border-action text-headline"
            }`}
          >
            {STATE_LABELS[s]} <span className="font-semibold">{stateCounts[s]}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-fine-print text-muted mb-1">State</span>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="p-2 rounded-card border border-border text-caption bg-canvas focus:border-action focus:outline-none"
          >
            <option value="">All states</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-fine-print text-muted mb-1">Site</span>
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="p-2 rounded-card border border-border text-caption bg-canvas focus:border-action focus:outline-none"
          >
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-fine-print text-muted mb-1">Custodian</span>
          <input
            type="text"
            value={custodianFilter}
            onChange={(e) => setCustodianFilter(e.target.value)}
            placeholder="Search custodian..."
            className="p-2 rounded-card border border-border text-caption bg-canvas focus:border-action focus:outline-none"
          />
        </label>

        {(stateFilter || siteFilter || custodianFilter) && (
          <button
            onClick={() => {
              setStateFilter("");
              setSiteFilter("");
              setCustodianFilter("");
            }}
            className="text-caption text-action hover:underline pb-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No assets match your filters"
          description="Try broadening your search or clearing filters."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card p-0 overflow-hidden hidden md:block">
            <table className="w-full text-caption">
              <thead>
                <tr className="border-b border-border bg-parchment text-left">
                  <th
                    className="p-3 font-semibold cursor-pointer hover:text-action"
                    onClick={() => toggleSort("asset_tag")}
                  >
                    Tag{sortIndicator("asset_tag")}
                  </th>
                  <th className="p-3 font-semibold">Serial</th>
                  <th className="p-3 font-semibold">Model</th>
                  <th
                    className="p-3 font-semibold cursor-pointer hover:text-action"
                    onClick={() => toggleSort("state")}
                  >
                    State{sortIndicator("state")}
                  </th>
                  <th className="p-3 font-semibold">Site</th>
                  <th className="p-3 font-semibold">Custodian</th>
                  <th
                    className="p-3 font-semibold cursor-pointer hover:text-action"
                    onClick={() => toggleSort("updated_at")}
                  >
                    Updated{sortIndicator("updated_at")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((a) => (
                  <tr
                    key={a.asset_tag}
                    className="border-b border-border last:border-0 hover:bg-parchment/50"
                  >
                    <td className="p-3">
                      <Link
                        href={`/manager/assets/${a.asset_tag}`}
                        className="font-mono text-action hover:underline"
                      >
                        {a.asset_tag}
                      </Link>
                    </td>
                    <td className="p-3 font-mono text-muted">{a.serial}</td>
                    <td className="p-3">{a.model}</td>
                    <td className="p-3">
                      <StatusBadge state={a.state} />
                    </td>
                    <td className="p-3">{a.location.site}</td>
                    <td className="p-3">{a.custodian}</td>
                    <td className="p-3 text-muted">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((a) => (
              <Link
                key={a.asset_tag}
                href={`/manager/assets/${a.asset_tag}`}
                className="card block hover:border-action transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-semibold text-action">
                    {a.asset_tag}
                  </span>
                  <StatusBadge state={a.state} />
                </div>
                <p className="text-caption">{a.model}</p>
                <p className="text-fine-print text-muted mt-1">
                  {a.location.site} · {a.custodian}
                </p>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-caption text-muted">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, sorted.length)} of{" "}
              {sorted.length.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-caption px-4 py-2"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-caption px-4 py-2"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
