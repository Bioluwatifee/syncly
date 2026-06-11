import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, isSameOriginMutation } from "@/lib/security";
import { Track } from "@/types";
import {
  extractFeaturedArtist,
  normalizeArtist,
  normalizeTitle,
  similarity,
  splitArtists,
  stripForSearch,
} from "@/lib/matcher";
import {
  clearPlatformSession,
  getPlatformSession,
  getSessionIdFromRequest,
  setPlatformSession,
} from "@/lib/oauth-session";
import { clearTransferProgress, clearTransferCancellation, isTransferCancellationRequested, upsertTransferProgress, type TrackResultSnapshot } from "@/lib/transfer-progress";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
const TRANSFER_STEP_DELAY_MS = 300;           // delay between each track — fast but avoids mass 429s
const RATE_LIMIT_RETRY_DELAY_MS = 3_000;      // pause on 429, retry once, then move on
const ECONNRESET_MAX_RETRIES = 3;             // retries on connection-level errors (ECONNRESET, hang-up)
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

/**
 * fetch() wrapper that:
 *  - Retries up to ECONNRESET_MAX_RETRIES times on connection-level errors
 *    (ECONNRESET, socket hang-up, FetchError, etc.) with a short linear back-off.
 *  - On HTTP 429 retries once after RATE_LIMIT_RETRY_DELAY_MS, then returns the
 *    429 response so callers can record the failure without crashing the transfer.
 */
async function fetchWithRetry(
  url: URL | string,
  init: RequestInit,
  maxRetries = ECONNRESET_MAX_RETRIES
): Promise<Response> {
  let lastError: unknown;
  // 429 is retried exactly once — separate from the connection-error budget so a
  // rate-limit hit doesn't burn one of the three ECONNRESET retry slots.
  let rateLimitRetried = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 && !rateLimitRetried) {
        rateLimitRetried = true;
        console.warn("[transfer] 429 — waiting 3 s then retrying once");
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        attempt -= 1; // don't charge this against the connection-error budget
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      const isConnectionError =
        err instanceof Error &&
        (err.message.includes("ECONNRESET") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("socket hang up") ||
          err.message.includes("network") ||
          (err as NodeJS.ErrnoException).code === "ECONNRESET");
      if (isConnectionError && attempt < maxRetries) {
        const delay = 500 * (attempt + 1);
        console.warn("[transfer] connection error — retrying", {
          attempt: attempt + 1,
          delay,
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Reads `Set-Cookie` headers from an internal `/api/youtube` response and merges
 * any updated YouTube token cookies back into the cookie string we send for
 * subsequent YouTube calls.  This propagates token refreshes that the YouTube
 * route performs internally so we don't keep re-using an expired access token.
 */
function mergeRefreshedYoutubeCookies(cookieHeader: string, response: Response): string {
  let setCookies: string[] = [];
  if (typeof (response.headers as any).getSetCookie === "function") {
    setCookies = (response.headers as any).getSetCookie() as string[];
  } else {
    const single = response.headers.get("set-cookie");
    if (single) setCookies = [single];
  }
  if (setCookies.length === 0) return cookieHeader;

  // Parse current cookie string into a mutable map
  const map: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    map[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }

  // Override with values from Set-Cookie response headers
  for (const sc of setCookies) {
    const nameValue = sc.split(";")[0] ?? "";
    const eq = nameValue.indexOf("=");
    if (eq < 1) continue;
    const name = nameValue.slice(0, eq).trim();
    const value = nameValue.slice(eq + 1).trim();
    if (name) map[name] = value;
  }

  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
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
    isrc: track?.external_ids?.isrc ? String(track.external_ids.isrc) : undefined,
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

// Search-query strip helper — delegates to the shared normalizer in matcher.ts
// so query building and score normalization use identical cleaning rules.
const stripSearchSuffixes = stripForSearch;

/**
 * Builds an ordered fallback list of search queries, from most specific to
 * most permissive:
 *   1. Full title + full artist credit
 *   2. Cleaned (noise-stripped) title + main artist only
 *   3. Cleaned title alone
 *   4. ISRC code (if Spotify provided one) — last resort, exact-recording lookup
 * Plus a few relaxed-mode variants (featured-artist swap, raw title + main artist).
 */
function buildSearchQueries(track: Track, relaxed = false): string[] {
  const rawTitle = track.name.trim();
  const strippedTitle = stripSearchSuffixes(track.name);
  const fullArtist = track.artist.trim();
  const mainArtist = normalizeArtist(track.artist) || (track.artist.split(",")[0]?.trim() ?? "");
  const featuredArtist = extractFeaturedArtist(track.name);
  const isrc = track.isrc?.trim();

  const queries = [
    // Try 1 — full title + full artist
    `${rawTitle} ${fullArtist}`.trim(),
    // Try 2 — cleaned title + main artist only
    `${strippedTitle} ${mainArtist}`.trim(),
    // Try 3 — cleaned title alone
    strippedTitle,
  ];

  if (featuredArtist) {
    queries.push(`${strippedTitle} ${featuredArtist}`.trim());
    queries.push(`${strippedTitle} ${mainArtist} ${featuredArtist}`.trim());
  }

  if (relaxed) {
    queries.push(rawTitle);
    queries.push(`${rawTitle} ${mainArtist}`.trim());
    const allArtists = splitArtists(track.artist);
    for (const artistName of allArtists.slice(1, 3)) {
      queries.push(`${strippedTitle} ${artistName}`.trim());
    }
  }

  // Try 4 — ISRC (exact-recording identifier), last resort only
  if (isrc) {
    queries.push(isrc);
  }

  return dedupeStrings(queries);
}

const VERSION_TAG_TERMS = ["live", "remix", "acoustic", "cover", "karaoke", "instrumental", "tribute"] as const;

function detectVersionTag(name: string): (typeof VERSION_TAG_TERMS)[number] | null {
  const normalized = name.toLowerCase();
  for (const term of VERSION_TAG_TERMS) {
    if (normalized.includes(term)) return term;
  }
  return null;
}

/**
 * Maps an internal/technical rejection reason to a short, human-readable
 * explanation suitable for display to end users.
 */
function humanizeRejectionReason(reason: string | null | undefined): string {
  if (!reason) return "Couldn't find a close enough match";
  const normalized = reason.toLowerCase();

  if (normalized.includes("no search results") || normalized.includes("not available")) {
    return "Not available on YouTube Music";
  }
  if (normalized.includes("region")) {
    return "Region restricted";
  }
  if (normalized.includes("filtered as") || normalized.includes("only live") || normalized.includes("only remix")) {
    return "Only live or remix versions found";
  }
  if (normalized.includes("instrumental") || normalized.includes("alternate")) {
    return "Instrumental or alternate version only";
  }
  if (normalized.includes("similarity") || normalized.includes("threshold") || normalized.includes("below")) {
    return "Couldn't find a close enough match";
  }
  if (normalized.includes("artist mismatch") || normalized.includes("duration mismatch")) {
    return "Couldn't find a close enough match";
  }
  return "Couldn't find a close enough match";
}

function scoreCandidate(sourceTrack: Track, candidate: Track, threshold: number): MatchCandidateDiagnostic {
  const sourceTitle = normalizeTitle(sourceTrack.name);
  const sourceArtist = normalizeArtist(sourceTrack.artist);
  const candidateTitle = normalizeTitle(candidate.name);
  const candidateArtist = normalizeArtist(candidate.artist);

  const titleScore = similarity(sourceTitle, candidateTitle);
  const artistScore = similarity(sourceArtist, candidateArtist);

  // Title carries most of the weight — a song with the right title is more
  // likely the correct track than one with the right artist but wrong title.
  let combinedScore = titleScore * 0.75 + artistScore * 0.25;

  const durationDeltaMs =
    Number.isFinite(sourceTrack.durationMs) &&
    Number.isFinite(candidate.durationMs) &&
    candidate.durationMs > 0
      ? Math.abs(sourceTrack.durationMs - candidate.durationMs)
      : null;

  // Duration: soft signal only.  Within 10 s = bonus; 10–60 s = minor penalty;
  // beyond 60 s = larger penalty.  We never hard-reject on duration alone
  // because YouTube Music duration metadata is often slightly off.
  const durationStatus: MatchCandidateDiagnostic["durationStatus"] =
    durationDeltaMs === null
      ? "unavailable"
      : durationDeltaMs <= 10_000
        ? "matched"
        : durationDeltaMs <= 60_000
          ? "matched"
          : "mismatch";

  if (durationDeltaMs !== null) {
    if (durationDeltaMs <= 10_000) combinedScore = Math.min(1, combinedScore + 0.05);
    else if (durationDeltaMs <= 60_000) combinedScore = Math.max(0, combinedScore - 0.02);
    else combinedScore = Math.max(0, combinedScore - 0.08);
  }

  const sourceVersionTag = detectVersionTag(sourceTrack.name);
  const candidateVersionTag = detectVersionTag(candidate.name);

  let rejectionReason: string | null = null;

  // Only hard-reject karaoke / tribute — these are never good substitutes for
  // the original.  Live, remix, acoustic etc. are only rejected when the
  // *title score is low* (meaning it's not clearly the same song); if the
  // title matches well we accept the version rather than returning nothing.
  if (candidateVersionTag === "karaoke" || candidateVersionTag === "tribute") {
    rejectionReason = `Filtered as ${candidateVersionTag} version`;
  } else if (
    candidateVersionTag &&
    !sourceVersionTag &&
    titleScore < 0.72 &&
    (candidateVersionTag === "live" || candidateVersionTag === "remix")
  ) {
    rejectionReason = `Filtered as ${candidateVersionTag} version`;
  } else if (candidateVersionTag === "instrumental" && !sourceVersionTag && titleScore < 0.72) {
    rejectionReason = "Instrumental or alternate version only";
  } else if (artistScore < 0.20 && titleScore < 0.80) {
    // Low artist score only matters when the title match is also weak.
    // If the title is a strong match (≥ 0.80) we accept regardless of artist
    // formatting differences — this is common with Nigerian/Afrobeats artists
    // where YouTube Music credits differ significantly from Spotify metadata.
    rejectionReason = "Artist mismatch";
  } else if (combinedScore < threshold && titleScore < 0.80) {
    // If the title is a strong match on its own, don't reject on combined score —
    // a weak artist score drags combined down but the song is clearly correct.
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
  const threshold = matchMode === "relaxed" ? 0.38 : 0.45;
  const searchQueries = buildSearchQueries(sourceTrack, matchMode === "relaxed");
  const attempts: MatchDiagnostics["attempts"] = [];
  const allCandidates: MatchCandidateDiagnostic[] = [];
  let chosenMatch: Track | null = null;
  let chosenConfidence = 0;
  let chosenSearchQuery = searchQueries[0] ?? `${sourceTrack.name} ${sourceTrack.artist}`.trim();
  let chosenCandidate: MatchCandidateDiagnostic | null = null;

  for (const searchQuery of searchQueries) {
    const searchUrl = new URL(`/api/youtube?resource=search&query=${encodeURIComponent(searchQuery)}&limit=${SEARCH_LIMIT}`, appOrigin);
    const searchResponse = await fetchWithRetry(searchUrl, {
      method: "GET",
      headers: { cookie: cookieHeader },
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

  const sortedCandidates = [...allCandidates].sort((a, b) => b.combinedScore - a.combinedScore);

  if (!chosenMatch) {
    // Best-effort fallback: if a clean match wasn't found above the normal
    // threshold, accept the highest-scoring candidate that:
    //   - has a score above a very low floor (0.35)
    //   - is NOT karaoke or tribute (unusable substitutes)
    //   - has a title score of at least 0.55 (we need the right song, not just
    //     an artist match with a different title)
    // This catches cases where a live version, music video, or slightly
    // mismatched artist metadata is the only copy on YouTube Music.
    const BEST_EFFORT_FLOOR = 0.35;
    const TITLE_FLOOR = 0.55;
    const bestEffortCandidate = sortedCandidates.find(
      (c) =>
        c.combinedScore >= BEST_EFFORT_FLOOR &&
        c.titleScore >= TITLE_FLOOR &&
        c.rejectionReason !== "Filtered as karaoke version" &&
        c.rejectionReason !== "Filtered as tribute version"
    ) ?? null;

    if (bestEffortCandidate) {
      // Accept it — log that we used best-effort so the threshold can be tuned.
      console.log("[matcher:best-effort-accept]", {
        track: `${sourceTrack.name} — ${sourceTrack.artist}`,
        accepted: `${bestEffortCandidate.name} — ${bestEffortCandidate.artist}`,
        titleScore: bestEffortCandidate.titleScore.toFixed(3),
        artistScore: bestEffortCandidate.artistScore.toFixed(3),
        combinedScore: bestEffortCandidate.combinedScore.toFixed(3),
        overriddenRejection: bestEffortCandidate.rejectionReason,
      });
      chosenCandidate = bestEffortCandidate;
      chosenConfidence = bestEffortCandidate.combinedScore;
      chosenMatch = {
        id: bestEffortCandidate.id,
        platformId: bestEffortCandidate.id,
        name: bestEffortCandidate.name,
        artist: bestEffortCandidate.artist,
        album: bestEffortCandidate.album,
        durationMs: bestEffortCandidate.durationMs,
        imageUrl: undefined,
      };
    } else {
      chosenConfidence = sortedCandidates[0]?.combinedScore ?? 0;
      chosenCandidate = sortedCandidates[0] ?? null;
    }
  }

  const noResultsOnAllAttempts =
    attempts.length > 0 &&
    attempts.every((a) => a.rejectionReason === "No search results returned.");

  const technicalRejectionReason: string = chosenMatch
    ? "Matched candidate selected."
    : attempts.length === 0
      ? "No search queries were generated."
      : noResultsOnAllAttempts
        ? "No search results returned."
        : chosenCandidate?.rejectionReason ?? "No candidate met the threshold.";

  const userFacingRejectionReason = chosenMatch
    ? "Matched candidate selected."
    : humanizeRejectionReason(technicalRejectionReason);

  // Always log scores for failed tracks — actionable in Vercel logs.
  if (!chosenMatch) {
    console.log("[matcher:failed]", {
      track: `${sourceTrack.name} — ${sourceTrack.artist}`,
      isrc: sourceTrack.isrc ?? null,
      mode: matchMode,
      threshold,
      queriesAttempted: searchQueries,
      fallbackStrategiesUsed: attempts.length,
      technicalRejection: technicalRejectionReason,
      userFacingReason: userFacingRejectionReason,
      top3Results: sortedCandidates.slice(0, 3).map((c) => ({
        youtubeTitle: c.name,
        youtubeArtist: c.artist,
        titleScore: c.titleScore.toFixed(3),
        artistScore: c.artistScore.toFixed(3),
        combinedScore: c.combinedScore.toFixed(3),
        rejection: c.rejectionReason,
      })),
    });
  }

  const diagnostics: MatchDiagnostics = {
    searchQueries,
    threshold,
    attempts,
    topCandidates: sortedCandidates.slice(0, 5),
    selectedCandidate: chosenCandidate,
    rejectionReason: userFacingRejectionReason,
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

  // ── Set up track lists and seed the live UI before any YouTube calls ────────
  // Moving this BEFORE playlist creation means the track list is visible in the
  // UI immediately, even if there is a delay or error creating the playlist.
  const tracksToProcess = clampTracksForMatching(sourceTracks);
  const failures: FailureItem[] = [];
  let transferredCount = 0;
  let processedTrackCount = 0;
  // `let` — may be updated with refreshed YouTube tokens after each internal call
  let cookieHeader = request.headers.get("cookie") ?? "";

  // Live per-track results — seeded as "pending" so the UI renders the full list
  // immediately, then flipped to "success"/"failed" as each track resolves.
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

  // Seed the progress store with the full track list so the UI shows immediately
  upsertTransferProgress(transferId, {
    status: "running",
    playlistName,
    sourceTrackCount: tracksToProcess.length,
    processedTrackCount: 0,
    transferredCount: 0,
    failedCount: 0,
    trackResults: [...trackResultsSnapshot],
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

  // ── Create destination YouTube playlist ──────────────────────────────────────
  let targetPlaylistId = requestedTargetPlaylistId;
  if (!targetPlaylistId) {
    const createPlaylistResponse = await fetch(
      new URL(`/api/youtube?resource=createPlaylist`, appOrigin),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookieHeader,
        },
        body: JSON.stringify({
          title: playlistName,
          description: `Transferred from Spotify by Syncly on ${new Date().toISOString()}`,
        }),
        cache: "no-store",
      }
    );

    // Propagate any refreshed YouTube tokens back into cookieHeader so all
    // subsequent search and add calls use the up-to-date access token.
    cookieHeader = mergeRefreshedYoutubeCookies(cookieHeader, createPlaylistResponse);

    const createPlaylistPayload = await createPlaylistResponse.json().catch(() => null);
    if (!createPlaylistResponse.ok || !createPlaylistPayload?.playlistId) {
      console.error("[transfer] destination playlist creation failed", {
        playlistName,
        status: createPlaylistResponse.status,
        error: createPlaylistPayload?.error ?? "Unknown create playlist error",
      });

      // Surface YouTube auth errors clearly so the client shows the right message
      const isYouTubeAuthError = createPlaylistResponse.status === 401 || createPlaylistResponse.status === 403;
      const errorMessage = isYouTubeAuthError
        ? "YouTube Music session expired. Please reconnect YouTube Music."
        : (createPlaylistPayload?.error ?? "Unable to create destination YouTube playlist.");
      const errorStatus = isYouTubeAuthError ? 401 : (createPlaylistResponse.status || 502);

      upsertTransferProgress(transferId, { status: "error", error: errorMessage });
      const response = NextResponse.json({ error: errorMessage }, { status: errorStatus });
      applySpotifySessionToResponse(response, request, sessionId, spotifyState);
      console.error("[transfer] failed during destination playlist creation", {
        elapsedMs: Date.now() - routeStartedAt,
        isYouTubeAuthError,
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

  // Update progress with the now-known target playlist URL
  upsertTransferProgress(transferId, {
    status: "running",
    sourceTrackCount: tracksToProcess.length,
    processedTrackCount: 0,
    transferredCount: 0,
    failedCount: 0,
    totalBatches: tracksToProcess.length,
    batchIndex: 0,
    batchProcessedCount: 0,
    batchSize: 0,
    targetPlaylistId,
    targetPlaylistUrl: targetPlaylistId ? `https://music.youtube.com/playlist?list=${targetPlaylistId}` : null,
    trackResults: [...trackResultsSnapshot],
  });

  let cancelledByUser = false;

  try {
    for (const sourceTrack of tracksToProcess) {
      if (isTransferCancellationRequested(transferId)) {
        cancelledByUser = true;
        break;
      }

      upsertTransferProgress(transferId, {
        currentTrackName: sourceTrack.name,
        currentTrackArtist: sourceTrack.artist,
        currentTrackIndex: processedTrackCount + 1,
        currentTrackTotal: tracksToProcess.length,
      });

      // ── Search ──────────────────────────────────────────────────────────────
      const matchResult = await findYouTubeMatchForSourceTrack({
        sourceTrack,
        appOrigin,
        cookieHeader,
        matchMode,
      });

      console.log("[transfer] track matching diagnostics", {
        transferId,
        sourceTrack: { id: sourceTrack.id, name: sourceTrack.name, artist: sourceTrack.artist, durationMs: sourceTrack.durationMs },
        searchQueries: matchResult.diagnostics.searchQueries,
        threshold: matchResult.diagnostics.threshold,
        rejectionReason: matchResult.diagnostics.rejectionReason,
        selectedCandidate: matchResult.diagnostics.selectedCandidate,
      });

      if (!matchResult.match?.id) {
        failures.push({
          sourceTrack,
          reason: matchResult.diagnostics.rejectionReason || "Couldn't find a close enough match",
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
          trackResults: markTrackResult(sourceTrack.id, {
            status: "failed",
            failureReason: matchResult.diagnostics.rejectionReason || "Couldn't find a close enough match",
          }),
        });
        await sleep(TRANSFER_STEP_DELAY_MS);
        continue;
      }

      // ── Add to playlist ─────────────────────────────────────────────────────
      try {
        const addResponse = await fetchWithRetry(
          new URL(`/api/youtube?resource=addPlaylistItem`, appOrigin),
          {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: cookieHeader },
            body: JSON.stringify({ playlistId: targetPlaylistId, videoId: matchResult.match.id }),
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
          trackResults: markTrackResult(sourceTrack.id, { status: "success" }),
        });
      } catch (addError) {
        console.error("[transfer] add error for track", {
          trackName: sourceTrack.name,
          error: addError instanceof Error ? addError.message : String(addError),
        });
        failures.push({
          sourceTrack,
          reason: "Failed to add track — connection error.",
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
          trackResults: markTrackResult(sourceTrack.id, {
            status: "failed",
            failureReason: "Failed to add track — connection error.",
          }),
        });
      }

      await sleep(TRANSFER_STEP_DELAY_MS);
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
