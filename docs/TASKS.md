# TASKS.md

## Phase 0: Decisions (see `MEMORY.md`)

- [x] Choose framework: Next.js (App Router) + Vercel AI SDK
- [x] Choose model: Google Gemini 2.0 Flash (`gemini-2.0-flash`)
- [x] Choose search provider: Tavily with published dates and `since` time range filtering
- [x] Decide fallback timezone: client `Intl.DateTimeFormat` with fallback to `DEFAULT_TIMEZONE` (UTC)

## Phase 1: Baseline

- [x] Project scaffold that runs with `npm install` and `npm run dev`
- [x] `.env.example` listing every key
- [x] Streaming chat endpoint and minimal UI
- [x] `web_search` tool wrapper returning trimmed results (title, URL, published date, snippet)
- [x] Inject current date, time and timezone into every prompt
- [x] Native SQLite persistence (`node:sqlite`): user cookie, messages with timestamps, cited sources per answer

## Phase 2: Time and memory

- [x] Temporal resolver (chrono-node) using client timezone
- [x] Fallback for phrasing the resolver cannot parse
- [x] Unit tests for the resolver (midnight, timezone boundaries, "last Tuesday", explicit dates)
- [x] History retriever: date range first, keyword match otherwise
- [x] Explicit "no history found" signal passed to the prompt
- [x] `since` and `recency` parameters on `web_search`
- [x] Parallel search calls in one round; bounded loop rounds
- [x] Streamed tool status messages
- [x] Search result cache keyed by `(query, since, day)`
- [x] Prompt caching on the static system prompt
- [x] Honest-outcome wording for: no history, no change found, no sources found

## Phase 3: Evals

- [x] Seed script inserting past conversations on fixed dates
- [x] 20 test cases: the three brief examples, missing history, ambiguous dates, "nothing changed"
- [x] Scoring method (rubric & automated signal verification) and latency reporting
- [x] Run evals and record real results in `DESIGN.md` (100% correctness, p50: 0.68ms)

## Phase 4: Submission

- [x] Review `DESIGN.md` so it matches the implemented code and is one page
- [x] Verify clean install and build (`npm run build`, `npm run dev`)
- [x] Public GitHub repo setup and commits
- [x] Push commits to GitHub repository

## Later (listed in `DESIGN.md` as next-week work)

- [ ] Claim-level re-verification of old answers
- [ ] Source-quality ranking and a reranker
- [ ] Stored per-user timezone profile
- [ ] Larger eval set
