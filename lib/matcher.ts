import type { Track, TrackMatchResult } from "@/types";

/**
 * Normalizes a string for fuzzy comparison:
 * - lowercase
 * - strips features like "(feat. X)", "(ft. X)"
 * - strips remaster/live/deluxe tags
 * - strips punctuation
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(feat\.?.*?\)/gi, "")
    .replace(/\(ft\.?.*?\)/gi, "")
    .replace(/\(with .*?\)/gi, "")
    .replace(/- remaster(ed)?(\s\d{4})?/gi, "")
    .replace(/- live.*$/gi, "")
    .replace(/\(deluxe.*?\)/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArtist(artist: string): string {
  return artist
    .toLowerCase()
    .split(",")[0] // take primary artist only
    .replace(/[^\w\s]/g, "")
    .trim();
}

/**
 * Simple similarity score between two strings (0–1).
 * Uses character-level overlap as a fast heuristic.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const longerLen = longer.length;

  if (longerLen === 0) return 1;

  let matches = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matches++;
  }

  return matches / longerLen;
}

/**
 * Given a source track and a list of candidates from the target platform,
 * returns the best match and a confidence score.
 */
export function findBestMatch(
  source: Track,
  candidates: Track[]
): { match: Track | null; confidence: number } {
  const normSourceTitle = normalizeTitle(source.name);
  const normSourceArtist = normalizeArtist(source.artist);

  let bestMatch: Track | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const normCandTitle = normalizeTitle(candidate.name);
    const normCandArtist = normalizeArtist(candidate.artist);

    const titleScore = similarity(normSourceTitle, normCandTitle);
    const artistScore = similarity(normSourceArtist, normCandArtist);

    // Weight: title matters more than artist
    const combined = titleScore * 0.6 + artistScore * 0.4;

    if (combined > bestScore) {
      bestScore = combined;
      bestMatch = candidate;
    }
  }

  // Only accept matches above threshold
  const CONFIDENCE_THRESHOLD = 0.75;
  if (bestScore < CONFIDENCE_THRESHOLD) {
    return { match: null, confidence: bestScore };
  }

  return { match: bestMatch, confidence: bestScore };
}

/**
 * Matches an array of source tracks against search results from the target platform.
 * searchFn should call the target platform's search API for a given query.
 */
export async function matchTracks(
  sourceTracks: Track[],
  searchFn: (query: string) => Promise<Track[]>
): Promise<TrackMatchResult[]> {
  const results: TrackMatchResult[] = [];

  for (const track of sourceTracks) {
    const query = `${track.name} ${track.artist}`;
    const candidates = await searchFn(query);
    const { match, confidence } = findBestMatch(track, candidates);

    results.push({
      sourceTrack: track,
      matchedTrack: match,
      matched: match !== null,
      confidence,
    });
  }

  return results;
}
