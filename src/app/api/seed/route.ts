import { NextRequest, NextResponse } from "next/server";
import { seedEvalData } from "../../../../evals/seed";

export async function POST(req: NextRequest) {
  try {
    const cookieUserId = req.cookies.get("chat_user_id")?.value;
    const headerUserId = req.headers.get("x-user-id");
    const userId = cookieUserId || headerUserId || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    seedEvalData(userId);

    const response = NextResponse.json({
      success: true,
      userId,
      message: "Seeded 5 CRM tools from Monday (Nov 9) and Postgres hosting from Nov 3 into your session memory.",
    });

    if (!cookieUserId) {
      response.headers.set(
        "Set-Cookie",
        `chat_user_id=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
      );
    }

    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to seed data" },
      { status: 500 }
    );
  }
}
