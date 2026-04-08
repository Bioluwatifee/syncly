import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const REQUEST_TIMEOUT_MS = 10_000;
const YOUTUBE_RATE_LIMIT = { limit: 45, windowMs: 60_000 };

const youtubeCookies = {
  access: "syncly_youtube_access_token",
  refresh: "syncly_youtube_refresh_token",
  expiresAt: "syncly_youtube_expires_at",
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

function setYoutubeCookie(
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
      throw new Error("YouTube request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.trunc(parsed);
  }

  return null;
}

async function refreshYoutubeToken(refreshToken: string) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth environment variables are missing.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new UpstreamApiError("YouTube session expired. Please reconnect YouTube Music.", 401);
    }
    throw new UpstreamApiError("Unable to refresh YouTube session. Please try reconnecting.", 502);
  }

  const payload = await response.json();
  return {
    accessToken: payload.access_token as string,
    refreshToken,
    expiresIn: payload.expires_in as number,
  };
}

async function resolveYoutubeAccessToken(request: NextRequest) {
  const accessToken = request.cookies.get(youtubeCookies.access)?.value;
  const refreshToken = request.cookies.get(youtubeCookies.refresh)?.value;
  const expiresAtRaw = request.cookies.get(youtubeCookies.expiresAt)?.value;
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;
  const now = Date.now();

  if (accessToken && expiresAt > now + 10_000) {
    return { accessToken, refreshed: null as null | { accessToken: string; refreshToken: string; expiresIn: number } };
  }

  if (!refreshToken) {
    return { accessToken: null, refreshed: null as null | { accessToken: string; refreshToken: string; expiresIn: number } };
  }

  const refreshed = await refreshYoutubeToken(refreshToken);
  return { accessToken: refreshed.accessToken, refreshed };
}

async function youtubeRequest(accessToken: string, endpoint: string) {
  const response = await fetchWithTimeout(`${YOUTUBE_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;

    if (response.status === 429) {
      throw new UpstreamApiError("YouTube rate limit reached. Please wait a minute and try again.", 429, retryAfterSec);
    }

    if (response.status === 401 || response.status === 403) {
      throw new UpstreamApiError("YouTube session expired. Please reconnect YouTube Music.", 401);
    }

    if (response.status >= 500) {
      throw new UpstreamApiError("YouTube is temporarily unavailable. Please try again.", 502);
    }

    throw new UpstreamApiError("YouTube request failed. Please try again.", 502);
  }

  return response.json();
}

function getBestThumbnail(snippet: any): string | undefined {
  const thumbs = snippet?.thumbnails;
  return (
    thumbs?.maxres?.url ??
    thumbs?.standard?.url ??
    thumbs?.high?.url ??
    thumbs?.medium?.url ??
    thumbs?.default?.url
  );
}

async function getYoutubePlaylists(accessToken: string) {
  const playlists: Array<{
    id: string;
    name: string;
    owner: string;
    trackCount: number | null;
    imageUrl?: string;
  }> = [];

  let pageToken = "";

  while (true) {
    const query = new URLSearchParams({
      part: "snippet,contentDetails",
      mine: "true",
      maxResults: "50",
    });
    if (pageToken) query.set("pageToken", pageToken);

    const data = await youtubeRequest(accessToken, `/playlists?${query.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];

    for (const item of items) {
      playlists.push({
        id: String(item?.id ?? ""),
        name: String(item?.snippet?.title ?? "Untitled playlist"),
        owner: String(item?.snippet?.channelTitle ?? "YouTube User"),
        trackCount: parseCount(item?.contentDetails?.itemCount),
        imageUrl: getBestThumbnail(item?.snippet),
      });
    }

    pageToken = String(data?.nextPageToken ?? "");
    if (!pageToken) break;
  }

  return playlists;
}

async function getYoutubePlaylistTracks(accessToken: string, playlistId: string) {
  const tracks: Array<{
    id: string;
    name: string;
    artist: string;
    album: string;
    durationMs: number;
    imageUrl?: string;
  }> = [];

  let pageToken = "";
  let pagesRead = 0;

  while (true) {
    const query = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
    });
    if (pageToken) query.set("pageToken", pageToken);

    const data = await youtubeRequest(accessToken, `/playlistItems?${query.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];

    for (const item of items) {
      const title = String(item?.snippet?.title ?? "");
      if (!title || title === "Deleted video" || title === "Private video") continue;

      const channelTitle = String(item?.snippet?.videoOwnerChannelTitle ?? item?.snippet?.channelTitle ?? "");
      tracks.push({
        id: String(item?.contentDetails?.videoId ?? item?.id ?? ""),
        name: title,
        artist: channelTitle || "Unknown Artist",
        album: "",
        durationMs: 0,
        imageUrl: getBestThumbnail(item?.snippet),
      });
    }

    pagesRead += 1;
    pageToken = String(data?.nextPageToken ?? "");
    // Keep MVP responsive and avoid quota spikes.
    if (!pageToken || pagesRead >= 20) break;
  }

  return tracks;
}

async function getYoutubeTrackCount(accessToken: string, playlistId: string) {
  const query = new URLSearchParams({
    part: "contentDetails",
    id: playlistId,
    maxResults: "1",
  });

  const data = await youtubeRequest(accessToken, `/playlists?${query.toString()}`);
  const item = Array.isArray(data?.items) ? data.items[0] : null;
  return parseCount(item?.contentDetails?.itemCount);
}

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource");
  const ip = getClientIp(request);
  const limit = checkRateLimit(`youtube:${resource ?? "default"}:${ip}`, YOUTUBE_RATE_LIMIT.limit, YOUTUBE_RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "YouTube rate limit reached. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  try {
    const { accessToken, refreshed } = await resolveYoutubeAccessToken(request);

    if (!accessToken) {
      return NextResponse.json({ error: "YouTube is not connected." }, { status: 401 });
    }

    let payload: unknown;

    if (resource === "playlists") {
      payload = { playlists: await getYoutubePlaylists(accessToken) };
    } else if (resource === "trackCount") {
      const playlistId = request.nextUrl.searchParams.get("playlistId");
      if (!playlistId) {
        return NextResponse.json({ error: "Please provide playlistId for resource=trackCount." }, { status: 400 });
      }
      payload = { total: await getYoutubeTrackCount(accessToken, playlistId) };
    } else if (resource === "tracks") {
      const playlistId = request.nextUrl.searchParams.get("playlistId");
      if (!playlistId) {
        return NextResponse.json({ error: "Please provide playlistId for resource=tracks." }, { status: 400 });
      }

      const tracks = await getYoutubePlaylistTracks(accessToken, playlistId);
      payload = {
        total: tracks.length,
        tracks,
      };
    } else {
      return NextResponse.json({
        message: "YouTube API route is live. Use resource=playlists, resource=trackCount&playlistId=..., or resource=tracks&playlistId=...",
      });
    }

    const response = NextResponse.json(payload);
    if (refreshed) {
      setYoutubeCookie(response, request, youtubeCookies.access, refreshed.accessToken, refreshed.expiresIn);
      setYoutubeCookie(response, request, youtubeCookies.refresh, refreshed.refreshToken, 60 * 60 * 24 * 90);
      setYoutubeCookie(
        response,
        request,
        youtubeCookies.expiresAt,
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

    if (error instanceof Error && error.message === "YouTube request timed out.") {
      return NextResponse.json({ error: "YouTube request timed out. Please try again." }, { status: 504 });
    }

    return NextResponse.json({ error: "YouTube request failed. Please try again." }, { status: 500 });
  }
}
