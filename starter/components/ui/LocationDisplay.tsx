import type { Location } from "@/lib/types";

export function LocationDisplay({
  location,
  className = "",
}: {
  location: Location;
  className?: string;
}) {
  const parts = [
    location.site,
    location.room,
    location.row,
    location.rack,
    location.ru,
  ].filter(Boolean);

  if (parts.length === 0) {
    return <span className={`text-muted ${className}`}>No location</span>;
  }

  return (
    <span className={`text-caption ${className}`}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && (
            <span className="mx-1 text-muted">/</span>
          )}
          <span>{part}</span>
        </span>
      ))}
    </span>
  );
}
