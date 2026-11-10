<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:d95ec162d34323fdc4cdbfcd4c5442abb37cb0b7f494e6f57c6b4aec1c1e6c9e -->

# Web Search Chat Agent

A single-tool conversational search prototype using Next.js, Gemini, Tavily and SQLite. Read [DESIGN.md](DESIGN.md) for actual guarantees and limitations.

## Run

Requires Node >=22.13.0. Run `npm ci`, copy `.env.example` to `.env.local`, configure provider keys, then `npm run dev`. Open http://localhost:3000. `npm run chat` starts the CLI. Production uses `npm run build` then `npm start` and requires SESSION_SECRET and durable database storage.

## Validate

`npm test` runs isolated deterministic tests and scripted SDK orchestration. `npm run lint` checks types. These do not measure live model correctness. `npm audit` currently reports dependencies needing major-version migration; do not treat this prototype as production-ready.

The browser restores the current conversation after reload and supports a new-conversation action. Demo history is only available in isolated test scripts; the public seed endpoint is disabled. Anonymous sessions use signed cookies; clearing cookies loses access. Existing unsigned sessions are intentionally not adopted.


<!-- /coderabbit-ai-generated:v1 -->