# ARCHITECTURE.md

> Status: **proposed design**. Nothing here is implemented yet. Items marked **[Choice]** are recommendations that still need a final decision (see `MEMORY.md`).

## 1. Principle

The model gets exactly one tool, `web_search`. Everything about time and memory is handled **by the harness before the model runs**, so the model receives the right context instead of having to ask for it.

## 2. Request pipeline

```
user message (+ browser timezone, user cookie)
  → [1] Temporal resolver     deterministic date parsing
  → [2] History retriever     SQLite lookup by date range, else keyword
  → [3] Prompt assembly       system prompt + current date/time/TZ + retrieved turns (date-stamped) + current conversation
  → [4] Agent loop            streaming, bounded rounds, parallel web_search calls
  → [5] Response + persist    stream answer with citations, then store the turn
```

## 3. Components

### 3.1 Temporal resolver
- Input: the user message, current time, client timezone.
- Output: zero or more resolved date ranges (for example "last Tuesday" → one calendar day in the user's timezone).
- **[Choice]** `chrono-node` for parsing, with a small fast-model fallback for phrasing it cannot parse.
- Must be deterministic and unit-testable, including around midnight and across timezones.

### 3.2 History retriever
- If a date range was resolved: fetch the user's turns in that range.
- If no date: keyword match over the user's past turns.
- Returns turns with their timestamps. If nothing matches, it returns an explicit "no history found" signal that reaches the prompt, so the model can say so rather than invent.
- Scoped by **user cookie**, not session, because date-based recall spans sessions.

### 3.3 Prompt assembly
- Static system prompt (cache-friendly).
- Current date, time and timezone injected on **every** turn.
- Retrieved past turns, each labeled with its date.
- The current conversation.

### 3.4 Agent loop
- Streaming; a bounded number of rounds (**[Choice]** about 3).
- Multiple `web_search` calls may be issued in parallel in one round (for example one per named item).
- Tool status is streamed to the client ("Searching …").

### 3.5 `web_search` tool contract
- Parameters: `query` (required), `since` (optional date), `recency` (optional).
- Returns trimmed results: title, URL, published date, short snippet.
- **[Choice]** a provider that supports date filtering and published dates (Tavily or Exa).
- Results cached by `(query, since, day)`.

### 3.6 Persistence
- **[Choice]** SQLite via `better-sqlite3`.
- Stored per turn: user id, timestamp, user message, assistant answer, the sources it cited.
- Storing cited sources lets a "still correct today?" question re-search the old answer's claims with `since = answer date`.

Proposed shape (illustrative, to be finalized in code):

| Table | Key fields |
|---|---|
| `users` | id (cookie value), created_at, timezone |
| `messages` | id, user_id, role, content, created_at |
| `answer_sources` | message_id, url, title, published_at |

## 4. Failure handling

| Situation | Required behavior |
|---|---|
| Referenced date has no stored history | State that there is no history for that date; do not reconstruct |
| Search ran, nothing changed since the date | Say no changes were found, and across which sources |
| Search failed or returned nothing usable | Say sources could not be found; do not present it as "no change" |
| Evidence is thin or conflicting | Say so, cite what exists |
| Ambiguous date | Make a reasonable assumption, state it in one line, proceed |

## 5. Performance levers

- Parallel searches in a single round.
- Streaming tokens and tool status.
- Search result cache.
- Prompt caching on the static system prompt.
- Bounded loop rounds.

## 6. Planned repo layout **[Choice]**

```
src/agent/{prompt.ts, loop.ts, search.ts}
src/memory/{db.ts, temporal.ts, retrieve.ts}
src/server.ts
evals/{cases.json, run.ts}
DESIGN.md  .env.example
```

Framework (for example Next.js with the Vercel AI SDK, or Hono with a static page) is undecided.
