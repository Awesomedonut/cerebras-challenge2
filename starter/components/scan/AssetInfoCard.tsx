import { StatusBadge } from "@/components/ui/StatusBadge";
import { LocationDisplay } from "@/components/ui/LocationDisplay";
import type { Asset } from "@/lib/types";

interface AssetInfoCardProps {
  asset: Asset;
  /** Highlight custodian field (used in transfer flow). */
  highlightCustodian?: boolean;
}

export function AssetInfoCard({
  asset,
  highlightCustodian = false,
}: AssetInfoCardProps) {
  const custodianStyle = highlightCustodian
    ? "font-semibold text-headline"
    : "";

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono font-semibold text-body-strong">
          {asset.asset_tag}
        </span>
        <StatusBadge state={asset.state} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-caption">
        <dt className="text-muted">Serial</dt>
        <dd>{asset.serial}</dd>
        <dt className="text-muted">Model</dt>
        <dd>{asset.model}</dd>
        <dt className="text-muted">Location</dt>
        <dd>
          <LocationDisplay location={asset.location} />
        </dd>
        <dt className={`text-muted ${custodianStyle}`}>
          {highlightCustodian ? "Current custodian" : "Custodian"}
        </dt>
        <dd className={custodianStyle}>{asset.custodian}</dd>
      </dl>
    </div>
  );
}
