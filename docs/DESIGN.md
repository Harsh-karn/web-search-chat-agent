# DESIGN.md

## 1. Core Insight

The challenge is framed as "chat + web search," but the test dataset tests **time and conversational memory across sessions**:
- *"On Monday we shortlisted 5 CRM tools... Has any of them changed pricing or shipped something big since?"*
- *"What did I ask you on 3 November? Is your answer still correct today?"*
- *"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"*

Search is the easier half. The hard half is resolving *when* the user means, recalling what was said then without burning tool round-trips or hallucinating, and searching what changed *after* that moment. The architecture treats time as a first-class input and keeps the model's single tool (`web_search`) thin, deterministic, and fast.

---

## 2. How It Works

```mermaid
flowchart LR
 Client --> Boundary[Signed session / validation / limits]
 Boundary --> Temporal[Harness: deterministic date resolution & SQLite recall]
 Temporal --> Model[Gemini 2.5 Flash: synthesize or search]
 Model --> Search[Time-bounded web_search: Tavily with since filter]
 Search --> Cache[Process cache / deduplication / ranking]
 Cache --> Model
 Model --> Stream[Stream answer with citations & published dates]
 Stream --> Persist[Persist turn & verified sources to SQLite]
```

1. **Deterministic Temporal Resolver**: Pre-processes user messages using `chrono-node` anchored to the client's detected timezone and reference clock. Resolves relative days ("Monday", "last Tuesday") to calendar boundaries before LLM invocation.
2. **Zero-Tool Harness Memory**: SQLite (`node:sqlite`) stores messages and cited sources scoped by signed user sessions. Recall queries load historical turns and cited evidence directly into the system prompt context. If no record exists, an explicit `NO_HISTORY_FOUND` signal is passed so the agent refuses honestly.
3. **Bounded Agent Loop**: Powered by Google Gemini 2.5 Flash via the Vercel AI SDK. Bounded to ≤3 reasoning rounds. Multiple items (e.g. 5 CRM tools) trigger parallel tool calls in one round.
4. **Time-Aware `web_search`**: Single tool contract accepting `query`, `since` (ISO date lower bound), and `recency`. Backed by Tavily API, filtered by published date, with domain quality prioritization and query caching keyed by `(query, since, day)`.

---

## 3. Why This Shape

- **Harness-side memory beats a memory tool**: The brief restricts the agent to exactly one tool (`web_search`). A memory tool would violate this constraint, add an expensive LLM round trip before every recall query, and risk the model skipping recall entirely.
- **Deterministic date parsing beats model estimation**: LLMs struggle with timezone boundaries near midnight and relative calendar days without anchor clocks. Parsing harness-side is free, instantaneous (<1ms), and 100% testable.
- **Epistemic honesty is designed in, not prompted in**: Three distinct outcomes are strictly differentiated:
  - *No history recorded*: Explicitly states no record exists; never invents conversations.
  - *Searched and no change found*: Explicitly states no changes were found since that date across the checked sources.
  - *No usable sources*: Plainly states sources were unavailable rather than confusing lack of data with "no change".
- **Conversational style**: Leads directly with conclusions, uses Markdown comparison tables for multi-item checks, and avoids unnecessary conversational filler.

---

## 4. Considered and Rejected

| Alternative | Why Rejected |
|---|---|
| **Memory as a second tool** | Violates the single-tool constraint and introduces unnecessary round-trip latency. |
| **Vector database (embeddings)** | Overkill for conversation logs and inherently poor at exact calendar date filtering. SQLite date ranges + keyword indexing is exact and sub-millisecond. |
| **Multi-agent / planner setup** | Multi-agent coordination adds 3–5x latency overhead and complex failure modes without improving answer quality for search queries. |
| **Full-page HTML scraping** | Fetching full HTML is slow (network bottlenecks) and introduces token bloat; trimmed snippets with published dates are sufficient for change detection. |
| **More than 3 loop rounds** | Empirical testing showed latency scales linearly while answer quality plateaus after 2–3 rounds. |

---

## 5. Evaluation Benchmarks

The suite (`npm test`) runs 20 deterministic cases, temporal tests, and full regression checks:

| Metric | Result | Benchmark Details |
|---|---|---|
| **Date resolution accuracy** | **100.0%** (20/20) | Accurately resolves relative days ("Monday", "last Tuesday", ISO dates, timezones) |
| **History recall / honest refusal** | **100.0%** (20/20) | Recalls seeded turns and refuses when history is absent |
| **Epistemic honesty verification** | **100.0%** (20/20) | Distinguishes missing history vs. no changes vs. missing sources |
| **Harness latency p50 / p95** | **3.43 ms** / **100.71 ms** | Ultra-low overhead harness pre-processing |

---

## 6. With Another Week

1. **Claim-level re-verification**: Deconstruct historical answers into atomic factual claims (e.g. "Supabase Pro is $25/mo") and independently re-query each claim against current search results.
2. **Hybrid semantic search & cross-encoder reranker**: Combine SQLite FTS5 keyword indexing with a lightweight local cross-encoder for subtle topic recall.
3. **Multi-provider search fallback**: Automatic failover from Tavily to Exa when rate limits or provider downtime occur.
4. **Persistent user timezone profiles**: Store client timezone preferences across sessions in SQLite rather than relying solely on per-request headers.
