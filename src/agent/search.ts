import { z } from "zod";
import { SearchResponse, SearchResultItem } from "./types";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
  );
export const searchSchema = z.object({
  query: z.string().trim().min(1).max(500),
  since: date.optional(),
  recency: z.enum(["day", "week", "month", "year"]).optional(),
  maxResults: z.number().int().min(1).max(8).default(5),
});
const responseSchema = z.object({
  results: z
    .array(
      z.object({
        title: z.string().default("Untitled"),
        url: z.string(),
        content: z.string(),
        published_date: z.string().nullish(),
        score: z.number().optional(),
      }),
    )
    .max(100),
});
export function canonicalUrl(value: string): string | undefined {
  try {
    const u = new URL(value);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
      return;
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/.test(key)) u.searchParams.delete(key);
    return u.href;
  } catch {
    return;
  }
}
export function createSearchService(
  deps: {
    fetch?: typeof fetch;
    now?: () => number;
    apiKey?: () => string | undefined;
  } = {},
) {
  const request = deps.fetch || fetch,
    now = deps.now || Date.now;
  const cache = new Map<string, { expires: number; data: SearchResponse }>();
  const pending = new Map<string, Promise<SearchResponse>>();
  let active = 0;
  const queue: Array<() => void> = [];
  async function limited<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= 3) await new Promise<void>((r) => queue.push(r));
    else active++;
    try {
      return await fn();
    } finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  }
  return async (
    input: z.input<typeof searchSchema>,
    signal?: AbortSignal,
  ): Promise<SearchResponse> => {
    const p = searchSchema.parse(input);
    const key = JSON.stringify({
      ...p,
      query: p.query.toLowerCase().replace(/\s+/g, " "),
    });
    for (const [k, v] of cache) if (v.expires <= now()) cache.delete(k);
    const hit = cache.get(key);
    if (hit) return { ...hit.data, cached: true };
    const failure = (error: string): SearchResponse => ({
      query: p.query,
      since: p.since,
      cached: false,
      results: [],
      error,
    });
    if (signal?.aborted) return failure("cancelled");
    if (!pending.has(key)) {
      if (pending.size >= 30) return failure("busy");
      const job = limited(async () => {
        const apiKey = deps.apiKey?.() || process.env.TAVILY_API_KEY;
        if (!apiKey) return failure("unavailable");
        const deadline = AbortSignal.timeout(8000);
        try {
          let res: Response | undefined;
          for (let attempt = 0; attempt < 2; attempt++) {
            res = await request(
              process.env.TAVILY_BASE_URL || "https://api.tavily.com/search",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: deadline,
                body: JSON.stringify({
                  api_key: apiKey,
                  query: p.query,
                  search_depth: "basic",
                  include_answer: false,
                  include_raw_content: false,
                  include_published_date: true,
                  max_results: p.maxResults,
                  ...(p.since
                    ? { start_date: p.since }
                    : p.recency
                      ? { time_range: p.recency }
                      : {}),
                }),
              },
            );
            if (
              res.ok ||
              !(res.status === 429 || res.status >= 500) ||
              attempt === 1
            )
              break;
            const wait = Math.min(
              1000,
              Math.max(200, Number(res.headers.get("retry-after") || 0) * 1000),
            );
            await new Promise((r) => setTimeout(r, wait));
          }
          if (!res?.ok) return failure(`provider_${res?.status || "error"}`);
          const data = responseSchema.parse(await res.json());
          const seen = new Set<string>();
          const ranked = data.results.sort(
            (a, b) => (b.score || 0) - (a.score || 0),
          );
          const results: SearchResultItem[] = [];
          for (const r of ranked) {
            const url = canonicalUrl(r.url);
            if (
              !url ||
              seen.has(url) ||
              !r.content.trim() ||
              (r.score !== undefined && r.score < 0.2)
            )
              continue;
            seen.add(url);
            results.push({
              url,
              title: r.title.slice(0, 200),
              snippet: r.content.trim().slice(0, 1200),
              publishedDate:
                r.published_date && !isNaN(Date.parse(r.published_date))
                  ? r.published_date
                  : undefined,
              retrievedAt: new Date(now()).toISOString(),
            });
            if (results.length >= p.maxResults) break;
          }
          const result: SearchResponse = {
            query: p.query,
            since: p.since,
            cached: false,
            results,
          };
          if (results.length) {
            if (cache.size >= 256) cache.delete(cache.keys().next().value!);
            cache.set(key, {
              expires:
                now() +
                (/price|pricing|today|latest|news/i.test(p.query)
                  ? 300000
                  : 3600000),
              data: result,
            });
          }
          return result;
        } catch {
          return failure(
            deadline.aborted ? "timeout" : "invalid_or_unavailable",
          );
        }
      });
      pending.set(key, job);
      void job.finally(() => pending.delete(key));
    }
    // Shared fetch owns its deadline; one disconnected subscriber cannot cancel others.
    const job = pending.get(key)!;
    if (!signal) return job;
    return new Promise<SearchResponse>((resolve) => {
      const abort = () => resolve(failure("cancelled"));
      signal.addEventListener("abort", abort, { once: true });
      job
        .then(resolve)
        .finally(() => signal.removeEventListener("abort", abort));
      if (signal.aborted) abort();
    });
  };
}
export const executeWebSearch = createSearchService();
