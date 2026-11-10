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

/**
 * Resolves temporal references (e.g., "Monday", "last Tuesday", "3 November")
 * deterministically against a reference date and client timezone.
 */
export function resolveTemporal(
  text: string,
  options?: {
    referenceDate?: Date;
    timezone?: string;
  }
): TemporalResolution {
  const refDate = options?.referenceDate || new Date();
  const tz = options?.timezone || process.env.DEFAULT_TIMEZONE || "UTC";

  // Check if query is looking for changes "since" a date or event
  const sinceRegex = /\b(since|changed\s+since|updated\s+since|pricing\s+changed|any\s+of\s+them\s+changed)\b/i;
  const isSinceQuery = sinceRegex.test(text);

  // Chrono parse with backward preference (forwardDate: false) because recall queries refer to past events
  const parsed = chrono.parse(text, refDate, { forwardDate: false });

  if (!parsed || parsed.length === 0) {
    return {
      hasTemporalReference: false,
      isSinceQuery,
      assumedTimezone: tz,
    };
  }

  // Use the most salient parsed temporal token (first match)
  const first = parsed[0];
  const startDate = first.start.date();
  const rawText = first.text;

  // Compute full-day boundary for the resolved date in UTC / local representation
  // For queries like "on Monday" or "3 November", we want [YYYY-MM-DD 00:00:00, YYYY-MM-DD 23:59:59.999]
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, "0");
  const day = String(startDate.getDate()).padStart(2, "0");

  const dayStart = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const dayEnd = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

  const range: DateRange = {
    startIso: dayStart.toISOString(),
    endIso: dayEnd.toISOString(),
    label: `${year}-${month}-${day}`,
  };

  // If this is a "since X" query, sinceIso is the start of that day or turn
  const sinceIso = dayStart.toISOString();

  return {
    hasTemporalReference: true,
    rawText,
    range,
    sinceIso,
    isSinceQuery,
    assumedTimezone: tz,
  };
}

