import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LocationDisplay } from "@/components/ui/LocationDisplay";
import { EventTimeline } from "@/components/EventTimeline";

export default async function ManagerAssetDetailPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<React.ReactElement> {
  const { tag } = await params;

  let asset;
  let events;

  try {
    [asset, events] = await Promise.all([
      api.assets.get(tag),
      api.assets.history(tag),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.code === "unknown_asset") {
      return (
        <div className="space-y-4">
          <div className="card text-center py-12">
            <h1 className="font-display font-semibold text-tagline text-headline">
              Asset not found
            </h1>
            <p className="text-caption text-muted mt-2">
              No asset exists with tag <span className="font-mono">{tag}</span>.
              It may have been removed after a reset.
            </p>
          </div>
          <Link href="/manager" className="btn-secondary inline-block">
            Back to asset list
          </Link>
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-caption text-muted">
        <Link href="/manager" className="text-action hover:underline">
          Assets
        </Link>
        <span className="mx-2">/</span>
        <span className="font-mono">{tag}</span>
      </nav>

      {/* Asset info card */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="font-display font-semibold text-tagline text-headline font-mono">
            {asset.asset_tag}
          </h1>
          <StatusBadge state={asset.state} />
        </div>

        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-body">
          <div>
            <dt className="text-caption text-muted">Serial</dt>
            <dd className="font-mono">{asset.serial}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted">Model</dt>
            <dd>{asset.model}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted">Manufacturer</dt>
            <dd>{asset.manufacturer}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted">Asset class</dt>
            <dd className="capitalize">{asset.asset_class.replace("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted">Location</dt>
            <dd>
              <LocationDisplay location={asset.location} />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted">Custodian</dt>
            <dd>{asset.custodian}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted">Created</dt>
            <dd>
              {new Date(asset.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted">Last updated</dt>
            <dd>
              {new Date(asset.updated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </dd>
          </div>
        </dl>

        {asset.procurement_note && (
          <div className="mt-4 p-3 rounded-card bg-amber-50 border border-amber-200 text-caption">
            <span className="font-semibold text-amber-800">Procurement note: </span>
            <span className="text-amber-700">{asset.procurement_note}</span>
          </div>
        )}
      </div>

      {/* Event history */}
      <div className="card">
        <h2 className="font-display font-semibold text-body-strong text-headline mb-4">
          Event History
        </h2>
        <EventTimeline events={events} />
      </div>
    </div>
  );
}
