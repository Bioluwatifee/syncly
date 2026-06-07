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

    if (response.status === 401 || response.status === 403) {
      throw new UpstreamApiError("Spotify session expired. Please reconnect Spotify.", 401, undefined, "upstream_unauthorized");
    }

    if (response.status >= 500) {
      throw new UpstreamApiError("Spotify is temporarily unavailable. Please try again.", 502);
    }

    throw new UpstreamApiError("Spotify request failed. Please try again.", 502);
  }

  return response.json();
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
