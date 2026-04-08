import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const REQUEST_TIMEOUT_MS = 10_000;
const SPOTIFY_RATE_LIMIT = { limit: 45, windowMs: 60_000 };

const spotifyCookies = {
  access: "syncly_spotify_access_token",
  refresh: "syncly_spotify_refresh_token",
  expiresAt: "syncly_spotify_expires_at",
};

class UpstreamApiError extends Error {
  status: number;
  retryAfterSec?: number;

  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
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

  const refreshResponse = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!refreshResponse.ok) {
    if (refreshResponse.status === 400 || refreshResponse.status === 401) {
      throw new UpstreamApiError("Spotify session expired. Please reconnect Spotify.", 401);
    }
    throw new UpstreamApiError("Unable to refresh Spotify session. Please try reconnecting Spotify.", 502);
  }

  const tokenData = await refreshResponse.json();
  return {
    accessToken: tokenData.access_token as string,
    refreshToken: (tokenData.refresh_token as string | undefined) ?? refreshToken,
    expiresIn: tokenData.expires_in as number,
  };
}

async function spotifyRequest(accessToken: string, endpoint: string) {
  const response = await fetchWithTimeout(`${SPOTIFY_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;

    if (response.status === 429) {
      throw new UpstreamApiError("Spotify rate limit reached. Please wait about 60s and try again.", 429, retryAfterSec);
    }

    if (response.status === 401 || response.status === 403) {
      throw new UpstreamApiError("Spotify session expired. Please reconnect Spotify.", 401);
    }

    if (response.status >= 500) {
      throw new UpstreamApiError("Spotify is temporarily unavailable. Please try again.", 502);
    }

    throw new UpstreamApiError("Spotify request failed. Please try again.", 502);
  }

  return response.json();
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
  const accessToken = request.cookies.get(spotifyCookies.access)?.value;
  const refreshToken = request.cookies.get(spotifyCookies.refresh)?.value;
  const expiresAtRaw = request.cookies.get(spotifyCookies.expiresAt)?.value;
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;
  const now = Date.now();

  if (accessToken && expiresAt > now + 10_000) {
    return { accessToken, refreshed: null as null | { accessToken: string; refreshToken: string; expiresIn: number } };
  }

  if (!refreshToken) {
    return { accessToken: null, refreshed: null as null | { accessToken: string; refreshToken: string; expiresIn: number } };
  }

  const refreshed = await refreshSpotifyToken(refreshToken);
  return { accessToken: refreshed.accessToken, refreshed };
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
    const { accessToken, refreshed } = await resolveSpotifyAccessToken(request);

    if (!accessToken) {
      return NextResponse.json({ error: "Spotify is not connected." }, { status: 401 });
    }

    let payload: unknown;

    if (resource === "playlists") {
      const data = await spotifyRequest(accessToken, "/me/playlists?limit=50");
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

      const data = await spotifyRequest(accessToken, `/playlists/${playlistId}/tracks?limit=1`);
      let total = parseTrackCount(data?.total);

      if (total === null) {
        try {
          const details = await spotifyRequest(accessToken, `/playlists/${playlistId}?fields=tracks(total)`);
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
      const data = await spotifyRequest(accessToken, `/playlists/${playlistId}/tracks?limit=100`);
      const items = Array.isArray(data?.items) ? data.items : [];
      payload = {
        total: parseTrackCount(data?.total) ?? items.length,
        tracks: items
          .filter((item: any) => item.track)
          .map((item: any) => ({
            id: item.track.id,
            name: item.track.name,
            artist: (item.track.artists ?? []).map((artist: any) => artist.name).join(", "),
            album: item.track.album?.name ?? "",
            durationMs: item.track.duration_ms ?? 0,
            imageUrl: item.track.album?.images?.[0]?.url,
          })),
      };
    } else {
      return NextResponse.json({
        message: "Spotify API route is live. Use resource=playlists, resource=trackCount&playlistId=..., or resource=tracks&playlistId=...",
      });
    }

    const response = NextResponse.json(payload);
    if (refreshed) {
      setSpotifyCookie(response, request, spotifyCookies.access, refreshed.accessToken, refreshed.expiresIn);
      setSpotifyCookie(response, request, spotifyCookies.refresh, refreshed.refreshToken, 60 * 60 * 24 * 90);
      setSpotifyCookie(
        response,
        request,
        spotifyCookies.expiresAt,
        (Date.now() + refreshed.expiresIn * 1000).toString(),
        refreshed.expiresIn
      );
    }
    return response;
  } catch (error) {
    if (error instanceof UpstreamApiError) {
      const headers = error.retryAfterSec ? { "Retry-After": String(error.retryAfterSec) } : undefined;
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }

    if (error instanceof Error && error.message === "Spotify request timed out.") {
      return NextResponse.json({ error: "Spotify request timed out. Please try again." }, { status: 504 });
    }

    return NextResponse.json({ error: "Spotify request failed. Please try again." }, { status: 500 });
  }
}
