import type { AssetState } from "@/lib/types";

const STATE_STYLES: Record<AssetState, { bg: string; text: string; label: string }> = {
  in_service: { bg: "bg-emerald-50", text: "text-emerald-700", label: "In Service" },
  stored: { bg: "bg-blue-50", text: "text-blue-700", label: "Stored" },
  received: { bg: "bg-amber-50", text: "text-amber-700", label: "Received" },
  rma_pending: { bg: "bg-orange-50", text: "text-orange-700", label: "RMA Pending" },
  disposed: { bg: "bg-gray-100", text: "text-gray-600", label: "Disposed" },
  unreceived: { bg: "bg-gray-50", text: "text-gray-500", label: "Unreceived" },
};

export function StatusBadge({ state }: { state: AssetState }) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.unreceived;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-pill text-caption-strong font-semibold ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
