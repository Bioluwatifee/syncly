import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, isSameOriginMutation } from "@/lib/security";
import {
  clearPlatformSession,
  ensureSessionId,
  getPlatformSession,
  getSessionIdFromRequest,
  setPlatformSession,
} from "@/lib/oauth-session";

export const dynamic = "force-dynamic";

type SupportedPlatform = "spotify" | "youtube";
const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-private",
  "user-read-email",
  "user-library-read",
].join(" ");

const AUTH_CONNECT_RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const AUTH_DISCONNECT_RATE_LIMIT = { limit: 20, windowMs: 60_000 };

const COOKIE_CONFIG = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

const tokenCookieNames = {
  spotify: {
    access: "syncly_spotify_access_token",
    refresh: "syncly_spotify_refresh_token",
    expiresAt: "syncly_spotify_expires_at",
  },
  youtube: {
    access: "syncly_youtube_access_token",
    refresh: "syncly_youtube_refresh_token",
    expiresAt: "syncly_youtube_expires_at",
  },
};

function sanitizeReturnPath(raw: string | null): string {
  if (!raw) {
    return "/transfer";
  }

  try {
    const parsed = new URL(raw, "https://syncly.local");
    const isAllowedPath =
      parsed.pathname === "/transfer" || parsed.pathname.startsWith("/transfer/");

    if (!isAllowedPath) {
      return "/transfer";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/transfer";
  }
}

function parsePlatform(raw: string | null): SupportedPlatform | null {
  if (raw === "spotify" || raw === "youtube") {
    return raw;
  }
  return null;
}

function encodeState(payload: Record<string, string>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeState(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, string>;
  } catch {
    return null;
  }
}

function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
}

function getAppOriginForRedirect(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:3000";
  }
  return request.nextUrl.origin;
}

function withAuthResultPath(request: NextRequest, returnPath: string, authValue: string, reason?: string): URL {
  // In development, force a single canonical origin to avoid localhost/127 split-brain.
  const redirectUrl = new URL(returnPath, getAppOriginForRedirect(request));
  redirectUrl.searchParams.set("auth", authValue);
  if (reason) {
    redirectUrl.searchParams.set("reason", reason);
  }
  return redirectUrl;
}

function setTokenCookies(
  response: NextResponse,
  request: NextRequest,
  platform: SupportedPlatform,
  accessToken: string,
  refreshToken: string | undefined,
  expiresInSeconds: number
) {
  const secure = isSecure(request);
  const names = tokenCookieNames[platform];
  const expiresAt = (Date.now() + expiresInSeconds * 1000).toString();

  response.cookies.set(names.access, accessToken, { ...COOKIE_CONFIG, secure, maxAge: expiresInSeconds });
  response.cookies.set(names.expiresAt, expiresAt, { ...COOKIE_CONFIG, secure, maxAge: expiresInSeconds });

  if (refreshToken) {
    response.cookies.set(names.refresh, refreshToken, { ...COOKIE_CONFIG, secure, maxAge: 60 * 60 * 24 * 90 });
  } else {
    response.cookies.set(names.refresh, "", { ...COOKIE_CONFIG, secure, maxAge: 0 });
  }
}

function clearOauthStateCookie(response: NextResponse, request: NextRequest, platform: SupportedPlatform) {
  response.cookies.set(`syncly_oauth_state_${platform}`, "", {
    ...COOKIE_CONFIG,
    secure: isSecure(request),
    maxAge: 0,
  });
}

function clearTokenCookies(response: NextResponse, request: NextRequest, platform: SupportedPlatform) {
  const secure = isSecure(request);
  const names = tokenCookieNames[platform];

  response.cookies.set(names.access, "", { ...COOKIE_CONFIG, secure, maxAge: 0 });
  response.cookies.set(names.refresh, "", { ...COOKIE_CONFIG, secure, maxAge: 0 });
  response.cookies.set(names.expiresAt, "", { ...COOKIE_CONFIG, secure, maxAge: 0 });
  clearOauthStateCookie(response, request, platform);
}

async function beginOAuthFlow(
  request: NextRequest,
  platform: SupportedPlatform,
  returnPath: string,
  options?: { forceDialog?: boolean }
): Promise<NextResponse> {
  const nonce = randomUUID();
  const state = encodeState({ nonce, platform, returnPath });
  const secure = isSecure(request);

  if (platform === "spotify") {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return NextResponse.json({ error: "Spotify OAuth environment variables are missing." }, { status: 500 });
    }

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", SPOTIFY_SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    if (options?.forceDialog || process.env.NODE_ENV !== "production") {
      authUrl.searchParams.set("show_dialog", "true");
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[auth:spotify] oauth authorize request", {
        requestedScopes: SPOTIFY_SCOPES,
        authorizationUrl: authUrl.toString(),
        redirectUri,
        appOrigin: getAppOriginForRedirect(request),
      });
    }

    const response = NextResponse.redirect(authUrl);
    // Always start Spotify OAuth from a clean local cookie state to avoid stale
    // token/nonce loops after account switches or expired sessions.
    clearTokenCookies(response, request, "spotify");
    response.cookies.set(`syncly_oauth_state_${platform}`, nonce, {
      ...COOKIE_CONFIG,
      secure,
      maxAge: 60 * 10,
    });
    return response;
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "YouTube OAuth environment variables are missing." }, { status: 500 });
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube"
  );
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(`syncly_oauth_state_${platform}`, nonce, {
    ...COOKIE_CONFIG,
    secure,
    maxAge: 60 * 10,
  });
  return response;
}

type OAuthTokenExchangeResult = {
  accessToken: string;
  refreshToken: string | undefined;
  expiresIn: number;
  scope?: string;
};

async function exchangeSpotifyCodeForToken(code: string): Promise<OAuthTokenExchangeResult> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Spotify OAuth environment variables are missing.");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Spotify token exchange failed: ${details}`);
  }

  const payload = await response.json();
  return {
    accessToken: payload.access_token as string,
    refreshToken: payload.refresh_token as string | undefined,
    expiresIn: payload.expires_in as number,
    scope: payload.scope as string | undefined,
  };
}

async function exchangeYouTubeCodeForToken(code: string): Promise<OAuthTokenExchangeResult> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("YouTube OAuth environment variables are missing.");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`YouTube token exchange failed: ${details}`);
  }

  const payload = await response.json();
  return {
    accessToken: payload.access_token as string,
    refreshToken: payload.refresh_token as string | undefined,
    expiresIn: payload.expires_in as number,
    scope: payload.scope as string | undefined,
  };
}

export async function completeOAuthFlow(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const statePayload = decodeState(request.nextUrl.searchParams.get("state"));
  const fallbackPath = sanitizeReturnPath(request.nextUrl.searchParams.get("returnTo"));
  const error = request.nextUrl.searchParams.get("error");

  const platform = parsePlatform(request.nextUrl.searchParams.get("platform")) ?? parsePlatform(statePayload?.platform ?? null);
  const returnPath = sanitizeReturnPath(statePayload?.returnPath ?? fallbackPath);

  if (!platform) {
    return NextResponse.redirect(withAuthResultPath(request, returnPath, "unknown_error", "invalid_platform"));
  }

  const stateCookieName = `syncly_oauth_state_${platform}`;
  const expectedNonce = request.cookies.get(stateCookieName)?.value;
  const receivedNonce = statePayload?.nonce;

  if (!expectedNonce || !receivedNonce || expectedNonce !== receivedNonce) {
    const response = NextResponse.redirect(withAuthResultPath(request, returnPath, `${platform}_error`, "invalid_state"));
    clearOauthStateCookie(response, request, platform);
    return response;
  }

  if (error) {
    const response = NextResponse.redirect(withAuthResultPath(request, returnPath, `${platform}_error`, error));
    clearOauthStateCookie(response, request, platform);
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(withAuthResultPath(request, returnPath, `${platform}_error`, "missing_code"));
    clearOauthStateCookie(response, request, platform);
    return response;
  }

  try {
    const tokenPayload = platform === "spotify"
      ? await exchangeSpotifyCodeForToken(code)
      : await exchangeYouTubeCodeForToken(code);

    if (platform === "spotify") {
      console.log("[auth:spotify:callback] granted scopes:", {
        scope: tokenPayload.scope ?? "",
      });
    }

    const response = NextResponse.redirect(withAuthResultPath(request, returnPath, `${platform}_success`));
    const sessionId = ensureSessionId(request, response);
    if (platform === "spotify" && sessionId) {
      // Replace any prior Spotify session/token state before writing the fresh callback token.
      clearPlatformSession(sessionId, "spotify");
    }
    setTokenCookies(
      response,
      request,
      platform,
      tokenPayload.accessToken,
      tokenPayload.refreshToken,
      tokenPayload.expiresIn
    );
    setPlatformSession(sessionId, platform, {
      accessToken: tokenPayload.accessToken,
      refreshToken: tokenPayload.refreshToken,
      expiresAt: Date.now() + tokenPayload.expiresIn * 1000,
      grantedScopes: platform === "spotify" ? (tokenPayload.scope ?? "") : undefined,
    });
    if (platform === "spotify") {
      console.log("[auth:spotify:callback] stored token snapshot:", {
        accessTokenPrefix: tokenPayload.accessToken.slice(0, 20),
        accessTokenLength: tokenPayload.accessToken.length,
        refreshTokenPresent: Boolean(tokenPayload.refreshToken),
        grantedScopes: tokenPayload.scope ?? "",
      });
    }
    clearOauthStateCookie(response, request, platform);
    return response;
  } catch (exchangeError) {
    const response = NextResponse.redirect(withAuthResultPath(request, returnPath, `${platform}_error`, "token_exchange_failed"));
    clearOauthStateCookie(response, request, platform);
    return response;
  }
}

function getConnectionStatus(request: NextRequest) {
  const sessionId = getSessionIdFromRequest(request);
  const spotifyServerSession = sessionId ? getPlatformSession(sessionId, "spotify") : null;
  const youtubeServerSession = sessionId ? getPlatformSession(sessionId, "youtube") : null;
  const spotifyAccess = request.cookies.get(tokenCookieNames.spotify.access)?.value;
  const spotifyRefresh = request.cookies.get(tokenCookieNames.spotify.refresh)?.value;
  const spotifyExpiresAtRaw = request.cookies.get(tokenCookieNames.spotify.expiresAt)?.value;
  const youtubeAccess = request.cookies.get(tokenCookieNames.youtube.access)?.value;
  const youtubeRefresh = request.cookies.get(tokenCookieNames.youtube.refresh)?.value;
  const youtubeExpiresAtRaw = request.cookies.get(tokenCookieNames.youtube.expiresAt)?.value;

  const spotifyExpiresAt = spotifyExpiresAtRaw ? Number(spotifyExpiresAtRaw) : 0;
  const youtubeExpiresAt = youtubeExpiresAtRaw ? Number(youtubeExpiresAtRaw) : 0;
  const now = Date.now();

  if (process.env.NODE_ENV !== "production") {
    console.log("[auth:status]", {
      host: getAppOriginForRedirect(request),
      requestHost: request.nextUrl.host,
      spotifyAccessPresent: Boolean(spotifyAccess),
      spotifyRefreshPresent: Boolean(spotifyRefresh),
      spotifyExpiresAt,
      spotifyExpiresInSec: spotifyExpiresAt ? Math.floor((spotifyExpiresAt - now) / 1000) : null,
      youtubeAccessPresent: Boolean(youtubeAccess),
      youtubeRefreshPresent: Boolean(youtubeRefresh),
      youtubeExpiresAt,
      youtubeExpiresInSec: youtubeExpiresAt ? Math.floor((youtubeExpiresAt - now) / 1000) : null,
    });
  }

  const spotifyConnected = Boolean(
    spotifyServerSession?.accessToken ||
      spotifyServerSession?.refreshToken ||
      spotifyAccess ||
      spotifyRefresh
  );
  const youtubeConnected = Boolean(
    youtubeServerSession?.accessToken ||
      youtubeServerSession?.refreshToken ||
      youtubeAccess ||
      youtubeRefresh
  );

  return {
    spotifyConnected,
    youtubeConnected,
    debug: process.env.NODE_ENV !== "production"
      ? {
          host: request.nextUrl.host,
          spotifyAccessPresent: Boolean(spotifyAccess),
          spotifyRefreshPresent: Boolean(spotifyRefresh),
          spotifyExpiresAt,
          spotifyExpiresInSec: spotifyExpiresAt ? Math.floor((spotifyExpiresAt - now) / 1000) : null,
          youtubeAccessPresent: Boolean(youtubeAccess),
          youtubeRefreshPresent: Boolean(youtubeRefresh),
          youtubeExpiresAt,
          youtubeExpiresInSec: youtubeExpiresAt ? Math.floor((youtubeExpiresAt - now) / 1000) : null,
        }
      : undefined,
  };
}

function disconnectPlatform(request: NextRequest, platform: SupportedPlatform | "all") {
  const response = NextResponse.json({ disconnected: platform });
  const sessionId = getSessionIdFromRequest(request);

  if (platform === "all") {
    clearTokenCookies(response, request, "spotify");
    clearTokenCookies(response, request, "youtube");
    if (sessionId) clearPlatformSession(sessionId, "all");
    return response;
  }

  clearTokenCookies(response, request, platform);
  if (sessionId) clearPlatformSession(sessionId, platform);
  return response;
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  if (action === "status") {
    return NextResponse.json(getConnectionStatus(request));
  }

  if (action === "connect") {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`auth:connect:${ip}`, AUTH_CONNECT_RATE_LIMIT.limit, AUTH_CONNECT_RATE_LIMIT.windowMs);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many authentication attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const platform = parsePlatform(request.nextUrl.searchParams.get("platform"));
    const returnPath = sanitizeReturnPath(request.nextUrl.searchParams.get("returnTo"));
    const forceDialog = request.nextUrl.searchParams.get("forceDialog") === "1";
    if (!platform) {
      return NextResponse.json({ error: "Please provide platform=spotify or platform=youtube." }, { status: 400 });
    }
    return beginOAuthFlow(request, platform, returnPath, { forceDialog });
  }

  if (request.nextUrl.searchParams.has("code") || request.nextUrl.searchParams.has("error")) {
    return completeOAuthFlow(request);
  }

  return NextResponse.json({
    message: "Use action=connect to start OAuth or action=status to read connection state.",
  });
}

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  if (action !== "disconnect") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(`auth:disconnect:${ip}`, AUTH_DISCONNECT_RATE_LIMIT.limit, AUTH_DISCONNECT_RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many disconnect attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const requestedPlatform = request.nextUrl.searchParams.get("platform");
  const platform = requestedPlatform === "all" ? "all" : parsePlatform(requestedPlatform);
  if (!platform) {
    return NextResponse.json(
      { error: "Please provide platform=spotify, platform=youtube, or platform=all." },
      { status: 400 }
    );
  }

  return disconnectPlatform(request, platform);
}
