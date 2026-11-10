# RULES.md

Three sets of rules. Section 1 comes directly from the challenge brief. Sections 2 and 3 are this project's own rules, derived from the brief's goals.

## 1. Challenge rules (from the brief)

1. JavaScript or TypeScript on Node.
2. Must run with `npm install`, then `npm run dev`.
3. List every API key the project needs in `.env.example`.
4. Any framework (or none) and any model.
5. AI coding tools are welcome, but you must be able to explain every decision in your code.
6. The agent has **one tool: web search**.
7. Deliver a public GitHub repo and a one-page `DESIGN.md` (how it works, why, what was considered and rejected, what you'd do with another week).
8. Submit the repo link through the application form.

## 2. Agent behavior rules

These govern what the agent says and does.

- **Never invent history.** If no stored turn matches the date or topic the user refers to, say so.
- **Never invent sources.** Every cited URL must come from a search result in this run.
- **Distinguish three outcomes** and word them differently: no history found; searched and found no change; could not find usable sources.
- **Date every claim about change.** Use the source's published date where available, and say when it is not.
- **Always use the injected current date and timezone.** Never rely on the model's own sense of today's date.
- **Resolve dates before the model runs** (harness-side), not inside the model's reasoning.
- **Prefer an assumption to a question.** If a reasonable reading exists, state the assumption in one line and proceed.
- **Lead with the conclusion.** Keep answers short. Use a table only when comparing items.
- **Say when evidence is thin.**
- **Use only `web_search`.** No additional tools, including a memory tool.

## 3. Engineering and contributor rules

- Every design decision must be explainable by its author, including anything produced by an AI coding tool.
- Do not state eval results in `DESIGN.md` unless they were actually run.
- Do not document behavior that is not implemented; mark it as planned.
- Keep `DESIGN.md` to one page.
- `.env.example` must be updated whenever a new key is introduced.
- The date resolver must have unit tests, including around midnight and across timezones.
- Keep dependencies minimal; each one should be justifiable in `DESIGN.md`.
- When a fact is unknown, record it as an open question in `MEMORY.md` rather than guessing.
