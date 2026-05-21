import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, isSameOriginMutation } from "@/lib/security";
import { Track, TrackMatchResult } from "@/types";
import { findBestMatch } from "@/lib/matcher";

export const dynamic = "force-dynamic";

type SupportedPlatform = "spotify" | "youtube";

const TRANSFER_RATE_LIMIT = { limit: 20, windowMs: 60_000 };
const SEARCH_LIMIT = 8;
const MATCH_LIMIT = 250;

type TransferRequestBody = {
  sourcePlatform?: SupportedPlatform;
  targetPlatform?: SupportedPlatform;
  playlistId?: string;
};

function isSupportedPlatform(value: unknown): value is SupportedPlatform {
  return value === "spotify" || value === "youtube";
}

function clampTracksForMatching<T>(tracks: T[], max = MATCH_LIMIT): T[] {
  if (tracks.length <= max) return tracks;
  return tracks.slice(0, max);
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(`transfer:prepare:${ip}`, TRANSFER_RATE_LIMIT.limit, TRANSFER_RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Transfer preparation rate limit reached. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: TransferRequestBody;
  try {
    body = (await request.json()) as TransferRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourcePlatform = body?.sourcePlatform;
  const targetPlatform = body?.targetPlatform;
  const playlistId = body?.playlistId?.trim();

  if (!isSupportedPlatform(sourcePlatform) || !isSupportedPlatform(targetPlatform)) {
    return NextResponse.json({ error: "Source and target platforms must be spotify or youtube." }, { status: 400 });
  }
  if (sourcePlatform === targetPlatform) {
    return NextResponse.json({ error: "Source and target platforms must be different." }, { status: 400 });
  }
  if (!playlistId) {
    return NextResponse.json({ error: "playlistId is required." }, { status: 400 });
  }

  const sourceTracksResponse = await fetch(
    new URL(`/api/${sourcePlatform}?resource=tracks&playlistId=${encodeURIComponent(playlistId)}`, request.url),
    {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    }
  );

  const sourceTracksPayload = await sourceTracksResponse.json().catch(() => null);
  if (!sourceTracksResponse.ok) {
    return NextResponse.json(
      { error: sourceTracksPayload?.error ?? "Unable to fetch source playlist tracks." },
      { status: sourceTracksResponse.status }
    );
  }

  const sourceTracks: Track[] = Array.isArray(sourceTracksPayload?.tracks)
    ? sourceTracksPayload.tracks
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

  if (sourceTracks.length === 0) {
    return NextResponse.json({
      sourceTrackCount: 0,
      processedTrackCount: 0,
      matchedCount: 0,
      failedCount: 0,
      results: [] satisfies TrackMatchResult[],
      truncated: false,
    });
  }

  const tracksToProcess = clampTracksForMatching(sourceTracks);
  const results: TrackMatchResult[] = [];

  for (const sourceTrack of tracksToProcess) {
    const query = `${sourceTrack.name} ${sourceTrack.artist}`.trim();
    let candidates: Track[] = [];

    try {
      const searchResponse = await fetch(
        new URL(
          `/api/${targetPlatform}?resource=search&query=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`,
          request.url
        ),
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
        // Gracefully continue; mark as unmatched.
        results.push({
          sourceTrack,
          matchedTrack: null,
          matched: false,
          confidence: 0,
        });
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
      results.push({
        sourceTrack,
        matchedTrack: null,
        matched: false,
        confidence: 0,
      });
      continue;
    }

    const { match, confidence } = findBestMatch(sourceTrack, candidates);
    results.push({
      sourceTrack,
      matchedTrack: match,
      matched: match !== null,
      confidence,
    });
  }

  const matchedCount = results.filter((result) => result.matched).length;
  const failedCount = results.length - matchedCount;

  return NextResponse.json({
    sourceTrackCount: sourceTracks.length,
    processedTrackCount: results.length,
    matchedCount,
    failedCount,
    truncated: sourceTracks.length > tracksToProcess.length,
    results,
  });
}

