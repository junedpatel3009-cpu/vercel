import { createAPIFileRoute } from "@tanstack/react-start/api";

import {
  clearGoogleStateCookie,
  createSessionCookie,
  readGoogleStateFromCookieHeader,
} from "@/lib/auth-session.server";
import { deriveNamesFromGoogleProfile, exchangeCodeForGoogleUser } from "@/lib/google-oauth.server";
import { findUserByEmail, recordUserLogin, upsertGoogleUser } from "@/lib/user-db.server";

function redirectTo(path: string, cookie: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: path,
      "Set-Cookie": cookie,
    },
  });
}

export const APIRoute = createAPIFileRoute("/api/auth/google/callback")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return redirectTo("/login?oauth=google_denied", clearGoogleStateCookie());
    }

    const savedState = readGoogleStateFromCookieHeader(request.headers.get("cookie"));

    if (!state || !code || !savedState || savedState.state !== state) {
      return redirectTo("/login?oauth=google_state_error", clearGoogleStateCookie());
    }

    try {
      const googleProfile = await exchangeCodeForGoogleUser(request, code);
      const { firstName, lastName } = deriveNamesFromGoogleProfile(googleProfile);
      const user = upsertGoogleUser({
        googleId: googleProfile.sub,
        email: googleProfile.email.trim().toLowerCase(),
        firstName,
        lastName,
        avatarUrl: googleProfile.picture ?? null,
      });
      const loginUser = findUserByEmail(user.email);

      if (!loginUser?.isActive) {
        return redirectTo("/login?oauth=account_disabled", clearGoogleStateCookie());
      }

      recordUserLogin(user.id);

      let finalDestination = savedState.returnTo || "/";
      if (user.role === "PROFESSIONAL" && finalDestination === "/") {
        const { getProfessionalProfileByUserId } = await import("@/lib/user-db.server");
        const proProfile = getProfessionalProfileByUserId(user.id);
        const isProfileComplete = !!(
          proProfile?.professionalCategory &&
          proProfile?.professionalCity &&
          proProfile?.professionalSkillsJson &&
          proProfile?.companyDescription &&
          proProfile?.address
        );

        if (!isProfileComplete) {
          finalDestination = "/professional-profile";
        }
      }

      const headers = new Headers({
        Location: finalDestination,
      });
      headers.append("Set-Cookie", clearGoogleStateCookie());
      headers.append("Set-Cookie", createSessionCookie(user));

      return new Response(null, {
        status: 302,
        headers,
      });
    } catch (cause) {
      console.error("Google OAuth callback failed:", cause);
      return redirectTo("/login?oauth=google_failed", clearGoogleStateCookie());
    }
  },
});
