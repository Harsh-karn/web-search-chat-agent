import { NextRequest } from "next/server";
import { z } from "zod";
import { session } from "@/server/session";
import { seedEvalData } from "../../../../evals/seed";

const schema = z.object({
  conversationId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const identity = session(req);
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid conversationId" },
        { status: 400 },
      );
    }
    const scope = `${identity.id}:${parsed.data.conversationId}`;
    seedEvalData(scope);
    return Response.json(
      {
        success: true,
        message:
          "Seeded 5 CRM tools from Monday (Nov 9) and Postgres hosting from Nov 3 into your session memory.",
      },
      {
        headers: { "Set-Cookie": identity.cookie, "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      { error: "Unable to seed session data" },
      { status: 500 },
    );
  }
}
