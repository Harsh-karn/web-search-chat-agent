import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { runAgentTurn } from "@/agent/loop";
import { validTimezone } from "@/memory/temporal";
import { getRecentMessages } from "@/memory/db";
import { session } from "@/server/session";
export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({
  messages: z
    .array(
      z
        .object({
          content: z.string().trim().min(1).max(8000),
          role: z.enum(["user", "assistant"]),
        })
        .passthrough(),
    )
    .min(1)
    .max(100),
  timezone: z.string().max(100).refine(validTimezone).optional(),
  conversationId: z.string().uuid(),
});
const active = new Set<string>();
let windowStart = 0,
  count = 0;
const error = (message: string, status: number) =>
  Response.json({ error: message }, { status });
export async function POST(req: NextRequest) {
  let scope: string | undefined;
  try {
    if (
      req.headers.get("origin") &&
      req.headers.get("origin") !== new URL(req.url).origin
    )
      return error("Invalid origin", 403);
    const reader = req.body?.getReader();
    if (!reader) return error("Missing request", 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) {
        await reader.cancel();
        return error("Request too large", 413);
      }
      chunks.push(value);
    }
    const parsed = schema.safeParse(
      JSON.parse(Buffer.concat(chunks).toString()),
    );
    if (!parsed.success) return error("Invalid chat request", 400);
    const body = parsed.data;
    if (body.messages.at(-1)?.role !== "user")
      return error("Last message must be a user message", 400);
    const tz = req.headers.get("x-timezone") || body.timezone || "UTC";
    if (!validTimezone(tz)) return error("Invalid timezone", 400);
    const identity = session(req);
    scope = `${identity.id}:${body.conversationId}`;
    if (active.has(scope)) return error("A reply is already in progress", 409);
    if (Date.now() - windowStart > 60000) {
      windowStart = Date.now();
      count = 0;
    }
    if (count >= 30 || active.size >= 10)
      return error("Service busy; try again shortly", 429);
    count++;
    active.add(scope);
    const ownedScope = scope;
    const { streamResult } = runAgentTurn({
      userId: scope,
      messages: [
        {
          id: randomUUID(),
          role: "user",
          content: body.messages.at(-1)!.content,
        },
      ],
      timezone: tz,
      signal: req.signal,
      onDone: () => active.delete(ownedScope),
    });
    const response = streamResult.toDataStreamResponse({
      getErrorMessage: () =>
        "The response could not be completed. Please try again.",
    });
    response.headers.set("Set-Cookie", identity.cookie);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (e) {
    if (scope) active.delete(scope);
    return error(
      e instanceof SyntaxError ? "Invalid JSON" : "Unable to process request",
      e instanceof SyntaxError ? 400 : 500,
    );
  }
}
export async function GET(req: NextRequest) {
  const id = z
    .string()
    .uuid()
    .safeParse(req.nextUrl.searchParams.get("conversationId"));
  if (!id.success) return error("Invalid conversation", 400);
  try {
    const identity = session(req);
    return Response.json(
      {
        messages: getRecentMessages(`${identity.id}:${id.data}`, 20).map(
          (m) => ({ id: m.id, role: m.role, content: m.content }),
        ),
      },
      {
        headers: { "Set-Cookie": identity.cookie, "Cache-Control": "no-store" },
      },
    );
  } catch {
    return error("Unable to load conversation", 500);
  }
}
