/** "19 Sep" style, UTC, for compact display next to a headline. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Friday, 19 September 2026" style, UTC, for day group headings. */
export function formatDayHeading(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The UTC calendar day (YYYY-MM-DD) an ISO timestamp falls on. */
export function toUtcDay(iso: string): string {
  return iso.slice(0, 10);
}

/** "09:55 UTC" style, for a headline's time within a day group. */
export function formatUtcTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}
