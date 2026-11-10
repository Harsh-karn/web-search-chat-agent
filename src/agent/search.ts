import { SearchResponse, SearchResultItem } from "./types";

// In-memory cache keyed by `${query}::${since}::${today}`
const searchCache = new Map<string, { timestamp: number; data: SearchResponse }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

/**
 * Score and rank search results based on domain authority, recency, and official paths.
 */
function rankSearchResults(items: SearchResultItem[], query: string): SearchResultItem[] {
  const queryLower = query.toLowerCase();
  const isPricingQuery = queryLower.includes("pricing") || queryLower.includes("price") || queryLower.includes("cost");
  const isChangelogQuery = queryLower.includes("shipped") || queryLower.includes("change") || queryLower.includes("release") || queryLower.includes("update");

  return [...items].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    const urlA = a.url.toLowerCase();
    const urlB = b.url.toLowerCase();

    // Boost official / canonical paths
    if (isPricingQuery) {
      if (urlA.includes("/pricing") || urlA.includes("/editions-pricing") || urlA.includes("/plans")) scoreA += 5;
      if (urlB.includes("/pricing") || urlB.includes("/editions-pricing") || urlB.includes("/plans")) scoreB += 5;
    }

    if (isChangelogQuery) {
      if (urlA.includes("/changelog") || urlA.includes("/releases") || urlA.includes("/blog/")) scoreA += 5;
      if (urlB.includes("/changelog") || urlB.includes("/releases") || urlB.includes("/blog/")) scoreB += 5;
    }

    // Boost items with confirmed published dates
    if (a.publishedDate) scoreA += 2;
    if (b.publishedDate) scoreB += 2;

    // Penalize known low-signal content farms / forum scraps if official docs exist
    const lowSignalDomains = ["quora.com", "reddit.com", "pinterest.com"];
    if (lowSignalDomains.some((d) => urlA.includes(d))) scoreA -= 3;
    if (lowSignalDomains.some((d) => urlB.includes(d))) scoreB -= 3;

    return scoreB - scoreA;
  });
}

/**
 * Executes a web search using the Tavily API.
 * Supports date filtering via `since` and recency constraints.
 * Trims and caches results for fast, lightweight prompt injection.
 */
export async function executeWebSearch(params: {
  query: string;
  since?: string;
  recency?: "day" | "week" | "month" | "year";
  maxResults?: number;
}): Promise<SearchResponse> {
  const { query, since, recency, maxResults = 5 } = params;
  const todayStr = new Date().toISOString().slice(0, 10);
  const cacheKey = `${query.trim().toLowerCase()}::${since || ""}::${recency || ""}::${todayStr}`;

  // Check cache
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      query,
      since,
      cached: false,
      results: [],
      error: "TAVILY_API_KEY is not configured in environment.",
    };
  }

  try {
    // Determine time filtering
    let days: number | undefined;
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        const diffMs = Date.now() - sinceDate.getTime();
        days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }
    }

    const payload: Record<string, unknown> = {
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      max_results: maxResults,
    };

    if (days !== undefined && days <= 365) {
      payload.days = days;
    } else if (recency) {
      payload.time_range = recency;
    }

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        query,
        since,
        cached: false,
        results: [],
        error: `Tavily API error (${res.status}): ${errText}`,
      };
    }

    const json = (await res.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        published_date?: string;
        content?: string;
      }>;
    };

    const rawItems: SearchResultItem[] = (json.results || []).map((r) => ({
      title: r.title || "Untitled",
      url: r.url || "",
      publishedDate: r.published_date || undefined,
      snippet: (r.content || "").slice(0, 300).trim(),
    }));

    // Apply ranking and quality prioritization
    const rankedItems = rankSearchResults(rawItems, query);

    const response: SearchResponse = {
      query,
      since,
      cached: false,
      results: rankedItems,
    };

    searchCache.set(cacheKey, { timestamp: Date.now(), data: response });
    return response;
  } catch (err) {
    return {
      query,
      since,
      cached: false,
      results: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
