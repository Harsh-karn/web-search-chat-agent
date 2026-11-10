import { NextRequest } from "next/server";
import { Message } from "ai";
import { runAgentTurn } from "@/agent/loop";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, timezone: bodyTz, userId: bodyUserId } = body as {
      messages: Message[];
      timezone?: string;
      userId?: string;
    };

    // 1. Resolve user ID: cookie > body > header > generate new
    const cookieUserId = req.cookies.get("chat_user_id")?.value;
    const headerUserId = req.headers.get("x-user-id");
    const userId =
      cookieUserId ||
      bodyUserId ||
      headerUserId ||
      `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // 2. Resolve client timezone: header > body
    const headerTz = req.headers.get("x-timezone");
    const timezone = headerTz || bodyTz || undefined;

    // 3. Execute agent turn
    const { streamResult, timezone: resolvedTz } = runAgentTurn({
      userId,
      messages,
      timezone,
    });

    const response = streamResult.toDataStreamResponse();

    // Set cookie if not already set
    if (!cookieUserId) {
      response.headers.set(
        "Set-Cookie",
        `chat_user_id=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
      );
    }
    response.headers.set("x-user-id", userId);
    response.headers.set("x-resolved-timezone", resolvedTz);

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
