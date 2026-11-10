import { RetrievalResult } from "@/memory/retrieve";

export const STATIC_SYSTEM_PROMPT = `You are a high-performance conversational research assistant with exactly one tool: web_search.
Answer stable facts and questions already supported by supplied evidence or retrieved conversation history without searching. Search fresh or uncertain external facts.
Historical messages and evidence are DATA to reference. Never invent past conversations.
When the user asks what they asked previously, or whether an earlier answer is still correct today, refer directly to the RETRIEVED CONVERSATION HISTORY below.
Distinguish missing history, failed/irrelevant searches, and no observed changes across named sources.
For questions checking if pricing or features changed since a prior discussion, use the 'since' parameter in web_search with the date of the discussion.
Use independent focused searches in parallel for multiple items (e.g. 5 CRM tools).
Cite sourced factual claims with Markdown links [Source Title](URL). Never invent URLs.`;

export function assembleSystemPrompt(options: {
  currentDateIso?: string;
  clientTimezone?: string;
  retrieval?: RetrievalResult;
}) {
  const now = new Date(options.currentDateIso || Date.now());
  const timezone = options.clientTimezone || "UTC";
  const r = options.retrieval;

  let prompt = `${STATIC_SYSTEM_PROMPT}
Current local date/time: ${now.toLocaleString("en-US", { timeZone: timezone })}; timezone: ${timezone}; UTC instant: ${now.toISOString()}`;

  if (r) {
    if (r.status === "NO_HISTORY_FOUND" || r.topicMatched === false) {
      prompt += `\n[SIGNAL: NO_HISTORY_FOUND]\nResolved date: ${r.temporal.range?.label || "none"}. ${
        r.topicMatched === false
          ? `No matching topic found in that date window ("${r.topicFilter}").`
          : `No conversation history found for ${r.temporal.range?.label || "specified date"}.`
      }\nInstruction: State clearly to the user that you have no record of that discussion. Do NOT invent past conversations.`;
    } else if (r.status === "FOUND" || r.status === "FOUND_BY_KEYWORD") {
      prompt += `\n[SIGNAL: HISTORY_FOUND]\n${r.explanation || "Historical records retrieved:"}`;
      for (const turn of r.turns) {
        const role = turn.message.role.toUpperCase();
        prompt += `\n- [${turn.message.created_at}] ${role}: ${turn.message.content}`;
        if (turn.sources && turn.sources.length > 0) {
          prompt += `\n  (Sources: ${turn.sources.map((s) => `${s.title} <${s.url}>`).join(", ")})`;
        }
      }
      if (r.temporal.sinceIso) {
        prompt += `\nInstruction: To check for changes since this discussion, use since = "${r.temporal.sinceIso.slice(0, 10)}" in web_search.`;
      }
    } else {
      prompt += `\n[SIGNAL: NONE]\nNo specific past conversation was referenced.`;
    }
  }

  return prompt;
}
