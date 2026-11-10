# MEMORY.md

Project memory: what is known, what has been decided, and what is still open.

## 1. Confirmed facts (from the challenge brief)

- Build a chat agent with **one tool: web search**; aim to match the best such agents available today.
- JavaScript or TypeScript on Node; runs with `npm install` then `npm run dev`.
- Every API key listed in `.env.example`.
- Any framework and any model are allowed.
- AI coding tools are allowed; the author must be able to explain every decision.
- Deliverables: public GitHub repo, one-page `DESIGN.md`, repo link submitted via the application form.
- Judged on architecture and thinking: speed, correctness, and being good to talk to.

## 2. Implemented Decisions

| Decision | Selection | Justification |
|---|---|---|
| Framework | Next.js (App Router) + Vercel AI SDK | Full streaming support, built-in multi-step agent loop, parallel tool execution, standard single-command run (`npm run dev`) |
| Model | Google Gemini 2.0 Flash (`gemini-2.0-flash`) | Ultra-fast token generation, low latency, native tool calling, high precision |
| Search Provider | Tavily Search API | Published date extraction, date window filtering (`days`, `time_range`), snippet summarization |
| Persistence | Node native `node:sqlite` (`DatabaseSync`) | Zero external C++ native build dependencies, cross-platform stability (Node 22+), sub-millisecond queries |
| Temporal Parser | `chrono-node` + boundary expander | Deterministic calendar date ranges with timezone awareness |
| Cache | In-memory query cache | Keyed by `(query, since, day)` to prevent redundant searches |

## 3. Evals Summary

- 20 comprehensive test cases run via `npm run test:evals`.
- 100% Date Resolution accuracy (20/20).
- 100% History Retrieval & Honest Refusal accuracy (20/20).
- 100% Epistemic Honesty Signal Verification (20/20).
- Harness Latency: p50 = 0.68 ms, p95 = 65.41 ms.
