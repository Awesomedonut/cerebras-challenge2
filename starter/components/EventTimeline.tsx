import type { Event } from "@/lib/types";
import { formatLocation } from "@/lib/parse-location";

const EVENT_LABELS: Record<string, string> = {
  receive: "Received",
  store: "Stored",
  deploy: "Deployed",
  rma_open: "RMA Opened",
  rma_receive_back: "RMA Returned",
  dispose: "Disposed",
  duplicate_receive: "Duplicate Receive",
  transfer_custody: "Custody Transfer",
};

const EVENT_COLORS: Record<string, string> = {
  receive: "bg-amber-400",
  store: "bg-blue-400",
  deploy: "bg-emerald-400",
  rma_open: "bg-orange-400",
  rma_receive_back: "bg-amber-400",
  dispose: "bg-gray-400",
  duplicate_receive: "bg-amber-200",
  transfer_custody: "bg-violet-400",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <p className="text-caption text-muted py-8 text-center">
        No events recorded yet.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />

      <ul className="space-y-4">
        {events.map((event) => (
          <li key={event.id} className="relative pl-8">
            {/* Dot */}
            <div
              className={`absolute left-[6px] top-[6px] w-3 h-3 rounded-full border-2 border-canvas ${
                EVENT_COLORS[event.event_type] ?? "bg-gray-300"
              }`}
            />

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-body-strong text-headline">
                  {EVENT_LABELS[event.event_type] ?? event.event_type}
                </span>
                <span className="text-fine-print text-muted">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>

              <div className="mt-1 text-caption text-muted space-y-0.5">
                {event.from_state && event.from_state !== event.to_state && (
                  <p>
                    {event.from_state} &rarr; {event.to_state}
                  </p>
                )}
                {event.to_location && (
                  <p>{formatLocation(event.to_location)}</p>
                )}
                <p>by {event.user_id}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
