import { getRequest } from "@tanstack/react-start/server";

import { readSessionFromCookieHeader } from "@/lib/auth-session.server";
import { findUserById, type PublicUser, type UserRole } from "@/lib/user-db.server";

export function getCurrentUser() {
  const request = getRequest();
  const session = readSessionFromCookieHeader(request.headers.get("cookie"));

  if (!session) {
    return null;
  }

  return findUserById(session.userId) ?? null;
}

export function requireCurrentUser() {
  const user = getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export function requireCurrentUserRole(role: UserRole): PublicUser {
  const user = requireCurrentUser();

  if (user.role !== role) {
    throw new Error("You do not have permission to access this page.");
  }

  return user;
}
