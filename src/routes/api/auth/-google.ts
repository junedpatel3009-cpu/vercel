import { randomBytes } from "node:crypto";
import { createAPIFileRoute } from "@tanstack/react-start/api";

import { createGoogleStateCookie } from "@/lib/auth-session.server";
import { buildGoogleAuthorizationUrl } from "@/lib/google-oauth.server";

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export const APIRoute = createAPIFileRoute("/api/auth/google")({
  GET: async ({ request }) => {
    const requestUrl = new URL(request.url);
    const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));
    const state = randomBytes(24).toString("hex");
    const redirectUrl = buildGoogleAuthorizationUrl(request, state);

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        "Set-Cookie": createGoogleStateCookie(state, returnTo),
      },
    });
  },
});
