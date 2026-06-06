import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, isSameOriginMutation } from "@/lib/security";
import { Track } from "@/types";
import {
  normalizeArtist,
  normalizeTitle,
  similarity,
} from "@/lib/matcher";
import {
  clearPlatformSession,
  getPlatformSession,
  getSessionIdFromRequest,
  setPlatformSession,
} from "@/lib/oauth-session";
import { clearTransferProgress, clearTransferCancellation, isTransferCancellationRequested, upsertTransferProgress, type TrackResultSnapshot } from "@/lib/transfer-progress";

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
  transferId?: string;
  retryTrackIds?: string[];
  targetPlaylistId?: string;
  matchMode?: "normal" | "relaxed";
};

type MatchCandidateDiagnostic = {
  id: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  durationDeltaMs: number | null;
  durationStatus: "matched" | "mismatch" | "unavailable";
  titleScore: number;
  artistScore: number;
  combinedScore: number;
  rejectionReason: string | null;
};

type MatchDiagnostics = {
  searchQueries: string[];
  threshold: number;
  attempts: Array<{
    searchQuery: string;
    topCandidates: MatchCandidateDiagnostic[];
    rejectionReason: string;
    matchFound: boolean;
  }>;
  topCandidates: MatchCandidateDiagnostic[];
  selectedCandidate: MatchCandidateDiagnostic | null;
  rejectionReason: string;
};

type FailureItem = {
  sourceTrack: Track;
  reason: string;
  searchQuery: string;
  searchQueries: string[];
  threshold: number;
  diagnostics: MatchDiagnostics;
  retryEligible: boolean;
};

class SpotifyTransferError extends Error {
  status: number;
  details?: string;
  endpoint?: string;

  constructor(message: string, status = 502, details?: string, endpoint?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.endpoint = endpoint;
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
    appOrigin: getCanonicalAppOrigin(),
    accessTokenPresent: Boolean(accessToken),
    accessTokenPrefix10: accessToken ? accessToken.slice(0, 10) : null,
    accessTokenPrefix: accessToken ? accessToken.slice(0, 20) : null,
    accessTokenLength: accessToken ? accessToken.length : 0,
    refreshTokenPresent: Boolean(refreshToken),
    grantedScopes: storeSession?.grantedScopes ?? null,
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
    const requestUrl = `${SPOTIFY_API_BASE}${endpoint}`;
    if (process.env.NODE_ENV !== "production") {
      console.log("[transfer:spotify] request auth header", {
        endpoint,
        requestUrl,
        authScheme: "Bearer",
        accessTokenPrefix10: token ? token.slice(0, 10) : null,
        accessTokenPrefix: token ? token.slice(0, 20) : null,
        accessTokenLength: token ? token.length : 0,
        authorizationHeaderPreview: token ? `Bearer ${token.slice(0, 20)}...` : null,
        headers: {
          Authorization: token ? `Bearer ${token.slice(0, 20)}...` : null,
        },
      });
    }
    const response = await fetchWithTimeout(requestUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("[transfer:spotify] Spotify API error", {
        endpoint,
        requestUrl,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        wwwAuthenticate: response.headers.get("www-authenticate"),
        retryAfter: response.headers.get("retry-after"),
        body: details,
      });

      if (response.status === 401) {
        throw new SpotifyTransferError("Spotify session expired. Please reconnect Spotify.", 401, details, endpoint);
      }
      if (response.status === 429) {
        throw new SpotifyTransferError("Spotify rate limit reached. Please try again shortly.", 429, details, endpoint);
      }
      if (response.status === 403) {
        throw new SpotifyTransferError("Spotify access forbidden for this resource.", 403, details, endpoint);
      }
      if (response.status >= 500) {
        throw new SpotifyTransferError("Spotify is temporarily unavailable. Please try again.", 502, details, endpoint);
      }

      throw new SpotifyTransferError(`Spotify request failed (${response.status}).`, 502, details, endpoint);
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

function describeSpotifyPlaylistItem(item: any) {
  const resolvedTrack = item?.item ?? item?.track ?? item ?? null;
  return {
    hasTrack: Boolean(item?.track),
    hasDirectTrackFields: Boolean(item?.id && item?.name),
    hasNestedItemFields: Boolean(item?.item?.id && item?.item?.name),
    trackType: item?.track?.type ?? item?.item?.type ?? null,
    trackId: resolvedTrack?.id ?? null,
    trackName: resolvedTrack?.name ?? null,
    isLocal: item?.is_local ?? null,
    addedAt: item?.added_at ?? null,
    availableMarkets: resolvedTrack?.available_markets?.length ?? null,
  };
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stripSearchSuffixes(title: string): string {
  return title
    .replace(/\s*-\s*\d{4}\s*remaster(?:ed)?/gi, "")
    .replace(/\s*-\s*remaster(?:ed)?\s*\d{4}?/gi, "")
    .replace(/\s*-\s*remaster(?:ed)?/gi, "")
    .replace(/\s*-\s*deluxe edition.*$/gi, "")
    .replace(/\s*-\s*anniversary edition.*$/gi, "")
    .replace(/\s*-\s*explicit.*$/gi, "")
    .replace(/\s*-\s*live.*$/gi, "")
    .replace(/\s*-\s*remix.*$/gi, "")
    .replace(/\s*\((?:remaster(?:ed)?|deluxe edition|anniversary edition|explicit|live|remix|version)[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchQueries(track: Track, relaxed = false): string[] {
  const primaryArtist = track.artist.split(",")[0]?.trim() ?? "";
  const normalizedArtist = normalizeArtist(track.artist);
  const strippedTitle = stripSearchSuffixes(track.name);
  const rawTitle = track.name.trim();

  const queries = [
    `${strippedTitle} ${primaryArtist}`.trim(),
    `${strippedTitle} ${normalizedArtist}`.trim(),
    strippedTitle,
    `${rawTitle} ${primaryArtist}`.trim(),
  ];

  if (relaxed) {
    queries.push(rawTitle);
    queries.push(`${rawTitle} ${normalizedArtist}`.trim());
    if (primaryArtist) {
      queries.push(`${strippedTitle} ${primaryArtist}`.trim());
    }
  }

  return dedupeStrings(queries);
}

function detectVersionTag(name: string): string | null {
  const normalized = name.toLowerCase();
  if (normalized.includes("live")) return "live";
  if (normalized.includes("remix")) return "remix";
  if (normalized.includes("acoustic")) return "acoustic";
  if (normalized.includes("cover")) return "cover";
  if (normalized.includes("remaster")) return "remaster";
  return null;
}

function scoreCandidate(sourceTrack: Track, candidate: Track, threshold: number): MatchCandidateDiagnostic {
  const sourceTitle = normalizeTitle(sourceTrack.name);
  const sourceArtist = normalizeArtist(sourceTrack.artist);
  const candidateTitle = normalizeTitle(candidate.name);
  const candidateArtist = normalizeArtist(candidate.artist);

  const titleScore = similarity(sourceTitle, candidateTitle);
  const artistScore = similarity(sourceArtist, candidateArtist);
  const combinedScore = titleScore * 0.62 + artistScore * 0.38;
  const durationDeltaMs = Number.isFinite(sourceTrack.durationMs) && Number.isFinite(candidate.durationMs)
    ? Math.abs(sourceTrack.durationMs - candidate.durationMs)
    : null;
  const durationStatus =
    durationDeltaMs === null || candidate.durationMs <= 0
      ? "unavailable"
      : durationDeltaMs <= 20_000
        ? "matched"
        : "mismatch";

  let rejectionReason: string | null = null;
  const sourceVersionTag = detectVersionTag(sourceTrack.name);
  const candidateVersionTag = detectVersionTag(candidate.name);
  if (sourceVersionTag !== candidateVersionTag && candidateVersionTag && !sourceVersionTag) {
    rejectionReason = `Filtered as ${candidateVersionTag} version`;
  } else if (durationStatus === "mismatch") {
    rejectionReason = "Duration mismatch";
  } else if (artistScore < 0.35) {
    rejectionReason = "Artist mismatch";
  } else if (combinedScore < threshold) {
    rejectionReason = "Similarity score below threshold";
  }

  return {
    id: candidate.id,
    name: candidate.name,
    artist: candidate.artist,
    album: candidate.album,
    durationMs: candidate.durationMs,
    durationDeltaMs,
    durationStatus,
    titleScore,
    artistScore,
    combinedScore,
    rejectionReason,
  };
}

async function findYouTubeMatchForSourceTrack({
  sourceTrack,
  appOrigin,
  cookieHeader,
  matchMode,
}: {
  sourceTrack: Track;
  appOrigin: string;
  cookieHeader: string;
  matchMode: "normal" | "relaxed";
}): Promise<{
  match: Track | null;
  confidence: number;
  searchQuery: string;
  diagnostics: MatchDiagnostics;
}> {
  const threshold = matchMode === "relaxed" ? 0.65 : 0.75;
  const searchQueries = buildSearchQueries(sourceTrack, matchMode === "relaxed");
  const attempts: MatchDiagnostics["attempts"] = [];
  const allCandidates: MatchCandidateDiagnostic[] = [];
  let chosenMatch: Track | null = null;
  let chosenConfidence = 0;
  let chosenSearchQuery = searchQueries[0] ?? `${sourceTrack.name} ${sourceTrack.artist}`.trim();
  let chosenCandidate: MatchCandidateDiagnostic | null = null;

  for (const searchQuery of searchQueries) {
    const searchUrl = new URL(`/api/youtube?resource=search&query=${encodeURIComponent(searchQuery)}&limit=${SEARCH_LIMIT}`, appOrigin);
    const searchResponse = await fetch(searchUrl, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
    });

    const searchPayload = await searchResponse.json().catch(() => null);
    if (!searchResponse.ok) {
      attempts.push({
        searchQuery,
        topCandidates: [],
        rejectionReason: searchPayload?.error ?? "YouTube search failed.",
        matchFound: false,
      });
      continue;
    }

    const candidates: Track[] = Array.isArray(searchPayload?.tracks)
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

    const evaluated = candidates
      .map((candidate) => scoreCandidate(sourceTrack, candidate, threshold))
      .sort((a, b) => b.combinedScore - a.combinedScore);

    allCandidates.push(...evaluated);
    const selected = evaluated.find((candidate) => candidate.combinedScore >= threshold && !candidate.rejectionReason) ?? null;

    attempts.push({
      searchQuery,
      topCandidates: evaluated.slice(0, 5),
      rejectionReason:
        selected
          ? "Matched candidate selected."
          : evaluated.length === 0
            ? "No search results returned."
            : evaluated[0]?.rejectionReason ?? "No candidate met the threshold.",
      matchFound: Boolean(selected),
    });

    if (selected) {
      chosenSearchQuery = searchQuery;
      chosenCandidate = selected;
      chosenConfidence = selected.combinedScore;
      chosenMatch = {
        id: selected.id,
        platformId: selected.id,
        name: selected.name,
        artist: selected.artist,
        album: selected.album,
        durationMs: selected.durationMs,
        imageUrl: undefined,
      };
      break;
    }
  }

  if (!chosenMatch) {
    const bestCandidate = [...allCandidates].sort((a, b) => b.combinedScore - a.combinedScore)[0] ?? null;
    chosenConfidence = bestCandidate?.combinedScore ?? 0;
    chosenCandidate = bestCandidate;
  }

  const diagnostics: MatchDiagnostics = {
    searchQueries,
    threshold,
    attempts,
    topCandidates: [...allCandidates].sort((a, b) => b.combinedScore - a.combinedScore).slice(0, 5),
    selectedCandidate: chosenCandidate,
    rejectionReason: chosenMatch
      ? "Matched candidate selected."
      : attempts.length === 0
        ? "No search queries were generated."
        : attempts.every((attempt) => attempt.rejectionReason === "No search results returned.")
          ? "No search results returned."
          : chosenCandidate?.rejectionReason ?? "No candidate met the threshold.",
  };

  return {
    match: chosenMatch,
    confidence: chosenConfidence,
    searchQuery: chosenSearchQuery,
    diagnostics,
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
  const playlistMetaEndpoint = `/playlists/${encodeURIComponent(playlistId)}?fields=id,name,public,collaborative,owner(id,display_name),tracks(total)`;
  const playlistMetaResult = await spotifyApiRequest(playlistMetaEndpoint, state);
  state = playlistMetaResult.state;
  const meta = playlistMetaResult.data ?? {};
  console.log("[transfer:spotify] playlist access preflight", {
    playlistId,
    endpoint: playlistMetaEndpoint,
    status: 200,
    name: meta?.name ?? null,
    public: meta?.public ?? null,
    collaborative: meta?.collaborative ?? null,
    ownerId: meta?.owner?.id ?? null,
    ownerDisplayName: meta?.owner?.display_name ?? null,
    totalFromMeta: meta?.tracks?.total ?? null,
  });

  while (true) {
    const endpoint = `/playlists/${encodeURIComponent(playlistId)}/items?limit=${pageSize}&offset=${offset}`;
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
    console.log("[transfer:spotify] playlist items page raw response", {
      playlistId,
      endpoint,
      offset,
      rawItemsLength: items.length,
      firstRawItem: items[0] ?? null,
      firstRawItemKeys: items[0] ? Object.keys(items[0]) : [],
      firstRawItemNestedItemKeys:
        items[0]?.item ? Object.keys(items[0].item) : [],
    });

    let excludedNoTrack = 0;
    let excludedMissingIdOrName = 0;
    let parsedCountBeforeThisPage = tracks.length;

    for (const item of items) {
      const track = item?.item ?? item?.track ?? item;
      if (!track) {
        excludedNoTrack += 1;
        continue;
      }
      const mapped = mapSpotifyTrack(track);
      if (!mapped) {
        excludedMissingIdOrName += 1;
        continue;
      }
      tracks.push(mapped);
    }

    const pageParsedTracks = tracks.slice(parsedCountBeforeThisPage);
    console.log("[transfer:spotify] playlist items page parse diagnostics", {
      playlistId,
      endpoint,
      offset,
      rawItemsLength: items.length,
      parsedTracksOnPage: pageParsedTracks.length,
      totalParsedTracks: tracks.length,
      excludedNoTrack,
      excludedMissingIdOrName,
      firstParsedTrack: pageParsedTracks[0] ?? null,
      firstRawItemSummary: items[0] ? describeSpotifyPlaylistItem(items[0]) : null,
    });

    if (items.length < pageSize) break;
    offset += items.length;
    if (offset > 20_000) break;
  }

  return { tracks, state };
}

async function runKnownPublicPlaylistProbe(state: SpotifySessionState): Promise<{ ok: boolean; status?: number; details?: string }> {
  // Spotify global top 50 playlist as a probe for generic tracks endpoint access.
  const probeId = "37i9dQZEVXbMDoHDwVN2tF";
  const endpoint = `/playlists/${probeId}/items?limit=1`;
  try {
    await spotifyApiRequest(endpoint, state);
    console.log("[transfer:spotify] public-playlist probe succeeded", { endpoint });
    return { ok: true };
  } catch (error) {
    if (error instanceof SpotifyTransferError) {
      console.error("[transfer:spotify] public-playlist probe failed", {
        endpoint,
        status: error.status,
        details: error.details,
      });
      return { ok: false, status: error.status, details: error.details };
    }
    console.error("[transfer:spotify] public-playlist probe failed with unexpected error", { endpoint });
    return { ok: false };
  }
}

function buildErrorResponse(
  request: NextRequest,
  message: string,
  status: number,
  sessionId: string | null,
  transferId?: string
) {
  const response = NextResponse.json({ error: message }, { status });
  if (status === 401) {
    clearSpotifyCookies(response, request);
    if (sessionId) {
      clearPlatformSession(sessionId, "spotify");
    }
  }
  if (transferId) {
    upsertTransferProgress(transferId, {
      status: "error",
      error: message,
      result: { error: message, status },
    });
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
  const transferId = body?.transferId?.trim() || randomUUID();
  const retryTrackIds = Array.isArray(body?.retryTrackIds)
    ? body.retryTrackIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const retryTrackIdSet = new Set(retryTrackIds);
  const matchMode = body?.matchMode === "relaxed" ? "relaxed" : "normal";
  const requestedTargetPlaylistId = body?.targetPlaylistId?.trim() || null;

  clearTransferProgress(transferId);
  upsertTransferProgress(transferId, {
    transferId,
    status: "running",
    playlistName,
    sourceTrackCount: 0,
    processedTrackCount: 0,
    transferredCount: 0,
    failedCount: 0,
    batchIndex: 0,
    totalBatches: 0,
    batchProcessedCount: 0,
    batchSize: 0,
    targetPlaylistId: requestedTargetPlaylistId,
    targetPlaylistUrl: requestedTargetPlaylistId ? `https://music.youtube.com/playlist?list=${requestedTargetPlaylistId}` : null,
  });

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
    transferId,
    sourcePlatform,
    targetPlatform,
    playlistId,
    playlistName,
    matchMode,
    retryTrackIdsCount: retryTrackIds.length,
    requestedTargetPlaylistId,
    host: canonicalHost,
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
      return buildErrorResponse(request, error.message, error.status, sessionId, transferId);
    }
    return buildErrorResponse(request, "Unable to validate Spotify session.", 500, sessionId, transferId);
  }

  let sourceTracks: Track[] = [];
  try {
    const sourceTracksResult = await fetchSpotifyPlaylistTracksForTransfer(playlistId, spotifyState);
    sourceTracks = sourceTracksResult.tracks;
    spotifyState = sourceTracksResult.state;
  } catch (error) {
    let friendlyError = "Unable to fetch source playlist tracks.";
    if (error instanceof SpotifyTransferError && error.status === 403) {
      const probe = await runKnownPublicPlaylistProbe(spotifyState);
      friendlyError = probe.ok
        ? "This specific Spotify playlist can't be read by the API for your account (access restricted by playlist settings/ownership). Please pick a different playlist."
        : "Spotify denied access while reading playlist tracks. Please reconnect Spotify and try another playlist.";
    }
    console.error("[transfer] source-track fetch failed", {
      elapsedMs: Date.now() - routeStartedAt,
      error: error instanceof Error ? error.message : String(error),
      spotifyStatus: error instanceof SpotifyTransferError ? error.status : undefined,
      spotifyErrorBody: error instanceof SpotifyTransferError ? error.details : undefined,
      spotifyEndpoint: error instanceof SpotifyTransferError ? error.endpoint : undefined,
    });
    if (error instanceof SpotifyTransferError) {
      return buildErrorResponse(request, friendlyError, error.status, sessionId, transferId);
    }
    return buildErrorResponse(request, friendlyError, 502, sessionId, transferId);
  }

  console.log("[transfer] source tracks fetched", {
    elapsedMs: Date.now() - routeStartedAt,
    playlistId,
    sourceTrackCount: sourceTracks.length,
  });

  const selectedRetryTrackIds = retryTrackIds.length > 0 ? retryTrackIdSet : null;
  if (selectedRetryTrackIds) {
    sourceTracks = sourceTracks.filter((track) => selectedRetryTrackIds.has(track.id));
    console.log("[transfer] filtered to retry tracks", {
      elapsedMs: Date.now() - routeStartedAt,
      retryTrackIdsCount: retryTrackIds.length,
      filteredTrackCount: sourceTracks.length,
    });
  }

  upsertTransferProgress(transferId, {
    status: "running",
    playlistName,
    sourceTrackCount: sourceTracks.length,
    processedTrackCount: 0,
    transferredCount: 0,
    failedCount: 0,
  });

  if (sourceTracks.length === 0) {
    const response = NextResponse.json({
      transferId,
      playlistName,
      sourceTrackCount: 0,
      processedTrackCount: 0,
      transferredCount: 0,
      failedCount: 0,
      failures: [] satisfies FailureItem[],
      targetPlaylistId: null,
      truncated: false,
      overallStatus: "failure" as const,
      transferDurationMs: Date.now() - routeStartedAt,
      completedAt: new Date().toISOString(),
      targetPlaylistUrl: null,
    });
    applySpotifySessionToResponse(response, request, sessionId, spotifyState);
    console.log("[transfer] finished early (no tracks)", {
      elapsedMs: Date.now() - routeStartedAt,
    });
    upsertTransferProgress(transferId, {
      status: "done",
      overallStatus: "failure",
      result: await response.clone().json().catch(() => null),
      transferDurationMs: Date.now() - routeStartedAt,
      completedAt: new Date().toISOString(),
    });
    return response;
  }

  let targetPlaylistId = requestedTargetPlaylistId;
  if (!targetPlaylistId) {
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

    targetPlaylistId = String(createPlaylistPayload.playlistId);
    console.log("[transfer] destination playlist created", {
      elapsedMs: Date.now() - routeStartedAt,
      playlistName,
      targetPlaylistId,
    });
  } else {
    console.log("[transfer] reusing existing destination playlist", {
      elapsedMs: Date.now() - routeStartedAt,
      playlistName,
      targetPlaylistId,
    });
  }

  const tracksToProcess = clampTracksForMatching(sourceTracks);
  const failures: FailureItem[] = [];
  let transferredCount = 0;
  let processedTrackCount = 0;
  const trackBatches = chunkArray(tracksToProcess, TRANSFER_BATCH_SIZE);
  const totalBatches = trackBatches.length;
  const cookieHeader = request.headers.get("cookie") ?? "";

  // Live per-track results — seeded as "pending" so the UI can render the full
  // list immediately, then flipped to "success"/"failed" as each track resolves.
  const trackResultsSnapshot: TrackResultSnapshot[] = tracksToProcess.map((track) => ({
    id: track.id,
    name: track.name,
    artist: track.artist,
    imageUrl: track.imageUrl,
    status: "pending",
  }));
  function markTrackResult(trackId: string, patch: Partial<TrackResultSnapshot>): TrackResultSnapshot[] {
    const idx = trackResultsSnapshot.findIndex((entry) => entry.id === trackId);
    if (idx >= 0) {
      trackResultsSnapshot[idx] = { ...trackResultsSnapshot[idx], ...patch };
    }
    return [...trackResultsSnapshot];
  }

  upsertTransferProgress(transferId, {
    status: "running",
    sourceTrackCount: tracksToProcess.length,
    processedTrackCount: 0,
    transferredCount: 0,
    failedCount: 0,
    totalBatches,
    batchIndex: 0,
    batchProcessedCount: 0,
    batchSize: 0,
    targetPlaylistId,
    targetPlaylistUrl: targetPlaylistId ? `https://music.youtube.com/playlist?list=${targetPlaylistId}` : null,
    trackResults: [...trackResultsSnapshot],
  });

  let cancelledByUser = false;

  try {
    batchLoop:
    for (const [batchIndex, batch] of trackBatches.entries()) {
      if (isTransferCancellationRequested(transferId)) {
        cancelledByUser = true;
        break;
      }

      console.log("[transfer] processing batch", {
        elapsedMs: Date.now() - routeStartedAt,
        batchIndex: batchIndex + 1,
        totalBatches,
        batchSize: batch.length,
      });

      upsertTransferProgress(transferId, {
        batchIndex: batchIndex + 1,
        totalBatches,
        batchSize: batch.length,
        batchProcessedCount: 0,
      });

      for (const [trackIndexInBatch, sourceTrack] of batch.entries()) {
        if (isTransferCancellationRequested(transferId)) {
          cancelledByUser = true;
          break batchLoop;
        }

        upsertTransferProgress(transferId, {
          currentTrackName: sourceTrack.name,
          currentTrackArtist: sourceTrack.artist,
          currentTrackIndex: processedTrackCount + 1,
          currentTrackTotal: tracksToProcess.length,
        });

        const matchResult = await findYouTubeMatchForSourceTrack({
          sourceTrack,
          appOrigin,
          cookieHeader,
          matchMode,
        });

        console.log("[transfer] track matching diagnostics", {
          transferId,
          sourceTrack: {
            id: sourceTrack.id,
            name: sourceTrack.name,
            artist: sourceTrack.artist,
            album: sourceTrack.album,
            durationMs: sourceTrack.durationMs,
          },
          searchQueries: matchResult.diagnostics.searchQueries,
          threshold: matchResult.diagnostics.threshold,
          rejectionReason: matchResult.diagnostics.rejectionReason,
          topCandidates: matchResult.diagnostics.topCandidates,
          selectedCandidate: matchResult.diagnostics.selectedCandidate,
          attempts: matchResult.diagnostics.attempts,
        });

        if (!matchResult.match?.id) {
          failures.push({
            sourceTrack,
            reason: matchResult.diagnostics.rejectionReason || "No sufficiently close YouTube match found.",
            searchQuery: matchResult.searchQuery,
            searchQueries: matchResult.diagnostics.searchQueries,
            threshold: matchResult.diagnostics.threshold,
            diagnostics: matchResult.diagnostics,
            retryEligible: matchMode === "normal",
          });
          processedTrackCount += 1;
          upsertTransferProgress(transferId, {
            processedTrackCount,
            transferredCount,
            failedCount: failures.length,
            batchProcessedCount: trackIndexInBatch + 1,
            trackResults: markTrackResult(sourceTrack.id, {
              status: "failed",
              failureReason: matchResult.diagnostics.rejectionReason || "No sufficiently close YouTube match found.",
            }),
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
                cookie: cookieHeader,
              },
              body: JSON.stringify({
                playlistId: targetPlaylistId,
                videoId: matchResult.match.id,
              }),
              cache: "no-store",
            }
          );

          const addPayload = await addResponse.json().catch(() => null);
          if (!addResponse.ok) {
            failures.push({
              sourceTrack,
              reason: addPayload?.error ?? "Failed to add matched track to YouTube playlist.",
              searchQuery: matchResult.searchQuery,
              searchQueries: matchResult.diagnostics.searchQueries,
              threshold: matchResult.diagnostics.threshold,
              diagnostics: matchResult.diagnostics,
              retryEligible: matchMode === "normal",
            });
            processedTrackCount += 1;
            upsertTransferProgress(transferId, {
              processedTrackCount,
              transferredCount,
              failedCount: failures.length,
              batchProcessedCount: trackIndexInBatch + 1,
              trackResults: markTrackResult(sourceTrack.id, {
                status: "failed",
                failureReason: addPayload?.error ?? "Failed to add matched track to YouTube playlist.",
              }),
            });
            await sleep(TRANSFER_STEP_DELAY_MS);
            continue;
          }

          transferredCount += 1;
          processedTrackCount += 1;
          upsertTransferProgress(transferId, {
            processedTrackCount,
            transferredCount,
            failedCount: failures.length,
            batchProcessedCount: trackIndexInBatch + 1,
            trackResults: markTrackResult(sourceTrack.id, { status: "success" }),
          });
        } catch {
          failures.push({
            sourceTrack,
            reason: "Failed to add matched track to YouTube playlist.",
            searchQuery: matchResult.searchQuery,
            searchQueries: matchResult.diagnostics.searchQueries,
            threshold: matchResult.diagnostics.threshold,
            diagnostics: matchResult.diagnostics,
            retryEligible: matchMode === "normal",
          });
          processedTrackCount += 1;
          upsertTransferProgress(transferId, {
            processedTrackCount,
            transferredCount,
            failedCount: failures.length,
            batchProcessedCount: trackIndexInBatch + 1,
            trackResults: markTrackResult(sourceTrack.id, {
              status: "failed",
              failureReason: "Failed to add matched track to YouTube playlist.",
            }),
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
    upsertTransferProgress(transferId, {
      status: "error",
      error: "Transfer failed unexpectedly during processing. Please try again.",
      processedTrackCount,
      transferredCount,
      failedCount: failures.length,
      result: null,
    });
    return response;
  }

  if (cancelledByUser) {
    console.log("[transfer] cancelled by user", {
      elapsedMs: Date.now() - routeStartedAt,
      transferId,
      processedTrackCount,
      transferredCount,
      failedCount: failures.length,
    });

    const cancelledCompletedAt = new Date().toISOString();
    const cancelledDurationMs = Date.now() - routeStartedAt;
    const cancelledTargetPlaylistUrl = targetPlaylistId ? `https://music.youtube.com/playlist?list=${targetPlaylistId}` : null;

    const response = NextResponse.json({
      transferId,
      playlistName,
      sourceTrackCount: sourceTracks.length,
      processedTrackCount,
      transferredCount,
      failedCount: failures.length,
      failedTracks: failures,
      failures,
      targetPlaylistId,
      targetPlaylistUrl: cancelledTargetPlaylistUrl,
      transferDurationMs: cancelledDurationMs,
      completedAt: cancelledCompletedAt,
      overallStatus: "cancelled",
      cancelled: true,
      truncated: true,
    });
    applySpotifySessionToResponse(response, request, sessionId, spotifyState);
    upsertTransferProgress(transferId, {
      status: "cancelled",
      overallStatus: "cancelled",
      processedTrackCount,
      transferredCount,
      failedCount: failures.length,
      completedAt: cancelledCompletedAt,
      transferDurationMs: cancelledDurationMs,
      result: null,
    });
    clearTransferCancellation(transferId);
    return response;
  }

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

  const completedAt = new Date().toISOString();
  const transferDurationMs = Date.now() - routeStartedAt;
  const overallStatus = failedCount === 0 ? "success" : transferredCount > 0 ? "partial" : "failure";
  const targetPlaylistUrl = targetPlaylistId ? `https://music.youtube.com/playlist?list=${targetPlaylistId}` : null;
  const payload = {
    transferId,
    playlistName,
    sourceTrackCount: sourceTracks.length,
    processedTrackCount,
    transferredCount,
    failedCount,
    failedTracks: failures,
    failures,
    targetPlaylistId,
    targetPlaylistUrl,
    transferDurationMs,
    completedAt,
    overallStatus,
    truncated: sourceTracks.length > processedTrackCount,
  };

  const response = NextResponse.json(payload);
  applySpotifySessionToResponse(response, request, sessionId, spotifyState);
  upsertTransferProgress(transferId, {
    status: "done",
    playlistName,
    sourceTrackCount: sourceTracks.length,
    processedTrackCount,
    transferredCount,
    failedCount,
    targetPlaylistId,
    targetPlaylistUrl,
    transferDurationMs,
    completedAt,
    overallStatus,
    result: payload,
  });
  clearTransferCancellation(transferId);
  return response;
}
