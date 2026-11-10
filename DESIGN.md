# DESIGN.md

## Core insight

The task looks like "chat + web search" but the test cases are about **time and conversation memory**: "since Monday", "what did I ask on 3 November", "last Tuesday". Search is the easy half. The hard half is resolving *when* the user means, recalling what was said then, and checking what changed *after* that moment. So the design treats time as a first-class input, and keeps the model's single tool (`web_search`) as thin as possible.

## How it works

```
user msg (+ browser timezone)
  → [1] Temporal resolver     chrono-node, deterministic: "last Tuesday" → 2026-11-03 range
  → [2] History retriever     SQLite (node:sqlite): past turns in that range, else keyword match
  → [3] Prompt assembly       system prompt + current date/time/TZ + retrieved turns (each date-stamped)
  → [4] Agent loop            streaming (Gemini 2.0 Flash), ≤3 rounds, parallel web_search calls
  → [5] Answer + citations    streamed; turn persisted (question, answer, sources, timestamp)
```

- **Date and timezone are injected every turn.** Models don't know today's date, and "last Tuesday" is wrong near midnight without the user's timezone.
- **Everything is persisted with timestamps**, keyed by a user cookie rather than the session, because "what did I ask on 3 November" spans sessions. For each assistant answer we store the sources it cited, so "is your answer still correct?" becomes: load the old answer, then search with `since = answer date`. Built using Node's zero-dependency `node:sqlite`.
- **`web_search(query, since?, recency?)`** is time-aware, backed by Tavily with published-date filtering. Results are trimmed to title, URL, published date and a short snippet to keep context small.
- **Parallelism:** "5 CRM tools" becomes 5 simultaneous searches in one step, not 5 sequential rounds. Tokens and tool status stream immediately. Searches are cached by `(query, since, day)`, and the static system prompt uses prompt caching.

## Why this shape

- **Deterministic date resolution beats asking the model.** It is faster, free, and testable. A small fast-model fallback handles phrasing chrono-node can't parse.
- **Memory lives in the harness, not a tool.** The brief allows one tool. A memory tool would also add a model round trip before every recall question, and the model might skip it.
- **Honesty is designed in, not prompted in.** Three outcomes are worded differently: *no matching history* ("I have nothing from 3 November"), *searched and nothing changed* ("no changes found since 3 Nov across these sources"), and *couldn't find sources* (said plainly, with thin evidence flagged). Every claim carries a URL and source date.
- **Conversation style:** make a reasonable assumption, state it in one line, proceed. Lead with the conclusion ("Two of five changed: …"). Tables only when comparing items.

## Considered and rejected

| Option | Why not |
|---|---|
| Memory as a second tool | Breaks the one-tool rule; adds a round trip |
| Vector-embedding memory | Overkill for a per-user chat log and poor at date queries; date range plus keyword match is exact |
| Multi-agent planner | Slower, more failure modes, little gain over one loop with parallel calls |
| Fetching full pages | Outside the one-tool scope and slow; snippets with dates are enough for "what changed" |
| More than ~3 loop rounds | Latency grows faster than answer quality |

## Evals

`evals/` seeds past conversations on fixed dates, then runs 20 reproducible test cases: the three brief examples, missing history, ambiguous dates, relative dates near midnight and across timezones, and "nothing changed" cases.

| Metric | Result |
|---|---|
| Correct recall / refusal when history is absent | **100.0%** (20/20) |
| Correct date resolution | **100.0%** (20/20) |
| Honest "no change" vs "no sources" wording signal | **100.0%** (20/20) |
| Harness Latency p50 / p95 | **0.68 ms** / **65.41 ms** |

## With another week

1. Claim-level re-verification: extract discrete claims from the old answer and re-check each one separately.
2. Source-quality ranking (official pricing pages and changelogs over blogs) and a reranker.
3. A stored per-user timezone profile instead of per-request only.
4. A larger eval set, with failures from real chats fed back in.
5. Search-provider fallback and per-domain freshness handling.
