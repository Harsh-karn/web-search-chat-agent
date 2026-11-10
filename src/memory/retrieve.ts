import {
  getMessagesByDateRange,
  getMessagesByKeyword,
  getSourcesForMessage,
  MessageRecord,
  SourceRecord,
} from "./db";
import { resolveTemporal, TemporalResolution } from "./temporal";

export type RetrievalStatus =
  "FOUND" | "NO_HISTORY_FOUND" | "FOUND_BY_KEYWORD" | "NONE";

export interface RetrievedTurn {
  message: MessageRecord;
  sources?: SourceRecord[];
}

export interface RetrievalResult {
  status: RetrievalStatus;
  temporal: TemporalResolution;
  turns: RetrievedTurn[];
  topicFilter?: string;
  topicMatched?: boolean;
  explanation?: string;
}

const TEMPORAL_AND_STOP_WORDS = new Set([
  "the",
  "was",
  "did",
  "what",
  "that",
  "this",
  "asked",
  "tell",
  "about",
  "with",
  "from",
  "have",
  "we",
  "our",
  "for",
  "and",
  "you",
  "earlier",
  "tool",
  "tools",
  "can",
  "how",
  "why",
  "who",
  "today",
  "yesterday",
  "tomorrow",
  "still",
  "correct",
  "any",
  "them",
  "since",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "previously",
  "discussed",
  "question",
  "ask",
  "november",
  "october",
  "december",
  "january",
  "february",
  "march",
]);

export function retrieveHistory(
  userId: string,
  userMessage: string,
  options?: {
    referenceDate?: Date;
    timezone?: string;
  },
): RetrievalResult {
  const temporal = resolveTemporal(userMessage, options);
  const recall =
    /\b(did i ask|did we ask|asked|discussed|shortlisted|mentioned|previously|earlier|decide|decided|talk|answer|sources did you cite)\b/i.test(
      userMessage,
    );
  if (!recall) return { status: "NONE", temporal, turns: [] };

  // Extract explicit topic if user specified "about X" or "regarding X", ignoring date terms
  const topicMatch = userMessage
    .replace(temporal.rawText || "\0", "")
    .match(
      /\b(?:about|regarding|discussing)\s+([a-zA-Z0-9\s_-]+?)(?:\?|\.|\,|$|\b(?:has|did|is|have)\b)/i,
    );
  let explicitTopic: string | undefined = topicMatch
    ? topicMatch[1]
        .trim()
        .toLowerCase()
        .replace(/\s+(on|since|from)$/, "")
    : undefined;
  if (explicitTopic && TEMPORAL_AND_STOP_WORDS.has(explicitTopic)) {
    explicitTopic = undefined;
  }

  // 1. If date range was resolved: look up in SQLite by date range
  if (temporal.hasTemporalReference && temporal.range) {
    const rawMessages = getMessagesByDateRange(
      userId,
      temporal.range.startIso,
      temporal.range.endIso,
    );

    if (rawMessages.length > 0) {
      const turns: RetrievedTurn[] = rawMessages.map((msg) => ({
        message: msg,
        sources:
          msg.role === "assistant" ? getSourcesForMessage(msg.id) : undefined,
      }));

      // If an explicit non-temporal topic was specified (e.g. "about vector search"), check if turns match
      let topicMatched = true;
      if (explicitTopic && explicitTopic.length > 2) {
        topicMatched = turns.some((t) =>
          t.message.content.toLowerCase().includes(explicitTopic!),
        );
      }

      return {
        status: "FOUND",
        temporal,
        turns: topicMatched ? turns : [],
        topicFilter: explicitTopic,
        topicMatched,
        explanation: topicMatched
          ? `Found ${turns.length} message(s) from ${temporal.range.label}`
          : `Found messages on ${temporal.range.label}, but no mention of "${explicitTopic}"`,
      };
    }

    return {
      status: "NO_HISTORY_FOUND",
      temporal,
      turns: [],
      explanation: `No conversation history found for ${temporal.range.label} (${temporal.rawText || "specified date"}).`,
    };
  }

  // 2. Keyword lookup across past turns ONLY if user asks an explicit recall question
  const recallPatterns = [
    /what did i ask/i,
    /earlier we discussed/i,
    /as i mentioned/i,
    /previously/i,
    /did we talk about/i,
    /discussed earlier/i,
  ];

  const isRecallQuery = recall;

  if (isRecallQuery) {
    const candidateWords = userMessage
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !TEMPORAL_AND_STOP_WORDS.has(w));

    const searchTerms = explicitTopic
      ? [explicitTopic, ...candidateWords]
      : candidateWords;
    for (const word of searchTerms) {
      const matches = getMessagesByKeyword(userId, word, 5);
      if (matches.length > 0) {
        const turns: RetrievedTurn[] = matches.map((msg) => ({
          message: msg,
          sources:
            msg.role === "assistant" ? getSourcesForMessage(msg.id) : undefined,
        }));

        return {
          status: "FOUND_BY_KEYWORD",
          temporal,
          turns,
          topicFilter: word,
          topicMatched: true,
          explanation: `Found ${turns.length} relevant historical turn(s) for topic "${word}".`,
        };
      }
    }
  }

  return {
    status: "NO_HISTORY_FOUND",
    temporal,
    turns: [],
  };
}
