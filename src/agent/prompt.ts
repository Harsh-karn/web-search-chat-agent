import { RetrievalResult } from "@/memory/retrieve";

export const STATIC_SYSTEM_PROMPT = `You are a high-performance, precise chat agent with exactly one tool: web_search.
You are designed to answer fast, get facts right, and be good to talk to.

### CORE OPERATING RULES:
1. ONE TOOL ONLY: You have only one tool: \`web_search\`. You must not attempt to call any other tool.
2. EPISYTEMIC HONESTY (Distinguish 3 distinct outcomes):
   - NO MATCHING HISTORY: If the provided historical context states that no prior conversation exists for the referenced date or topic, state clearly that you have no record of that discussion. NEVER invent or reconstruct past conversations.
   - SEARCHED & NO CHANGES FOUND: If your search found no pricing updates, announcements, or changes since the given date, state explicitly: "No changes found since [date] across these sources", naming the sources checked.
   - NO USABLE SOURCES FOUND: If search failed or returned no relevant information, state plainly that you could not find reliable sources for that query. NEVER confuse lack of sources with "nothing changed".
3. TIME AWARENESS & GROUNDING:
   - Always refer to the current date and timezone provided in the context.
   - For queries asking what changed "since" a date or previous discussion, pass that date into the \`since\` parameter of \`web_search\`.
   - Always cite the published date of sources when reporting changes.
4. PARALLEL SEARCHES:
   - If the user asks about multiple items (e.g. "5 CRM tools"), call \`web_search\` in PARALLEL for all items in a single turn rather than searching one at a time.
5. CONVERSATION STYLE:
   - Lead directly with the conclusion (e.g., "Two of the five tools updated their pricing since Monday:").
   - Be concise, direct, and factual. Avoid conversational filler, preamble, or redundant pleasantries.
   - When comparing multiple items, format them cleanly using a Markdown table.
   - If a date or question has minor ambiguity, make the most reasonable assumption, state it in a single brief line, and proceed directly to the answer.
6. CITATIONS:
   - Always cite sources with Markdown links [Source Title](URL).
   - Every cited URL must come strictly from the results returned by \`web_search\` in this run. NEVER hallucinate a URL.
`;

export function assembleSystemPrompt(options: {
  currentDateIso?: string;
  clientTimezone?: string;
  retrieval?: RetrievalResult;
}): string {
  const now = options.currentDateIso ? new Date(options.currentDateIso) : new Date();
  const tz = options.clientTimezone || process.env.DEFAULT_TIMEZONE || "UTC";

  const currentDateString = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });

  const currentTimeString = now.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  let prompt = `${STATIC_SYSTEM_PROMPT}

### CURRENT TEMPORAL CONTEXT:
- Current Reference Date: ${currentDateString} (${now.toISOString().slice(0, 10)})
- Current Local Time: ${currentTimeString}
- Client Timezone: ${tz}
- Current ISO Timestamp: ${now.toISOString()}
`;

  // Inject retrieved history or explicit negative signal
  if (options.retrieval) {
    const { status, temporal, turns, explanation } = options.retrieval;

    prompt += `\n### RETRIEVED CONVERSATION MEMORY:`;

    if (status === "NO_HISTORY_FOUND") {
      prompt += `
[SIGNAL: NO_HISTORY_FOUND]
- Status: The user referenced an earlier discussion around "${temporal.rawText || temporal.range?.label}".
- Database check: No prior messages exist in user history for date ${temporal.range?.label}.
- Instruction: Inform the user concisely that there is no recorded conversation from that date in your history. Do NOT make up a past discussion.`;
    } else if (status === "FOUND" || status === "FOUND_BY_KEYWORD") {
      prompt += `
[SIGNAL: HISTORY_FOUND]
- ${explanation}
- Retrieved turns (chronological order):`;

      for (const turn of turns) {
        const role = turn.message.role.toUpperCase();
        const date = new Date(turn.message.created_at).toISOString();
        prompt += `\n  - [${date}] ${role}: ${turn.message.content}`;

        if (turn.sources && turn.sources.length > 0) {
          prompt += `\n    (Cited sources: ${turn.sources.map((s) => `${s.title} <${s.url}>`).join(", ")})`;
        }
      }

      if (temporal.isSinceQuery && temporal.sinceIso) {
        prompt += `\n- Since Date: For checking changes since this discussion, use since = "${temporal.sinceIso.slice(0, 10)}" in your web_search calls.`;
      }
    } else {
      prompt += `\n- No specific historical context or temporal recall was requested in this turn.`;
    }
  }

  return prompt;
}
