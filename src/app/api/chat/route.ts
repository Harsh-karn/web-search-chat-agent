import { google } from "@ai-sdk/google";
import { streamText, tool, Message } from "ai";
import { z } from "zod";
import { executeWebSearch } from "@/agent/search";
import { assembleSystemPrompt } from "@/agent/prompt";
import { retrieveHistory } from "@/memory/retrieve";
import { saveMessage, saveSources, ensureUser } from "@/memory/db";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, timezone: bodyTz, userId: bodyUserId } = body as {
      messages: Message[];
      timezone?: string;
      userId?: string;
    };

    // 1. Identify user (cookie > body > header > generate new)
    const cookieUserId = req.cookies.get("chat_user_id")?.value;
    const headerUserId = req.headers.get("x-user-id");
    const userId = cookieUserId || bodyUserId || headerUserId || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // 2. Identify timezone (header > body > fallback UTC)
    const headerTz = req.headers.get("x-timezone");
    const timezone = headerTz || bodyTz || process.env.DEFAULT_TIMEZONE || "UTC";

    ensureUser(userId, timezone);

    // Get the latest user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const userQuery = lastUserMessage?.content || "";
    const userMessageId = lastUserMessage?.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Persist incoming user message
    saveMessage({
      id: userMessageId,
      userId,
      role: "user",
      content: userQuery,
      createdAt: new Date().toISOString(),
    });

    // 3. Harness-side deterministic date resolution and history retrieval
    const retrieval = retrieveHistory(userId, userQuery, {
      referenceDate: new Date(),
      timezone,
    });

    // 4. Assemble system prompt with current date/time/timezone + retrieved memory
    const systemPrompt = assembleSystemPrompt({
      currentDateIso: new Date().toISOString(),
      clientTimezone: timezone,
      retrieval,
    });

    // Track sources collected during tool calls to persist with assistant response
    const collectedSources: Array<{
      url: string;
      title: string;
      publishedAt?: string;
    }> = [];

    const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 5. Streaming agent loop with Google Gemini 2.0 Flash and single web_search tool
    const result = streamText({
      model: google("gemini-2.0-flash"),
      system: systemPrompt,
      messages,
      maxSteps: 3, // Bounded agent loop (≤3 rounds)
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

    const response = result.toDataStreamResponse();
    // Set user cookie if not present
    if (!cookieUserId) {
      response.headers.set(
        "Set-Cookie",
        `chat_user_id=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
      );
    }
    response.headers.set("x-user-id", userId);

    return response;
  } catch (err: unknown) {
    console.error("Error in /api/chat route:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
