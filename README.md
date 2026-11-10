# Web Search Chat Agent

> A high-performance chat agent equipped with **a single tool: `web_search`**, featuring deterministic temporal memory, time-bounded search, and epistemic honesty. Built for the Minimi hiring challenge.

[![Tests](https://img.shields.io/badge/evals-20%2F20%20passed%20(100%25)-emerald.svg)]()
[![Model](https://img.shields.io/badge/model-Gemini%202.0%20Flash-blue.svg)]()
[![Tool](https://img.shields.io/badge/tools-1%20tool%20(web__search)-purple.svg)]()

---

## ⚡ Quick Start

```bash
# 1. Clone repository
git clone https://github.com/Harsh-karn/web-search-chat-agent.git
cd web-search-chat-agent

# 2. Install dependencies (Node 22+)
npm install

# 3. Configure API keys
cp .env.example .env.local
# Add your GEMINI_API_KEY and TAVILY_API_KEY

# 4. Start local development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to chat with the agent.

---

## 🧠 Architecture Overview

While framed as a search challenge, the test queries reveal that the true differentiator is **temporal reasoning and conversational memory across sessions**:
- *"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"*
- *"What did I ask you on 3 November? Is your answer still correct today?"*
- *"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"*

```
User Message (+ Browser Timezone, Cookie)
  │
  ├──► [1] Temporal Resolver (chrono-node: "last Tuesday" → exact calendar day ISO range)
  │
  ├──► [2] History Retriever (SQLite: fetches turns + cited sources in range; handles missing history)
  │
  ├──► [3] Prompt Assembly (system prompt + current reference date/time + retrieved context)
  │
  ├──► [4] Agent Loop (Gemini 2.0 Flash, bounded ≤3 rounds, parallel web_search calls)
  │
  └──► [5] Stream Answer + Persist (citations, published dates, question/answer/sources to SQLite)
```

Read the complete rationale and architectural choices in [**`DESIGN.md`**](DESIGN.md).

---

## 📊 Evaluation Benchmark Results

Run the reproducible 20-case test suite locally:

```bash
npm run test:evals
```

| Metric | Result | Benchmark Details |
|---|---|---|
| **Correct recall / refusal when history is absent** | **100.0%** (20/20) | Accurately recalls seeded conversations and honestly refuses absent dates |
| **Correct date resolution** | **100.0%** (20/20) | Resolves relative days, explicit dates, and boundary timezones |
| **Honest outcome signal verification** | **100.0%** (20/20) | Strictly distinguishes *no history* vs *no changes found* vs *no sources* |
| **Harness Latency p50** | **0.68 ms** | Sub-millisecond harness pre-processing overhead |
| **Harness Latency p95** | **65.41 ms** | Fast, deterministic SQLite + chrono resolution |

---

## 🛠️ Tech Stack & Decisions

- **Runtime**: Node.js (v22+) with native `node:sqlite` (`DatabaseSync`) for zero external C++ build dependencies and sub-millisecond query execution.
- **Framework**: Next.js 15 (App Router) + TypeScript + Tailwind CSS.
- **Agent Streaming**: Vercel AI SDK (`ai`, `@ai-sdk/google`) powering Google Gemini 2.0 Flash.
- **Single Tool Contract**: `web_search({ query, since?, recency? })` backed by Tavily API with query caching keyed by `(query, since, day)`.
