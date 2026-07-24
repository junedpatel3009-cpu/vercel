type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  id_token?: string;
  scope?: string;
  token_type: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
};

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for Google OAuth.");
  }

  return { clientId, clientSecret };
}

export function getAppBaseUrl(request: Request) {
  return process.env.APP_URL?.trim() || new URL(request.url).origin;
}

export function getGoogleCallbackUrl(request: Request) {
  return `${getAppBaseUrl(request)}/api/auth/google/callback`;
}

export function buildGoogleAuthorizationUrl(request: Request, state: string) {
  const { clientId } = getGoogleCredentials();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getGoogleCallbackUrl(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("nonce", state);

  return url.toString();
}

export async function exchangeCodeForGoogleUser(request: Request, code: string) {
  const { clientId, clientSecret } = getGoogleCredentials();

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getGoogleCallbackUrl(request),
    }),
  });

  if (!tokenResponse.ok) {
    const failureBody = await tokenResponse.text();
    throw new Error(`Google token exchange failed: ${failureBody}`);
  }

  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
  const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      authorization: `Bearer ${tokenPayload.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    const failureBody = await userInfoResponse.text();
    throw new Error(`Google user info request failed: ${failureBody}`);
  }

  const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;

  if (!userInfo.email || userInfo.email_verified === false) {
    throw new Error("Google account must have a verified email address.");
  }

  return userInfo;
}

export function deriveNamesFromGoogleProfile(profile: GoogleUserInfo) {
  if (profile.given_name && profile.family_name) {
    return {
      firstName: profile.given_name.trim(),
      lastName: profile.family_name.trim(),
    };
  }

  if (profile.name) {
    const [firstName, ...rest] = profile.name.trim().split(/\s+/);
    return {
      firstName: firstName || "Google",
      lastName: rest.join(" ") || "User",
    };
  }

  return {
    firstName: "Google",
    lastName: "User",
  };
}
