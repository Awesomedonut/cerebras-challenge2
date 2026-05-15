import type { Location } from "./types";

/**
 * Parse a slash-separated location string into a Location object.
 * Format: "site/room/row/rack/ru" — empty segments become null.
 * Examples:
 *   "Lab-Building-A/Bay-12/Aisle-3/B-04/P-02" -> full location
 *   "Lab-Building-A/Storage-1//SHELF-3/"       -> storage (row=null, ru=null)
 */
export function parseLocation(scanned: string): Location {
  const parts = scanned.split("/");
  return {
    site: parts[0] || "",
    room: parts[1] || null,
    row: parts[2] || null,
    rack: parts[3] || null,
    ru: parts[4] || null,
  };
}

/** Human-readable location with " / " separators, skipping null segments. */
export function formatLocation(loc: Location): string {
  return [loc.site, loc.room, loc.row, loc.rack, loc.ru]
    .filter(Boolean)
    .join(" / ");
}

/** Slash-joined string matching facilities rack_location format. */
export function toRackLocationString(loc: Location): string {
  return [loc.site, loc.room, loc.row, loc.rack, loc.ru]
    .filter(Boolean)
    .join("/");
}

/** Check if a location has all fields required for deploy. */
export function isDeployComplete(loc: Location): boolean {
  return Boolean(loc.site && loc.room && loc.rack && loc.ru);
}
