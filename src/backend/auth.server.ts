import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PublicUser, UserRole } from "@/lib/user-db.server";

type JwtPayload = { sub: number; role: UserRole; email: string; iat: number; exp: number };

function secret() {
  const value = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!value && process.env.NODE_ENV === "production")
    throw new Error("JWT_SECRET is required in production.");
  return value || "dev-only-change-this-secret";
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function issueAccessToken(user: PublicUser) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, role: user.role, email: user.email, iat: now, exp: now + 3600 * 24 } satisfies JwtPayload)}`;
  return `${unsigned}.${createHmac("sha256", secret()).update(unsigned).digest("base64url")}`;
}

export function readAccessToken(request: Request): JwtPayload | null {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const parts = token?.split(".");
  if (!parts || parts.length !== 3) return null;
  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(createHmac("sha256", secret()).update(unsigned).digest("base64url"));
  const actual = Buffer.from(parts[2]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as JwtPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

export function opaqueToken() {
  return randomBytes(32).toString("base64url");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
