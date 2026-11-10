# PRD: Chat Agent with Web Search (minimi hiring challenge)

> Legend: **[Brief]** = stated in the challenge brief. **[Derived]** = my inference from the brief's examples. **[Open]** = not decided or not known.

## 1. Goal

**[Brief]** Build a chat agent people can talk to. It has **one tool: web search**. Make it as good as the best chat agents with web search on the internet today.

**[Brief]** What is being judged: how the agent is designed to answer **fast**, get things **right**, and be **good to talk to**. The best architecture wins, not the first submission, not the prettiest screen, not the most feature-rich one.

## 2. Users

- **Evaluators** who chat with the agent like real users, read the code and read `DESIGN.md`. **[Brief]**
- There is no other user group in the brief.

## 3. What the test queries show

**[Brief]** Three example queries from the evaluation dataset:

| # | Query | What it needs **[Derived]** |
|---|---|---|
| 1 | "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?" | Recall of an earlier turn, resolve "Monday", then search for changes after that date |
| 2 | "What did I ask you on 3 November? Is your answer still correct today?" | Date-based recall of history, then re-check the old answer against current information |
| 3 | "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?" | Resolve "last Tuesday" relative to today, recall, then search for pricing changes since |

**[Derived]** The common thread is time plus conversation memory, not search alone.

**[Open]** The brief does not say how past conversations reach the agent during evaluation (pre-seeded history, earlier turns in the same session, or neither). The design must not assume one. See `MEMORY.md`.

## 4. Requirements

### Functional **[Derived]** from the examples

- F1. Answer questions using a single `web_search` tool.
- F2. Resolve relative dates ("Monday", "last Tuesday", "3 November") against the current date and the user's timezone.
- F3. Recall earlier turns from the stated date or period.
- F4. For "what changed since X" questions, search with that date as the lower bound.
- F5. Cite sources with URLs, with source dates where available.
- F6. Say so when history does not exist, when no change was found, and when sources could not be found. These are three different outcomes and must be worded differently.
- F7. Handle questions that involve several named items (for example 5 tools) without answering one at a time.

### Non-functional

- N1. **Fast** **[Brief]**: perceived latency matters (streaming output and visible progress are the planned means, **[Derived]**).
- N2. **Correct** **[Brief]**: no fabricated recall, no fabricated sources.
- N3. **Good to talk to** **[Brief]**: concise, leads with the conclusion, avoids unnecessary clarifying questions **[Derived]**.

## 5. Constraints **[Brief]**

- JavaScript or TypeScript on Node.
- Must run with `npm install` then `npm run dev`.
- Every required API key listed in `.env.example`.
- Any framework (or none), any model.
- AI coding tools are allowed, but the author must be able to explain every decision in the code.

## 6. Deliverables **[Brief]**

1. A public GitHub repo.
2. `DESIGN.md` in the repo, one page: how it works, why it is built this way, what was considered and rejected, what would be done with another week.
3. Repo link submitted through the application form.

## 7. Out of scope

- Any tool other than web search **[Brief]**.
- Visual polish as a goal in itself **[Brief]**: not what wins.

## 8. Open questions **[Open]**

- Which model and which search provider (the brief leaves both free).
- Which framework (the brief leaves it free).
- How evaluation history is delivered (see section 3).
- Whether the evaluator's client will send a timezone; if not, a fallback is needed.

## 9. Success criteria

- The three example queries are handled correctly, including the case where the referenced history does not exist.
- Measured by the repo's own eval suite (`evals/`), with results recorded in `DESIGN.md` only after they are actually run.
