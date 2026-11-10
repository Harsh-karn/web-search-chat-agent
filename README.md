# Web Search Chat Agent

> **Minimi Hiring Challenge: Build a chat agent with web search**  
> A benchmark-grade chat agent with **exactly one tool: `web_search`**, designed for temporal precision, conversational memory across sessions, and epistemic honesty.

Read [DESIGN.md](DESIGN.md) for the architecture breakdown, benchmark metrics, rejected alternatives, and next steps.

---

## Key Highlights

- **Single-Tool Compliance**: Exposes only `web_search({ query, since?, recency? })`.
- **Harness-Side Temporal Memory**: Zero-tool recall using `node:sqlite` and deterministic timezone-aware date parsing (`chrono-node`). Relative dates like *"Monday"* or *"last Tuesday"* are resolved to exact calendar boundaries before calling the model.
- **Epistemic Honesty**: Strictly distinguishes between *no past conversation recorded*, *searched and no changes found*, and *no usable sources found*.
- **Parallel Search Execution**: Multi-entity inquiries (e.g., 5 CRM tools) execute time-bounded Tavily searches in parallel within a single reasoning turn.
- **Fast & Responsive**: Powered by Google Gemini 2.5 Flash via the Vercel AI SDK with citation streaming.

---

## Quickstart

### Prerequisites
- **Node.js**: `v22+` (uses built-in `node:sqlite`)
- **API Keys**: Google Gemini API key and Tavily Search API key.

### Setup
```bash
# 1. Clone repository
git clone https://github.com/Harsh-karn/web-search-chat-agent.git
cd web-search-chat-agent

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Add your GEMINI_API_KEY and TAVILY_API_KEY to .env.local

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing Challenge Datasets

The UI includes a **`🌱 Seed Demo History`** button in the header that populates the active session with the mock turns referenced in the challenge prompt:
1. *"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"*
2. *"What did I ask you on 3 November? Is your answer still correct today?"*
3. *"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"*

Click **Seed Demo History**, then click the test prompt chips to watch the agent recall the past discussion and stream real-time verified updates.

---

## Validation & Evaluation Suite

Run the full evaluation and regression suite:
```bash
npm test
```

This runs:
- **`evals/test-temporal.ts`**: Verifies relative date resolution, timezone boundaries, and database persistence.
- **`evals/run.ts`**: Runs 20 automated benchmark scenarios (100% pass rate).
- **`evals/regression.ts`**: Validates session isolation, tool schema enforcement, transaction safety, and streaming.

To test live DOM rendering and end-to-end endpoint streaming:
```bash
npx tsx evals/dom-check.ts
```

---

## Project Structure

```text
├── src/
│   ├── agent/
│   │   ├── loop.ts          # Agent loop (Gemini 2.5 Flash + web_search tool)
│   │   ├── prompt.ts        # System prompt with temporal injection & memory
│   │   └── search.ts        # Time-aware Tavily search with domain deduplication
│   ├── memory/
│   │   ├── db.ts            # Native SQLite persistence (node:sqlite)
│   │   ├── temporal.ts      # Deterministic date resolver (chrono-node)
│   │   └── retrieve.ts      # Harness-side history query
│   ├── server/
│   │   └── session.ts       # Cryptographic session & cookie management
│   └── app/
│       ├── page.tsx         # Responsive UI (Instrument Serif + Space Grotesk)
│       └── api/
│           ├── chat/route.ts# SSE streaming chat endpoint
│           └── seed/route.ts# Demo history seeding endpoint
├── evals/                   # 20-case benchmark & regression test suite
├── DESIGN.md                # 1-page architecture & design decisions
└── README.md
```
