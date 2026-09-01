import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security";
import {
  clearPlatformSession,
  getPlatformSession,
  getSessionIdFromRequest,
  setPlatformSession,
} from "@/lib/oauth-session";

export const dynamic = "force-dynamic";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const REQUEST_TIMEOUT_MS = 10_000;
const SPOTIFY_RATE_LIMIT = { limit: 45, windowMs: 60_000 };

const spotifyCookies = {
  access: "syncly_spotify_access_token",
  refresh: "syncly_spotify_refresh_token",
  expiresAt: "syncly_spotify_expires_at",
};

function getCanonicalAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:3000";
  }
  return "http://127.0.0.1:3000";
}

function getCanonicalHostLabel(): string {
  try {
    return new URL(getCanonicalAppOrigin()).host;
  } catch {
    return "127.0.0.1:3000";
  }
}

class UpstreamApiError extends Error {
  status: number;
  retryAfterSec?: number;
  reason?: string;

  constructor(message: string, status: number, retryAfterSec?: number, reason?: string) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
    this.reason = reason;
  }
}

function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
}

function setSpotifyCookie(
  response: NextResponse,
  request: NextRequest,
  name: string,
  value: string,
  maxAge: number
) {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure(request),
    maxAge,
  });
}

function clearSpotifyCookies(response: NextResponse, request: NextRequest) {
  setSpotifyCookie(response, request, spotifyCookies.access, "", 0);
  setSpotifyCookie(response, request, spotifyCookies.refresh, "", 0);
  setSpotifyCookie(response, request, spotifyCookies.expiresAt, "", 0);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Spotify request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function refreshSpotifyToken(refreshToken: string) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Spotify OAuth environment variables are missing.");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  console.log("[spotify:refresh] attempting token refresh", {
    refreshTokenPresent: Boolean(refreshToken),
  });

  const refreshResponse = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!refreshResponse.ok) {
    const details = await refreshResponse.text().catch(() => "");
    console.error("[spotify:refresh] refresh failed", {
      status: refreshResponse.status,
      body: details.slice(0, 400),
    });
    if (refreshResponse.status === 400 || refreshResponse.status === 401) {
      throw new UpstreamApiError("Spotify session expired. Please reconnect Spotify.", 401, undefined, "refresh_invalid");
    }
    throw new UpstreamApiError("Unable to refresh Spotify session. Please try reconnecting Spotify.", 502);
  }

  const tokenData = await refreshResponse.json();
  console.log("[spotify:refresh] refresh succeeded", {
    hasAccessToken: Boolean(tokenData?.access_token),
    hasRefreshToken: Boolean(tokenData?.refresh_token),
    expiresIn: Number(tokenData?.expires_in ?? 0),
  });
  return {
    accessToken: tokenData.access_token as string,
    refreshToken: (tokenData.refresh_token as string | undefined) ?? refreshToken,
    expiresIn: tokenData.expires_in as number,
  };
}

async function spotifyRequest(accessToken: string, endpoint: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[spotify:request] start", {
      endpoint,
      accessTokenPresent: Boolean(accessToken),
      accessTokenLength: accessToken?.length ?? 0,
    });
  }
  const response = await fetchWithTimeout(`${SPOTIFY_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("[spotify:request] upstream error", {
      endpoint,
      requestUrl: `${SPOTIFY_API_BASE}${endpoint}`,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      wwwAuthenticate: response.headers.get("www-authenticate"),
      retryAfter: response.headers.get("retry-after"),
      body: details.slice(0, 600),
    });
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;

    if (response.status === 429) {
      throw new UpstreamApiError("Spotify rate limit reached. Please wait about 60s and try again.", 429, retryAfterSec);
    }

    if (response.status === 401) {
      throw new UpstreamApiError("Spotify session expired. Please reconnect Spotify.", 401, undefined, "upstream_unauthorized");
    }

    // 403 is NOT an expiry — a token refresh keeps the original grant's scopes,
    // so refreshing won't fix it. Report it as its own distinct problem.
    if (response.status === 403) {
      throw new UpstreamApiError(
        "Spotify denied this request (403 Forbidden). The connected account may be missing a permission this action needs — disconnect and reconnect Spotify to re-grant access, then try again.",
        403,
        undefined,
        "forbidden"
      );
    }

    if (response.status >= 500) {
      throw new UpstreamApiError("Spotify is temporarily unavailable. Please try again.", 502);
    }

    throw new UpstreamApiError("Spotify request failed. Please try again.", 502);
  }

  return response.json();
}

/**
 * Like spotifyRequest but for write calls that carry a method/body. Spotify's
 * write endpoints sometimes return an empty body (or a snapshot id), so the JSON
 * parse is guarded.
 */
async function spotifyRequestWithInit(accessToken: string, endpoint: string, init: RequestInit) {
  const response = await fetchWithTimeout(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    // Capture the FULL raw Spotify error body — their error responses carry a
    // specific `error.message` (and sometimes `error.reason`) explaining exactly
    // why the request was rejected (invalid id format, malformed body, invalid
    // client, etc.). We log it verbatim, unsliced.
    const rawBody = await response.text().catch(() => "");
    let parsedError: { status?: number; message?: string; reason?: string } | null = null;
    try {
      parsedError = JSON.parse(rawBody)?.error ?? null;
    } catch {
      parsedError = null;
    }
    const upstreamMessage = parsedError?.message ?? "";
    const upstreamReason = parsedError?.reason ?? "";

    // Best-effort preview of the request body we sent (helps diagnose "malformed
    // request" style 403s). Never logs auth headers.
    let requestBodyPreview = "";
    if (typeof init.body === "string") {
      requestBodyPreview = init.body.slice(0, 500);
    }

    console.error("[spotify:request] upstream write error — full detail", {
      endpoint,
      requestUrl: `${SPOTIFY_API_BASE}${endpoint}`,
      method: init.method ?? "GET",
      status: response.status,
      statusText: response.statusText,
      retryAfter: response.headers.get("retry-after"),
      wwwAuthenticate: response.headers.get("www-authenticate"),
      upstreamMessage,
      upstreamReason,
      requestBodyPreview,
      rawBody,
    });
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;

    if (response.status === 429) {
      throw new UpstreamApiError("Spotify rate limit reached. Please wait about 60s and try again.", 429, retryAfterSec);
    }
    if (response.status === 401) {
      throw new UpstreamApiError("Spotify session expired. Please reconnect Spotify.", 401, undefined, "upstream_unauthorized");
    }
    // 403 Forbidden is a permission problem, not an expiry. Refreshing the token
    // won't help because a refresh preserves the original grant's scopes. Surface
    // Spotify's own message so the real reason reaches the user, and report it as
    // status 403 so it is NOT retried as a 401 or shown as "session expired".
    if (response.status === 403) {
      const detail = upstreamMessage ? ` Spotify says: "${upstreamMessage}".` : "";
      throw new UpstreamApiError(
        `Spotify refused this action (403 Forbidden).${detail} Reconnect Spotify to re-grant access, then try again.`,
        403,
        undefined,
        "forbidden"
      );
    }
    if (response.status >= 500) {
      throw new UpstreamApiError("Spotify is temporarily unavailable. Please try again.", 502);
    }
    throw new UpstreamApiError("Spotify request failed. Please try again.", 502);
  }

  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Creates a new private playlist on the connected user's account via
 * POST /me/playlists.
 */
async function createSpotifyPlaylist(accessToken: string, title: string, description?: string) {
  // Create against POST /me/playlists — Spotify's current "Create Playlist"
  // endpoint, which targets the authenticated user directly and needs no user id
  // in the path. The legacy POST /users/{id}/playlists ("Create Playlist for
  // user") returns a bare 403 Forbidden for newer apps even with valid tokens and
  // correct playlist-modify scopes — the same class of silent endpoint
  // restriction that forced /playlists/{id}/tracks -> /playlists/{id}/items.
  //
  // GET /me is still called first purely for diagnostics: it confirms which
  // account the token actually resolves to. The id is no longer used to build
  // the request URL, so a wrong/stale id can no longer break creation.
  let meId: string | null = null;
  let meDisplayName: string | null = null;
  try {
    const me = await spotifyRequest(accessToken, "/me");
    meId = me?.id ? String(me.id) : null;
    meDisplayName = me?.display_name ?? null;
    console.log("[spotify:createPlaylist] account resolved from fresh GET /me", {
      meId,
      meDisplayName,
      meProduct: me?.product ?? null,
      meCountry: me?.country ?? null,
      accessTokenPrefix10: accessToken ? accessToken.slice(0, 10) : null,
      createUrl: "/me/playlists",
      note: "user id is diagnostic only — not used in the create URL",
    });
  } catch (error) {
    // Never fail creation just because the diagnostic lookup failed.
    console.warn("[spotify:createPlaylist] GET /me diagnostic failed (continuing)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const payload = await spotifyRequestWithInit(accessToken, "/me/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: title,
      description: description ?? "",
      public: false,
    }),
  });

  const playlistId = String(payload?.id ?? "");
  console.log("[spotify:createPlaylist] created via POST /me/playlists", {
    playlistId: playlistId || null,
    meId,
  });
  return playlistId;
}

/**
 * Adds one or more tracks to a playlist. Spotify accepts up to 100 track URIs
 * per request, so ids are chunked. Ids may be bare Spotify track ids or full
 * `spotify:track:...` URIs.
 *
 * Uses POST /playlists/{id}/items — Spotify's current "Add Items to Playlist"
 * endpoint. The legacy POST /playlists/{id}/tracks is deprecated and returns a
 * bare 403 Forbidden for newer apps even with valid tokens and correct
 * playlist-modify scopes. Request body is unchanged between the two forms.
 */
async function addSpotifyPlaylistTracks(accessToken: string, playlistId: string, trackIds: string[]) {
  const uris = trackIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => (id.startsWith("spotify:track:") ? id : `spotify:track:${id}`));
  if (uris.length === 0) return 0;

  let added = 0;
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    await spotifyRequestWithInit(accessToken, `/playlists/${encodeURIComponent(playlistId)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: chunk }),
    });
    added += chunk.length;
  }
  return added;
}

async function getSpotifyPlaylistTracks(accessToken: string, playlistId: string) {
  const tracks: Array<{
    id: string;
    name: string;
    artist: string;
    album: string;
    durationMs: number;
    imageUrl?: string;
    isrc?: string;
  }> = [];

  const pageSize = 100;
  let offset = 0;
  let total: number | null = null;
  let pagesRead = 0;

  while (true) {
    const data = await spotifyRequest(
      accessToken,
      `/playlists/${playlistId}/items?limit=${pageSize}&offset=${offset}`
    );

    const items = Array.isArray(data?.items) ? data.items : [];
    const apiTotal = parseTrackCount(data?.total);
    if (total === null && apiTotal !== null) total = apiTotal;

    if (process.env.NODE_ENV !== "production") {
      console.log("[spotify:get] playlist items page", {
        playlistId,
        offset,
        rawItemsLength: items.length,
        firstRawItem: items[0] ?? null,
        firstRawItemKeys: items[0] ? Object.keys(items[0]) : [],
        firstRawItemNestedItemKeys: items[0]?.item ? Object.keys(items[0].item) : [],
      });
    }

    let excludedNoTrack = 0;
    let excludedMissingIdOrName = 0;
    const parsedBefore = tracks.length;

    for (const item of items) {
      const track = item?.item ?? item?.track ?? item;
      if (!track) {
        excludedNoTrack += 1;
        continue;
      }
      if (!track?.id || !track?.name) {
        excludedMissingIdOrName += 1;
        continue;
      }

      tracks.push({
        id: String(track.id),
        name: String(track.name),
        artist: Array.isArray(track.artists)
          ? track.artists.map((artist: any) => String(artist?.name ?? "")).filter(Boolean).join(", ")
          : "",
        album: String(track?.album?.name ?? ""),
        durationMs: Number.isFinite(Number(track?.duration_ms)) ? Math.trunc(Number(track.duration_ms)) : 0,
        imageUrl: track?.album?.images?.[0]?.url ? String(track.album.images[0].url) : undefined,
        isrc: track?.external_ids?.isrc ? String(track.external_ids.isrc) : undefined,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[spotify:get] playlist items page parse diagnostics", {
        playlistId,
        offset,
        rawItemsLength: items.length,
        parsedTracksOnPage: tracks.length - parsedBefore,
        totalParsedTracks: tracks.length,
        excludedNoTrack,
        excludedMissingIdOrName,
        firstParsedTrack: tracks[parsedBefore] ?? null,
      });
    }

    pagesRead += 1;
    offset += items.length;

    if (items.length < pageSize) break;
    if (total !== null && offset >= total) break;
    // Safety guard against bad upstream pagination loops.
    if (pagesRead >= 200) break;
  }

  return {
    total: total ?? tracks.length,
    tracks,
  };
}

function parseTrackCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.trunc(parsed);
  }

  return null;
}

async function resolveSpotifyAccessToken(request: NextRequest) {
  const sessionId = getSessionIdFromRequest(request);
  const storeSession = sessionId ? getPlatformSession(sessionId, "spotify") : null;

  const now = Date.now();
  if (storeSession?.accessToken && storeSession.expiresAt > now + 10_000) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[spotify:resolve] using server session store access token");
    }
    return {
      accessToken: storeSession.accessToken,
      refreshed: null as null | { accessToken: string; refreshToken: string; expiresIn: number },
      refreshToken: storeSession.refreshToken ?? null,
      sessionId,
    };
  }

  if (storeSession?.refreshToken) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[spotify:resolve] server store token expired/missing; refreshing with store refresh token");
    }
    const refreshed = await refreshSpotifyToken(storeSession.refreshToken);
    return { accessToken: refreshed.accessToken, refreshed, refreshToken: refreshed.refreshToken, sessionId };
  }

  const accessToken = request.cookies.get(spotifyCookies.access)?.value;
  const refreshToken = request.cookies.get(spotifyCookies.refresh)?.value;
  const expiresAtRaw = request.cookies.get(spotifyCookies.expiresAt)?.value;
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;

  if (process.env.NODE_ENV !== "production") {
    console.log("[spotify:resolve] cookie snapshot", {
      host: getCanonicalHostLabel(),
      appOrigin: getCanonicalAppOrigin(),
      accessTokenPresent: Boolean(accessToken),
      refreshTokenPresent: Boolean(refreshToken),
      expiresAt,
      expiresInSec: expiresAt ? Math.floor((expiresAt - now) / 1000) : null,
    });
  }

  if (accessToken && expiresAt > now + 10_000) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[spotify:resolve] using cookie access token");
    }
    return {
      accessToken,
      refreshed: null as null | { accessToken: string; refreshToken: string; expiresIn: number },
      refreshToken: refreshToken ?? null,
      sessionId,
    };
  }

  if (!refreshToken) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[spotify:resolve] no refresh token available; session considered disconnected");
    }
    return {
      accessToken: null,
      refreshed: null as null | { accessToken: string; refreshToken: string; expiresIn: number },
      refreshToken: null,
      sessionId,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[spotify:resolve] access token missing/expired; triggering refresh");
  }
  const refreshed = await refreshSpotifyToken(refreshToken);
  return { accessToken: refreshed.accessToken, refreshed, refreshToken: refreshed.refreshToken, sessionId };
}

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource");
  const ip = getClientIp(request);
  const limit = checkRateLimit(`spotify:${resource ?? "default"}:${ip}`, SPOTIFY_RATE_LIMIT.limit, SPOTIFY_RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Spotify rate limit reached. Please wait about 60s and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("[spotify:get] incoming request", {
        resource,
        host: getCanonicalHostLabel(),
        appOrigin: getCanonicalAppOrigin(),
        hasCookieHeader: Boolean(request.headers.get("cookie")),
      });
    }
    const { accessToken, refreshed, refreshToken, sessionId } = await resolveSpotifyAccessToken(request);

    if (!accessToken) {
      return NextResponse.json({ error: "Spotify is not connected." }, { status: 401 });
    }

    let liveAccessToken = accessToken;
    let liveRefreshToken = refreshToken;
    let refreshedAfter401: null | { accessToken: string; refreshToken: string; expiresIn: number } = null;
    let payload: unknown;

    const runWithSpotifyAuth = async <T>(requester: (token: string) => Promise<T>): Promise<T> => {
      try {
        return await requester(liveAccessToken);
      } catch (error) {
        if (!(error instanceof UpstreamApiError) || error.status !== 401 || !liveRefreshToken) {
          throw error;
        }

        if (process.env.NODE_ENV !== "production") {
          console.warn("[spotify:get] received 401 from Spotify API, attempting single token refresh + retry");
        }
        const refreshedToken = await refreshSpotifyToken(liveRefreshToken);
        liveAccessToken = refreshedToken.accessToken;
        liveRefreshToken = refreshedToken.refreshToken;
        refreshedAfter401 = refreshedToken;
        return requester(liveAccessToken);
      }
    };

    if (resource === "playlists") {
      const data = await runWithSpotifyAuth((token) => spotifyRequest(token, "/me/playlists?limit=50"));
      const items = Array.isArray(data?.items) ? data.items : [];
      payload = {
        playlists: items.map((item: any) => ({
          id: item?.id,
          name: item?.name,
          owner: item?.owner?.display_name ?? "Spotify User",
          trackCount: parseTrackCount(item?.tracks?.total),
          imageUrl: item?.images?.[0]?.url,
        })),
      };
    } else if (resource === "trackCount") {
      const playlistId = request.nextUrl.searchParams.get("playlistId");
      if (!playlistId) {
        return NextResponse.json({ error: "Please provide playlistId for resource=trackCount." }, { status: 400 });
      }

      const data = await runWithSpotifyAuth((token) =>
        spotifyRequest(token, `/playlists/${playlistId}/items?limit=1`)
      );
      let total = parseTrackCount(data?.total);

      if (total === null) {
        try {
          const details = await runWithSpotifyAuth((token) =>
            spotifyRequest(token, `/playlists/${playlistId}?fields=tracks(total)`)
          );
          total = parseTrackCount(details?.tracks?.total);
        } catch {
          // Keep null when fallback fails; UI will render "-" gracefully.
        }
      }

      payload = {
        total,
      };
    } else if (resource === "tracks") {
      const playlistId = request.nextUrl.searchParams.get("playlistId");
      if (!playlistId) {
        return NextResponse.json({ error: "Please provide playlistId for resource=tracks." }, { status: 400 });
      }
      payload = await runWithSpotifyAuth((token) => getSpotifyPlaylistTracks(token, playlistId));
    } else if (resource === "search") {
      const query = request.nextUrl.searchParams.get("query")?.trim();
      if (!query) {
        return NextResponse.json({ error: "Please provide query for resource=search." }, { status: 400 });
      }

      const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10);
      const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20)) : 8;
      const endpoint = `/search?type=track&limit=${safeLimit}&q=${encodeURIComponent(query)}`;
      const data = await runWithSpotifyAuth((token) => spotifyRequest(token, endpoint));
      const items = Array.isArray(data?.tracks?.items) ? data.tracks.items : [];
      payload = {
        tracks: items
          .filter((track: any) => track?.id && track?.name)
          .map((track: any) => ({
            id: String(track.id),
            name: String(track.name),
            artist: Array.isArray(track.artists)
              ? track.artists.map((artist: any) => String(artist?.name ?? "")).filter(Boolean).join(", ")
              : "",
            album: String(track?.album?.name ?? ""),
            durationMs: Number.isFinite(Number(track?.duration_ms)) ? Math.trunc(Number(track.duration_ms)) : 0,
            imageUrl: track?.album?.images?.[0]?.url ? String(track.album.images[0].url) : undefined,
          })),
      };
    } else {
      return NextResponse.json({
        message: "Spotify API route is live. Use resource=playlists, resource=trackCount&playlistId=..., resource=tracks&playlistId=..., or resource=search&query=...",
      });
    }

    const response = NextResponse.json(payload);
    const effectiveRefresh = refreshedAfter401 ?? refreshed;
    if (effectiveRefresh) {
      setSpotifyCookie(response, request, spotifyCookies.access, effectiveRefresh.accessToken, effectiveRefresh.expiresIn);
      setSpotifyCookie(response, request, spotifyCookies.refresh, effectiveRefresh.refreshToken, 60 * 60 * 24 * 90);
      setSpotifyCookie(
        response,
        request,
        spotifyCookies.expiresAt,
        (Date.now() + effectiveRefresh.expiresIn * 1000).toString(),
        effectiveRefresh.expiresIn
      );
      if (sessionId) {
        setPlatformSession(sessionId, "spotify", {
          accessToken: effectiveRefresh.accessToken,
          refreshToken: effectiveRefresh.refreshToken,
          expiresAt: Date.now() + effectiveRefresh.expiresIn * 1000,
        });
      }
    }
    return response;
  } catch (error) {
    if (error instanceof UpstreamApiError) {
      const headers = error.retryAfterSec ? { "Retry-After": String(error.retryAfterSec) } : undefined;
      const response = NextResponse.json({ error: error.message }, { status: error.status, headers });
      if (error.status === 401 && error.reason === "refresh_invalid") {
        // Only clear session when refresh token is definitively invalid/expired.
        clearSpotifyCookies(response, request);
        const sessionId = getSessionIdFromRequest(request);
        if (sessionId) {
          clearPlatformSession(sessionId, "spotify");
        }
      }
      return response;
    }

    if (error instanceof Error && error.message === "Spotify request timed out.") {
      return NextResponse.json({ error: "Spotify request timed out. Please try again." }, { status: 504 });
    }

    return NextResponse.json({ error: "Spotify request failed. Please try again." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource");
  const ip = getClientIp(request);
  const limit = checkRateLimit(`spotify:write:${resource ?? "default"}:${ip}`, SPOTIFY_RATE_LIMIT.limit, SPOTIFY_RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Spotify rate limit reached. Please wait about 60s and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  try {
    const { accessToken, refreshed, refreshToken, sessionId } = await resolveSpotifyAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Spotify is not connected." }, { status: 401 });
    }

    let liveAccessToken = accessToken;
    let liveRefreshToken = refreshToken;
    let refreshedAfter401: null | { accessToken: string; refreshToken: string; expiresIn: number } = null;

    const runWithSpotifyAuth = async <T,>(requester: (token: string) => Promise<T>): Promise<T> => {
      try {
        return await requester(liveAccessToken);
      } catch (error) {
        if (!(error instanceof UpstreamApiError) || error.status !== 401 || !liveRefreshToken) {
          throw error;
        }
        const refreshedToken = await refreshSpotifyToken(liveRefreshToken);
        liveAccessToken = refreshedToken.accessToken;
        liveRefreshToken = refreshedToken.refreshToken;
        refreshedAfter401 = refreshedToken;
        return requester(liveAccessToken);
      }
    };

    let payload: unknown;

    if (resource === "createPlaylist") {
      const body = (await request.json().catch(() => null)) as { title?: string; description?: string } | null;
      const title = body?.title?.trim();
      if (!title) {
        return NextResponse.json({ error: "Please provide title for resource=createPlaylist." }, { status: 400 });
      }

      const playlistId = await runWithSpotifyAuth((token) => createSpotifyPlaylist(token, title, body?.description));
      if (!playlistId) {
        return NextResponse.json({ error: "Spotify did not return a playlist id." }, { status: 502 });
      }
      payload = { playlistId };
    } else if (resource === "addPlaylistItem") {
      const body = (await request.json().catch(() => null)) as { playlistId?: string; trackId?: string; trackIds?: string[] } | null;
      const playlistId = body?.playlistId?.trim();
      const trackIds = Array.isArray(body?.trackIds)
        ? body.trackIds.map((id) => String(id))
        : body?.trackId
          ? [String(body.trackId)]
          : [];
      if (!playlistId || trackIds.length === 0) {
        return NextResponse.json(
          { error: "Please provide playlistId and trackId (or trackIds) for resource=addPlaylistItem." },
          { status: 400 }
        );
      }

      const added = await runWithSpotifyAuth((token) => addSpotifyPlaylistTracks(token, playlistId, trackIds));
      payload = { added };
    } else {
      return NextResponse.json(
        { error: "Unsupported write resource. Use resource=createPlaylist or resource=addPlaylistItem." },
        { status: 400 }
      );
    }

    const response = NextResponse.json(payload);
    const effectiveRefresh = refreshedAfter401 ?? refreshed;
    if (effectiveRefresh) {
      setSpotifyCookie(response, request, spotifyCookies.access, effectiveRefresh.accessToken, effectiveRefresh.expiresIn);
      setSpotifyCookie(response, request, spotifyCookies.refresh, effectiveRefresh.refreshToken, 60 * 60 * 24 * 90);
      setSpotifyCookie(
        response,
        request,
        spotifyCookies.expiresAt,
        (Date.now() + effectiveRefresh.expiresIn * 1000).toString(),
        effectiveRefresh.expiresIn
      );
      if (sessionId) {
        setPlatformSession(sessionId, "spotify", {
          accessToken: effectiveRefresh.accessToken,
          refreshToken: effectiveRefresh.refreshToken,
          expiresAt: Date.now() + effectiveRefresh.expiresIn * 1000,
        });
      }
    }
    return response;
  } catch (error) {
    if (error instanceof UpstreamApiError) {
      const headers = error.retryAfterSec ? { "Retry-After": String(error.retryAfterSec) } : undefined;
      const response = NextResponse.json({ error: error.message }, { status: error.status, headers });
      if (error.status === 401 && error.reason === "refresh_invalid") {
        clearSpotifyCookies(response, request);
        const sessionId = getSessionIdFromRequest(request);
        if (sessionId) {
          clearPlatformSession(sessionId, "spotify");
        }
      }
      return response;
    }

    if (error instanceof Error && error.message === "Spotify request timed out.") {
      return NextResponse.json({ error: "Spotify request timed out. Please try again." }, { status: 504 });
    }

    return NextResponse.json({ error: "Spotify write request failed. Please try again." }, { status: 500 });
  }
}
