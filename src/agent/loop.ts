import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool, Message } from "ai";
import { z } from "zod";
import { executeWebSearch } from "./search";
import { assembleSystemPrompt } from "./prompt";
import { retrieveHistory, RetrievalResult } from "@/memory/retrieve";
import { saveMessage, saveSources, ensureUser, getUserTimezone } from "@/memory/db";

export interface AgentTurnOptions {
  userId: string;
  messages: Message[];
  timezone?: string;
  onToolCall?: (query: string, since?: string) => void;
  onToolResult?: (query: string, resultsCount: number) => void;
}

/**
 * Core agent loop managing:
 * 1. Harness-side temporal & historical context assembly
 * 2. Streaming LLM invocation with single web_search tool (Google Gemini 2.5 Flash)
 * 3. Concurrent tool execution & bounded reasoning rounds (≤3)
 * 4. Post-response turn & citation persistence into SQLite
 */
export function runAgentTurn(options: AgentTurnOptions) {
  const { userId, messages, timezone: explicitTz } = options;

  // Resolve timezone: explicit > persisted in DB > DEFAULT_TIMEZONE > UTC
  const storedTz = getUserTimezone(userId);
  const timezone = explicitTz || storedTz || process.env.DEFAULT_TIMEZONE || "UTC";

  // Persist user and updated timezone
  ensureUser(userId, timezone);

  // Extract last user turn
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userQuery = lastUserMessage?.content || "";
  const userMessageId =
    lastUserMessage?.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Save incoming user message
  saveMessage({
    id: userMessageId,
    userId,
    role: "user",
    content: userQuery,
    createdAt: new Date().toISOString(),
  });

  // Harness-side deterministic date resolution and history retrieval
  const retrieval = retrieveHistory(userId, userQuery, {
    referenceDate: new Date(),
    timezone,
  });

  // Assemble system prompt with current date/time/timezone + retrieved memory
  const systemPrompt = assembleSystemPrompt({
    currentDateIso: new Date().toISOString(),
    clientTimezone: timezone,
    retrieval,
  });

  // Track sources collected across tool executions for turn persistence
  const collectedSources: Array<{
    url: string;
    title: string;
    publishedAt?: string;
  }> = [];

  const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Configure Google provider with GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY
  const googleProvider = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // Initialize streaming with Google Gemini & single web_search tool
  const streamResult = streamText({
    model: googleProvider(modelName),
    system: systemPrompt,
    messages,
    maxSteps: 3, // Bounded rounds
    tools: {
      web_search: tool({
        description:
          "Search the web for current information, pricing, changes, and documentation. Supports time-bounded queries via since parameter.",
        parameters: z.object({
          query: z.string().describe("Search query string (be specific)"),
          since: z
            .string()
            .optional()
            .describe("ISO date (YYYY-MM-DD) to check for information/changes since that date"),
          recency: z
            .enum(["day", "week", "month", "year"])
            .optional()
            .describe("Optional time window filter"),
        }),
        execute: async ({ query, since, recency }) => {
          options.onToolCall?.(query, since);

          const searchRes = await executeWebSearch({
            query,
            since,
            recency,
          });

          if (searchRes.results && searchRes.results.length > 0) {
            for (const item of searchRes.results) {
              if (item.url) {
                collectedSources.push({
                  url: item.url,
                  title: item.title,
                  publishedAt: item.publishedDate,
                });
              }
            }
          }

          options.onToolResult?.(query, searchRes.results.length);

          return {
            query: searchRes.query,
            since: searchRes.since,
            resultsCount: searchRes.results.length,
            results: searchRes.results,
            error: searchRes.error,
          };
        },
      }),
    },
    onFinish: async ({ text }) => {
      // Persist assistant message
      saveMessage({
        id: assistantMessageId,
        userId,
        role: "assistant",
        content: text,
        createdAt: new Date().toISOString(),
      });

      // Persist cited sources
      if (collectedSources.length > 0) {
        saveSources(
          collectedSources.map((s) => ({
            messageId: assistantMessageId,
            url: s.url,
            title: s.title,
            publishedAt: s.publishedAt,
          }))
        );
      }
    },
  });

  return {
    userId,
    timezone,
    retrieval,
    streamResult,
  };
}
