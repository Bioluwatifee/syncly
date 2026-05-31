import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, isSameOriginMutation } from "@/lib/security";
import { Track } from "@/types";
import { findBestMatch } from "@/lib/matcher";
import {
  clearPlatformSession,
  getPlatformSession,
  getSessionIdFromRequest,
  setPlatformSession,
} from "@/lib/oauth-session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SupportedPlatform = "spotify" | "youtube";

type SpotifySessionState = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  refreshedThisRequest: boolean;
};

const TRANSFER_RATE_LIMIT = { limit: 20, windowMs: 60_000 };
const SEARCH_LIMIT = 8;
const MATCH_LIMIT = 250;
const TRANSFER_BATCH_SIZE = 10;
const TRANSFER_STEP_DELAY_MS = 150;
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_PROACTIVE_REFRESH_WINDOW_MS = 5 * 60_000;
const SPOTIFY_REQUEST_TIMEOUT_MS = 10_000;

const spotifyCookies = {
  access: "syncly_spotify_access_token",
  refresh: "syncly_spotify_refresh_token",
  expiresAt: "syncly_spotify_expires_at",
};

type TransferRequestBody = {
  sourcePlatform?: SupportedPlatform;
  targetPlatform?: SupportedPlatform;
  playlistId?: string;
  playlistName?: string;
};

type FailureItem = {
  sourceTrack: Track;
  reason: string;
};

class SpotifyTransferError extends Error {
  status: number;
  details?: string;

  constructor(message: string, status = 502, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function isSupportedPlatform(value: unknown): value is SupportedPlatform {
  return value === "spotify" || value === "youtube";
}

function clampTracksForMatching<T>(tracks: T[], max = MATCH_LIMIT): T[] {
  if (tracks.length <= max) return tracks;
  return tracks.slice(0, max);
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
}

function setSpotifyCookie(response: NextResponse, request: NextRequest, name: string, value: string, maxAge: number) {
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

function applySpotifySessionToResponse(
  response: NextResponse,
  request: NextRequest,
  sessionId: string | null,
  spotifyState: SpotifySessionState
) {
  const now = Date.now();
  const maxAgeSeconds = Math.max(1, Math.floor((spotifyState.expiresAt - now) / 1000));
  setSpotifyCookie(response, request, spotifyCookies.access, spotifyState.accessToken, maxAgeSeconds);
  setSpotifyCookie(response, request, spotifyCookies.expiresAt, String(spotifyState.expiresAt), maxAgeSeconds);
  if (spotifyState.refreshToken) {
    setSpotifyCookie(response, request, spotifyCookies.refresh, spotifyState.refreshToken, 60 * 60 * 24 * 90);
  }

  if (sessionId) {
    setPlatformSession(sessionId, "spotify", {
      accessToken: spotifyState.accessToken,
      refreshToken: spotifyState.refreshToken ?? undefined,
      expiresAt: spotifyState.expiresAt,
    });
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = SPOTIFY_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new SpotifyTransferError("Spotify request timed out.", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function refreshSpotifyToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new SpotifyTransferError("Spotify OAuth environment variables are missing.", 500);
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  console.log("[transfer:spotify] refreshing token", { hasRefreshToken: Boolean(refreshToken) });

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
    console.error("[transfer:spotify] refresh failed", {
      status: refreshResponse.status,
      body: details.slice(0, 400),
    });

    if (refreshResponse.status === 400 || refreshResponse.status === 401) {
      throw new SpotifyTransferError("Spotify session expired. Please reconnect Spotify.", 401);
    }

    throw new SpotifyTransferError("Unable to refresh Spotify session.", 502);
  }

  const tokenData = await refreshResponse.json();
  return {
    accessToken: String(tokenData?.access_token ?? ""),
    refreshToken: String(tokenData?.refresh_token ?? refreshToken),
    expiresIn: Number(tokenData?.expires_in ?? 3600),
  };
}

async function resolveSpotifyStateAtTransferStart(request: NextRequest): Promise<{ sessionId: string | null; state: SpotifySessionState }> {
  const sessionId = getSessionIdFromRequest(request);
  const now = Date.now();
  const storeSession = sessionId ? getPlatformSession(sessionId, "spotify") : null;

  let accessToken = "";
  let refreshToken: string | null = null;
  let expiresAt = 0;

  if (storeSession?.accessToken) {
    accessToken = storeSession.accessToken;
    refreshToken = storeSession.refreshToken ?? null;
    expiresAt = storeSession.expiresAt;
  } else {
    accessToken = request.cookies.get(spotifyCookies.access)?.value ?? "";
    refreshToken = request.cookies.get(spotifyCookies.refresh)?.value ?? null;
    const expiresRaw = request.cookies.get(spotifyCookies.expiresAt)?.value;
    expiresAt = expiresRaw ? Number(expiresRaw) : 0;
  }

  console.log("[transfer:spotify] token snapshot at transfer start", {
    host: getCanonicalHostLabel(),
    requestHost: request.nextUrl.host,
    accessTokenPresent: Boolean(accessToken),
    refreshTokenPresent: Boolean(refreshToken),
    expiresAt,
    expiresAtIso: expiresAt ? new Date(expiresAt).toISOString() : null,
    expiresInSec: expiresAt ? Math.floor((expiresAt - now) / 1000) : null,
  });

  if (!accessToken && !refreshToken) {
    throw new SpotifyTransferError("Spotify is not connected.", 401);
  }

  let state: SpotifySessionState = {
    accessToken,
    refreshToken,
    expiresAt,
    refreshedThisRequest: false,
  };

  const needsImmediateRefresh = !state.accessToken || state.expiresAt <= now + SPOTIFY_PROACTIVE_REFRESH_WINDOW_MS;
  if (needsImmediateRefresh) {
    if (!state.refreshToken) {
      throw new SpotifyTransferError("Spotify session expired. Please reconnect Spotify.", 401);
    }

    const refreshed = await refreshSpotifyToken(state.refreshToken);
    state = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
      refreshedThisRequest: true,
    };
  }

  return { sessionId, state };
}

async function ensureFreshSpotifyToken(state: SpotifySessionState): Promise<SpotifySessionState> {
  const now = Date.now();
  if (state.expiresAt > now + SPOTIFY_PROACTIVE_REFRESH_WINDOW_MS) {
    return state;
  }

  if (!state.refreshToken) {
    throw new SpotifyTransferError("Spotify session expired. Please reconnect Spotify.", 401);
  }

  console.log("[transfer:spotify] proactive refresh before Spotify API call", {
    expiresAt: state.expiresAt,
    expiresAtIso: state.expiresAt ? new Date(state.expiresAt).toISOString() : null,
    expiresInSec: state.expiresAt ? Math.floor((state.expiresAt - now) / 1000) : null,
  });

  const refreshed = await refreshSpotifyToken(state.refreshToken);
  return {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: Date.now() + refreshed.expiresIn * 1000,
    refreshedThisRequest: true,
  };
}

async function spotifyApiRequest(
  endpoint: string,
  spotifyState: SpotifySessionState
): Promise<{ data: any; state: SpotifySessionState }> {
  let state = await ensureFreshSpotifyToken(spotifyState);

  const doRequest = async (token: string) => {
    const response = await fetchWithTimeout(`${SPOTIFY_API_BASE}${endpoint}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("[transfer:spotify] Spotify API error", {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        body: details,
      });

      if (response.status === 401) {
        throw new SpotifyTransferError("Spotify session expired. Please reconnect Spotify.", 401, details);
      }
      if (response.status === 429) {
        throw new SpotifyTransferError("Spotify rate limit reached. Please try again shortly.", 429, details);
      }
      if (response.status === 403) {
        throw new SpotifyTransferError("Spotify access forbidden for this resource.", 403, details);
      }
      if (response.status >= 500) {
        throw new SpotifyTransferError("Spotify is temporarily unavailable. Please try again.", 502, details);
      }

      throw new SpotifyTransferError(`Spotify request failed (${response.status}).`, 502, details);
    }

    return response.json();
  };

  try {
    const data = await doRequest(state.accessToken);
    return { data, state };
  } catch (error) {
    if (!(error instanceof SpotifyTransferError) || error.status !== 401 || !state.refreshToken) {
      throw error;
    }

    console.warn("[transfer:spotify] 401 received, refreshing token and retrying once", { endpoint });
    const refreshed = await refreshSpotifyToken(state.refreshToken);
    state = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
      refreshedThisRequest: true,
    };

    const data = await doRequest(state.accessToken);
    return { data, state };
  }
}

function mapSpotifyTrack(track: any): Track | null {
  if (!track?.id || !track?.name) return null;
  return {
    id: String(track.id),
    platformId: String(track.id),
    name: String(track.name),
    artist: Array.isArray(track.artists)
      ? track.artists.map((artist: any) => String(artist?.name ?? "")).filter(Boolean).join(", ")
      : "",
    album: String(track?.album?.name ?? ""),
    durationMs: Number.isFinite(Number(track?.duration_ms)) ? Math.trunc(Number(track.duration_ms)) : 0,
    imageUrl: track?.album?.images?.[0]?.url ? String(track.album.images[0].url) : undefined,
  };
}

async function fetchSpotifyPlaylistTracksForTransfer(
  playlistId: string,
  initialState: SpotifySessionState
): Promise<{ tracks: Track[]; state: SpotifySessionState }> {
  const tracks: Track[] = [];
  let offset = 0;
  const pageSize = 100;
  let state = initialState;

  while (true) {
    const endpoint = `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${pageSize}&offset=${offset}`;
    const now = Date.now();
    console.log("[transfer:spotify] source-track fetch request", {
      endpoint,
      offset,
      tokenPresent: Boolean(state.accessToken),
      tokenLength: state.accessToken?.length ?? 0,
      expiresAt: state.expiresAt,
      expiresAtIso: state.expiresAt ? new Date(state.expiresAt).toISOString() : null,
      expiresInSec: state.expiresAt ? Math.floor((state.expiresAt - now) / 1000) : null,
    });
    const result = await spotifyApiRequest(endpoint, state);
    state = result.state;

    const items = Array.isArray(result.data?.items) ? result.data.items : [];
    for (const item of items) {
      const mapped = mapSpotifyTrack(item?.track);
      if (mapped) tracks.push(mapped);
    }

    if (items.length < pageSize) break;
    offset += items.length;
    if (offset > 20_000) break;
  }

  return { tracks, state };
}

function buildErrorResponse(request: NextRequest, message: string, status: number, sessionId: string | null) {
  const response = NextResponse.json({ error: message }, { status });
  if (status === 401) {
    clearSpotifyCookies(response, request);
    if (sessionId) {
      clearPlatformSession(sessionId, "spotify");
    }
  }
  return response;
}

export async function POST(request: NextRequest) {
  const routeStartedAt = Date.now();
  const appOrigin = getCanonicalAppOrigin();
  const canonicalHost = getCanonicalHostLabel();
  console.log("[transfer] route entered", {
    atIso: new Date(routeStartedAt).toISOString(),
    host: canonicalHost,
    requestHost: request.nextUrl.host,
    appOrigin,
    method: request.method,
    path: request.nextUrl.pathname,
  });

  if (!isSameOriginMutation(request)) {
    console.warn("[transfer] blocked by same-origin guard", {
      elapsedMs: Date.now() - routeStartedAt,
    });
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(`transfer:execute:${ip}`, TRANSFER_RATE_LIMIT.limit, TRANSFER_RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    console.warn("[transfer] blocked by transfer rate limit", {
      elapsedMs: Date.now() - routeStartedAt,
      retryAfterSec: limit.retryAfterSec,
    });
    return NextResponse.json(
      { error: "Transfer rate limit reached. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: TransferRequestBody;
  try {
    body = (await request.json()) as TransferRequestBody;
  } catch {
    console.warn("[transfer] invalid JSON body", {
      elapsedMs: Date.now() - routeStartedAt,
    });
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourcePlatform = body?.sourcePlatform;
  const targetPlatform = body?.targetPlatform;
  const playlistId = body?.playlistId?.trim();
  const playlistName = body?.playlistName?.trim();

  if (!isSupportedPlatform(sourcePlatform) || !isSupportedPlatform(targetPlatform)) {
    return NextResponse.json({ error: "Source and target platforms must be spotify or youtube." }, { status: 400 });
  }
  if (sourcePlatform !== "spotify" || targetPlatform !== "youtube") {
    return NextResponse.json({ error: "Only Spotify to YouTube Music transfer is supported right now." }, { status: 400 });
  }
  if (!playlistId) {
    return NextResponse.json({ error: "playlistId is required." }, { status: 400 });
  }
  if (!playlistName) {
    return NextResponse.json({ error: "playlistName is required." }, { status: 400 });
  }

  console.log("[transfer] start", {
    elapsedMs: Date.now() - routeStartedAt,
    sourcePlatform,
    targetPlatform,
    playlistId,
    playlistName,
    host: canonicalHost,
    requestHost: request.nextUrl.host,
    spotifyAccessPresent: (request.headers.get("cookie") ?? "").includes("syncly_spotify_access_token="),
    spotifyRefreshPresent: (request.headers.get("cookie") ?? "").includes("syncly_spotify_refresh_token="),
    spotifyExpiresAtPresent: (request.headers.get("cookie") ?? "").includes("syncly_spotify_expires_at="),
    youtubeAccessPresent: (request.headers.get("cookie") ?? "").includes("syncly_youtube_access_token="),
    youtubeRefreshPresent: (request.headers.get("cookie") ?? "").includes("syncly_youtube_refresh_token="),
  });

  let sessionId: string | null = null;
  let spotifyState: SpotifySessionState;
  try {
    const resolved = await resolveSpotifyStateAtTransferStart(request);
    sessionId = resolved.sessionId;
    spotifyState = resolved.state;
  } catch (error) {
    console.error("[transfer] failed before source-track fetch", {
      elapsedMs: Date.now() - routeStartedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof SpotifyTransferError) {
      return buildErrorResponse(request, error.message, error.status, sessionId);
    }
    return buildErrorResponse(request, "Unable to validate Spotify session.", 500, sessionId);
  }

  let sourceTracks: Track[] = [];
  try {
    const sourceTracksResult = await fetchSpotifyPlaylistTracksForTransfer(playlistId, spotifyState);
    sourceTracks = sourceTracksResult.tracks;
    spotifyState = sourceTracksResult.state;
  } catch (error) {
    console.error("[transfer] source-track fetch failed", {
      elapsedMs: Date.now() - routeStartedAt,
      error: error instanceof Error ? error.message : String(error),
      spotifyStatus: error instanceof SpotifyTransferError ? error.status : undefined,
      spotifyErrorBody: error instanceof SpotifyTransferError ? error.details : undefined,
    });
    if (error instanceof SpotifyTransferError) {
      return buildErrorResponse(request, error.message, error.status, sessionId);
    }
    return buildErrorResponse(request, "Unable to fetch source playlist tracks.", 502, sessionId);
  }

  console.log("[transfer] source tracks fetched", {
    elapsedMs: Date.now() - routeStartedAt,
    playlistId,
    sourceTrackCount: sourceTracks.length,
  });

  if (sourceTracks.length === 0) {
    const response = NextResponse.json({
      playlistName,
      sourceTrackCount: 0,
      processedTrackCount: 0,
      transferredCount: 0,
      failedCount: 0,
      failures: [] satisfies FailureItem[],
      targetPlaylistId: null,
      truncated: false,
    });
    applySpotifySessionToResponse(response, request, sessionId, spotifyState);
    console.log("[transfer] finished early (no tracks)", {
      elapsedMs: Date.now() - routeStartedAt,
    });
    return response;
  }

  const createPlaylistResponse = await fetch(
    new URL(`/api/youtube?resource=createPlaylist`, appOrigin),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        title: playlistName,
        description: `Transferred from Spotify by Syncly on ${new Date().toISOString()}`,
      }),
      cache: "no-store",
    }
  );

  const createPlaylistPayload = await createPlaylistResponse.json().catch(() => null);
  if (!createPlaylistResponse.ok || !createPlaylistPayload?.playlistId) {
    console.error("[transfer] destination playlist creation failed", {
      playlistName,
      status: createPlaylistResponse.status,
      error: createPlaylistPayload?.error ?? "Unknown create playlist error",
    });
    const response = NextResponse.json(
      { error: createPlaylistPayload?.error ?? "Unable to create destination YouTube playlist." },
      { status: createPlaylistResponse.status || 502 }
    );
    applySpotifySessionToResponse(response, request, sessionId, spotifyState);
    console.error("[transfer] failed during destination playlist creation", {
      elapsedMs: Date.now() - routeStartedAt,
    });
    return response;
  }

  const targetPlaylistId = String(createPlaylistPayload.playlistId);
  console.log("[transfer] destination playlist created", {
    elapsedMs: Date.now() - routeStartedAt,
    playlistName,
    targetPlaylistId,
  });

  const tracksToProcess = clampTracksForMatching(sourceTracks);
  const failures: FailureItem[] = [];
  let transferredCount = 0;
  const trackBatches = chunkArray(tracksToProcess, TRANSFER_BATCH_SIZE);

  try {
    for (const [batchIndex, batch] of trackBatches.entries()) {
      console.log("[transfer] processing batch", {
        elapsedMs: Date.now() - routeStartedAt,
        batchIndex: batchIndex + 1,
        totalBatches: trackBatches.length,
        batchSize: batch.length,
      });

      for (const sourceTrack of batch) {
        const query = `${sourceTrack.name} ${sourceTrack.artist}`.trim();

        let candidates: Track[] = [];
        try {
          const searchResponse = await fetch(
            new URL(`/api/youtube?resource=search&query=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`, appOrigin),
            {
              method: "GET",
              headers: {
                cookie: request.headers.get("cookie") ?? "",
              },
              cache: "no-store",
            }
          );

          const searchPayload = await searchResponse.json().catch(() => null);
          if (!searchResponse.ok) {
            failures.push({
              sourceTrack,
              reason: searchPayload?.error ?? "YouTube search failed.",
            });
            await sleep(TRANSFER_STEP_DELAY_MS);
            continue;
          }

          candidates = Array.isArray(searchPayload?.tracks)
            ? searchPayload.tracks
                .map((track: any) => ({
                  id: String(track?.id ?? ""),
                  name: String(track?.name ?? ""),
                  artist: String(track?.artist ?? ""),
                  album: String(track?.album ?? ""),
                  durationMs: Number.isFinite(Number(track?.durationMs)) ? Math.trunc(Number(track.durationMs)) : 0,
                  imageUrl: track?.imageUrl ? String(track.imageUrl) : undefined,
                  platformId: String(track?.id ?? ""),
                }))
                .filter((track: Track) => Boolean(track.id && track.name))
            : [];
        } catch {
          failures.push({
            sourceTrack,
            reason: "YouTube search request failed.",
          });
          await sleep(TRANSFER_STEP_DELAY_MS);
          continue;
        }

        const { match } = findBestMatch(sourceTrack, candidates);
        if (!match?.id) {
          failures.push({
            sourceTrack,
            reason: "No sufficiently close YouTube match found.",
          });
          await sleep(TRANSFER_STEP_DELAY_MS);
          continue;
        }

        try {
          const addResponse = await fetch(
            new URL(`/api/youtube?resource=addPlaylistItem`, appOrigin),
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                cookie: request.headers.get("cookie") ?? "",
              },
              body: JSON.stringify({
                playlistId: targetPlaylistId,
                videoId: match.id,
              }),
              cache: "no-store",
            }
          );

          const addPayload = await addResponse.json().catch(() => null);
          if (!addResponse.ok) {
            failures.push({
              sourceTrack,
              reason: addPayload?.error ?? "Failed to add matched track to YouTube playlist.",
            });
            await sleep(TRANSFER_STEP_DELAY_MS);
            continue;
          }

          transferredCount += 1;
        } catch {
          failures.push({
            sourceTrack,
            reason: "Failed to add matched track to YouTube playlist.",
          });
        }

        await sleep(TRANSFER_STEP_DELAY_MS);
      }
    }
  } catch (loopError) {
    console.error("[transfer] transfer loop crashed", loopError);
    console.error("[transfer] transfer loop crashed timing", {
      elapsedMs: Date.now() - routeStartedAt,
    });
    const response = NextResponse.json(
      { error: "Transfer failed unexpectedly during processing. Please try again." },
      { status: 502 }
    );
    applySpotifySessionToResponse(response, request, sessionId, spotifyState);
    return response;
  }

  const processedTrackCount = tracksToProcess.length;
  const failedCount = failures.length;

  if (failedCount > 0) {
    const reasonCounts = failures.reduce<Record<string, number>>((acc, failure) => {
      const key = failure.reason || "Unknown failure";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    console.warn("[transfer] failures summary", {
      playlistName,
      targetPlaylistId,
      failedCount,
      reasons: reasonCounts,
    });
  }

  console.log("[transfer] complete", {
    elapsedMs: Date.now() - routeStartedAt,
    playlistName,
    targetPlaylistId,
    sourceTrackCount: sourceTracks.length,
    processedTrackCount,
    transferredCount,
    failedCount,
    truncated: sourceTracks.length > processedTrackCount,
  });

  const response = NextResponse.json({
    playlistName,
    sourceTrackCount: sourceTracks.length,
    processedTrackCount,
    transferredCount,
    failedCount,
    failures,
    targetPlaylistId,
    truncated: sourceTracks.length > processedTrackCount,
  });
  applySpotifySessionToResponse(response, request, sessionId, spotifyState);
  return response;
}
