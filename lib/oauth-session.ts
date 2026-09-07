import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export type OAuthPlatform = "spotify" | "youtube";

type PlatformSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  grantedScopes?: string;
};

type UserOAuthSession = {
  spotify?: PlatformSession;
  youtube?: PlatformSession;
};

const SESSION_COOKIE = "syncly_session_id";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;
const sessions = new Map<string, UserOAuthSession>();

function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
}

export function getSessionIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export function ensureSessionId(request: NextRequest, response: NextResponse): string {
  const existing = getSessionIdFromRequest(request);
  if (existing) return existing;

  const created = randomUUID();
  response.cookies.set(SESSION_COOKIE, created, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure(request),
    maxAge: SESSION_TTL_SECONDS,
  });
  return created;
}

/**
 * Drops the session-id cookie itself.
 *
 * `sessions` is an in-process Map, so on serverless it only ever holds entries
 * for the instance that handled the OAuth callback. Clearing the platform entry
 * on the instance that happens to serve the disconnect request is therefore not
 * enough — another warm instance can still hold tokens under the same session
 * id and report "connected". Rotating the session id orphans every such entry,
 * so there is nothing left for a status check to restore from.
 */
export function clearSessionCookie(request: NextRequest, response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure(request),
    maxAge: 0,
  });
}

export function setPlatformSession(
  sessionId: string,
  platform: OAuthPlatform,
  session: PlatformSession
) {
  const existing = sessions.get(sessionId) ?? {};
  existing[platform] = session;
  sessions.set(sessionId, existing);
}

export function getPlatformSession(sessionId: string, platform: OAuthPlatform): PlatformSession | null {
  const existing = sessions.get(sessionId);
  if (!existing) return null;
  return existing[platform] ?? null;
}

export function clearPlatformSession(sessionId: string, platform: OAuthPlatform | "all") {
  const existing = sessions.get(sessionId);
  if (!existing) return;

  if (platform === "all") {
    sessions.delete(sessionId);
    return;
  }

  delete existing[platform];
  if (!existing.spotify && !existing.youtube) {
    sessions.delete(sessionId);
    return;
  }
  sessions.set(sessionId, existing);
}
