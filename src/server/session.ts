import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { NextRequest } from "next/server";
const devFallbackSecret = "dev-chat-agent-secret-key-32-chars-min-pad-development-only";
function secret() {
  const value = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32))
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  return value || devFallbackSecret;
}
export function signSession(id: string) {
  return `${id}.${createHmac("sha256", secret()).update(id).digest("hex")}`;
}
export function verifySession(token?: string): string | undefined {
  if (!token || !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(token)) return;
  const [id] = token.split(".");
  return timingSafeEqual(Buffer.from(token), Buffer.from(signSession(id)))
    ? id
    : undefined;
}
export function session(req: NextRequest) {
  const id =
    verifySession(req.cookies.get("chat_session")?.value) || randomUUID();
  return {
    id,
    cookie: `chat_session=${signSession(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  };
}
