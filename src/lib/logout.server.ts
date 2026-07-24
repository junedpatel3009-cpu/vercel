import { createServerFn } from "@tanstack/react-start";
import { getResponse } from "@tanstack/react-start/server";
import { clearSessionCookie } from "@/lib/auth-session.server";

export const logoutAction = createServerFn({ method: "POST" }).handler(async () => {
  const response = getResponse();
  response.headers.set("Set-Cookie", clearSessionCookie());
  return { ok: true as const };
});
