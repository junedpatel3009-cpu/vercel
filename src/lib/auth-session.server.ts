import { createHmac, timingSafeEqual } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";

import type { PublicUser, UserRole } from "@/lib/user-db.server";

const SESSION_COOKIE_NAME = "servio_session";
const GOOGLE_STATE_COOKIE_NAME = "servio_google_state";
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const THIRTY_DAYS_IN_SECONDS = ONE_DAY_IN_SECONDS * 30;

type SessionPayload = {
  userId: number;
  email: string;
  role: UserRole;
  exp: number;
};

type GoogleStatePayload = {
  state: string;
  returnTo: string;
  exp: number;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required to sign login sessions.");
  }

  return "dev-only-change-this-secret";
}

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url<T>(input: string) {
  return JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as T;
}

function signValue(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function encodeSignedPayload(payload: object) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeSignedPayload<T>(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [encodedPayload, providedSignature] = value.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  return fromBase64Url<T>(encodedPayload);
}

function shouldUseSecureCookie() {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  try {
    const request = getRequest();
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const requestUrl = new URL(request.url);

    return forwardedProto === "https" || requestUrl.protocol === "https:";
  } catch {
    return true;
  }
}

function serializeCookie(name: string, value: string, maxAge: number) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];

  if (shouldUseSecureCookie()) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function createSessionCookie(user: PublicUser) {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + THIRTY_DAYS_IN_SECONDS * 1000,
  };

  return serializeCookie(SESSION_COOKIE_NAME, encodeSignedPayload(payload), THIRTY_DAYS_IN_SECONDS);
}

export function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE_NAME, "", 0);
}

export function createGoogleStateCookie(state: string, returnTo: string) {
  const payload: GoogleStatePayload = {
    state,
    returnTo,
    exp: Date.now() + 10 * 60 * 1000,
  };

  return serializeCookie(GOOGLE_STATE_COOKIE_NAME, encodeSignedPayload(payload), 10 * 60);
}

export function clearGoogleStateCookie() {
  return serializeCookie(GOOGLE_STATE_COOKIE_NAME, "", 0);
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const match = cookies.find((entry) => entry.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export function readSessionFromCookieHeader(cookieHeader: string | null) {
  const cookieValue = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  const payload = decodeSignedPayload<SessionPayload>(cookieValue);

  if (!payload || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export function readGoogleStateFromCookieHeader(cookieHeader: string | null) {
  const cookieValue = getCookieValue(cookieHeader, GOOGLE_STATE_COOKIE_NAME);
  const payload = decodeSignedPayload<GoogleStatePayload>(cookieValue);

  if (!payload || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}
