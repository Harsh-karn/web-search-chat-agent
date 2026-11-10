import * as chrono from "chrono-node";
export interface DateRange {
  startIso: string;
  endIso: string;
  label: string;
}
export interface TemporalResolution {
  hasTemporalReference: boolean;
  rawText?: string;
  range?: DateRange;
  sinceIso?: string;
  isSinceQuery: boolean;
  assumedTimezone: string;
}
export function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}
function offset(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return (
    (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) -
      Math.floor(+date / 1000) * 1000) /
    60000
  );
}
function midnight(y: number, m: number, d: number, tz: string) {
  const wall = Date.UTC(y, m - 1, d);
  let instant = wall;
  for (let i = 0; i < 4; i++)
    instant = wall - offset(new Date(instant), tz) * 60000;
  return instant;
}
export function resolveTemporal(
  text: string,
  options?: { referenceDate?: Date; timezone?: string },
): TemporalResolution {
  const ref = options?.referenceDate || new Date();
  const tz = options?.timezone || process.env.DEFAULT_TIMEZONE || "UTC";
  if (!validTimezone(tz)) throw new Error("Invalid timezone");
  const base = {
    hasTemporalReference: false,
    isSinceQuery: /\bsince\b|pricing changed/i.test(text),
    assumedTimezone: tz,
  };
  const parsed = chrono.parse(
    text,
    { instant: ref, timezone: offset(ref, tz) },
    { forwardDate: false },
  );
  if (!parsed.length) return base;
  const first = parsed[0];
  const end = first.end || first.start;
  const y = first.start.get("year")!,
    m = first.start.get("month")!,
    d = first.start.get("day")!;
  const start = midnight(y, m, d, tz);
  const finish =
    midnight(end.get("year")!, end.get("month")!, end.get("day")! + 1, tz) - 1;
  const label = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return {
    ...base,
    hasTemporalReference: true,
    rawText: first.text,
    range: {
      startIso: new Date(start).toISOString(),
      endIso: new Date(finish).toISOString(),
      label,
    },
    sinceIso: new Date(start).toISOString(),
  };
}
