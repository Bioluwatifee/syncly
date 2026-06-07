import type { Track, TrackMatchResult } from "@/types";

// ─── Normalization ──────────────────────────────────────────────────────────

/**
 * Tags that commonly differ between platforms / appear in YouTube titles but
 * not Spotify, or vice versa.  All are stripped before comparison so that
 * "Wicked Game (Official Music Video)" and "Wicked Game - 2014 Remaster" both
 * reduce to "Wicked Game" before scoring.
 */
const VERSION_TAG_PATTERN =
  // YouTube-specific presentation tags
  "official\\s+music\\s+video|official\\s+music|official\\s+lyric\\s+video|official\\s+lyric|" +
  "official\\s+audio|official\\s+video|official\\s+visualizer|official\\s+hd|" +
  "lyric\\s+video|lyrics?\\s+video|lyrics?|music\\s+video|" +
  "audio\\s+only|visualizer|" +
  // Platform-quality suffixes
  "hd|hq|4k|uhd|remastered\\s+audio|high\\s+quality|" +
  // Version / edition tags
  "re-?master(?:ed)?|remaster(?:ed)?|" +
  "deluxe(?:\\s+(?:edition|version))?|anniversary(?:\\s+edition)?|" +
  "explicit|clean|acoustic|demo|radio\\s*edit|" +
  "mono|stereo|single\\s+version|extended(?:\\s+mix)?|" +
  "instrumental|bonus\\s+track|expanded(?:\\s+edition)?|" +
  "(?:\\d{4}\\s+)?edit|(?:\\d{4}\\s+)?mix|(?:\\d{4}\\s+)?version";

// NOTE: "live" is intentionally excluded from normalizeTitle's auto-strip so
// we can detect live-version candidates and handle them in scoring rather than
// silently discarding them from the index.

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    // ── featured-artist annotations ──────────────────────────────────────
    .replace(/\(feat\.?[^)]*\)/gi, "")
    .replace(/\[feat\.?[^\]]*\]/gi, "")
    .replace(/\(ft\.?[^)]*\)/gi, "")
    .replace(/\(featuring[^)]*\)/gi, "")
    .replace(/\(with [^)]*\)/gi, "")
    .replace(/\bfeat\.?\s+[\w&,.\s]+$/gi, "")
    .replace(/\bft\.?\s+[\w&,.\s]+$/gi, "")
    // ── bracketed / parenthesized years e.g. "(2016)" "[2016]" ──────────
    .replace(/[([]\s*\d{4}\s*[)\]]/g, "")
    // ── dash-suffix version info e.g. "- 2016 Remaster", "- Remastered 2009"
    .replace(new RegExp(`-\\s*(?:\\d{4}\\s*)?(?:${VERSION_TAG_PATTERN})(?:[^-]*)$`, "gi"), "")
    .replace(new RegExp(`-\\s*(?:${VERSION_TAG_PATTERN})\\s*(?:\\d{4})?(?:[^-]*)$`, "gi"), "")
    // ── parenthesized/bracketed tags e.g. "(Official Music Video)" "[Deluxe Edition]"
    .replace(new RegExp(`[([]\\s*(?:\\d{4}\\s*)?(?:${VERSION_TAG_PATTERN})[^)\\]]*[)\\]]`, "gi"), "")
    .replace(new RegExp(`[([]\\s*(?:${VERSION_TAG_PATTERN})\\s*(?:\\d{4})?[^)\\]]*[)\\]]`, "gi"), "")
    // ── strip everything after " - " that contains only version-like content
    //    (catches bare "Song - Official Music Video" without parens)
    .replace(new RegExp(`\\s+-\\s+(?:${VERSION_TAG_PATTERN})\\s*$`, "gi"), "")
    // ── strip punctuation and normalise whitespace ────────────────────────
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Same strip logic used when building search queries — removes noise tokens
 * that would confuse the YouTube Music search engine.
 */
export function stripForSearch(title: string): string {
  return title
    .replace(/[([]\s*\d{4}\s*[)\]]/g, "")
    .replace(new RegExp(`\\s*-\\s*(?:\\d{4}\\s*)?(?:${VERSION_TAG_PATTERN})[^-]*$`, "gi"), "")
    .replace(new RegExp(`\\s*-\\s*(?:${VERSION_TAG_PATTERN})\\s*(?:\\d{4})?[^-]*$`, "gi"), "")
    .replace(new RegExp(`\\s*[([]\\s*(?:\\d{4}\\s*)?(?:${VERSION_TAG_PATTERN})[^)\\]]*[)\\]]`, "gi"), "")
    .replace(new RegExp(`\\s*[([]\\s*(?:${VERSION_TAG_PATTERN})\\s*(?:\\d{4})?[^)\\]]*[)\\]]`, "gi"), "")
    .replace(/\s*\(feat\.?[^)]*\)/gi, "")
    .replace(/\s*\[feat\.?[^\]]*\]/gi, "")
    .replace(/\s*\(ft\.?[^)]*\)/gi, "")
    .replace(/\s*\(featuring[^)]*\)/gi, "")
    .replace(/\s*\(with [^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits an artist credit string into its component artist names, handling
 * "feat.", "ft.", "featuring", "with", "x", "vs", "&", and comma separators.
 */
const ARTIST_SEPARATOR_PATTERN = /,|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b|\bvs\.?\b/gi;

export function splitArtists(artist: string): string[] {
  return artist
    .split(ARTIST_SEPARATOR_PATTERN)
    .map((part) =>
      part
        // strip common YouTube channel suffixes that aren't part of the artist name
        .replace(/\b(?:vevo|official|records?|music|entertainment|hd|tv)\b/gi, "")
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
}

/** Returns just the primary/main artist, normalized for comparison. */
export function normalizeArtist(artist: string): string {
  return splitArtists(artist)[0] ?? "";
}

/** Extracts a featured artist mentioned in a track title, if any. */
export function extractFeaturedArtist(title: string): string | null {
  const match =
    title.match(/\((?:feat\.?|ft\.?|featuring|with)\s+([^)]+)\)/i) ??
    title.match(/\[(?:feat\.?|ft\.?|featuring)\s+([^\]]+)\]/i) ??
    title.match(/\b(?:feat\.?|ft\.?|featuring)\s+([\w&,.\s]+)$/i);
  if (!match?.[1]) return null;
  const cleaned = match[1].replace(/[^\w\s]/g, "").trim().toLowerCase();
  return cleaned || null;
}

// ─── String similarity ──────────────────────────────────────────────────────

/** Classic Levenshtein edit distance. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      curr.push(
        Math.min(curr[j] + 1, prev[j + 1] + 1, prev[j] + (a[i] === b[j] ? 0 : 1))
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Levenshtein similarity normalized to 0–1 (1 = identical). */
function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - levenshteinDistance(a, b) / maxLen;
}

/** Jaccard similarity over word-token sets — robust to word reordering. */
function tokenSetSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Hybrid similarity score (0–1).
 *   • Token-set Jaccard — handles word-order differences and partial overlap
 *   • Levenshtein ratio — handles spelling variations / typos
 *   • Containment bonus — when one string is fully within the other (e.g.
 *     "Stand By Me" ⊂ "Ben E King Stand By Me") we boost the score so a
 *     strong partial match isn't penalised for extra context words.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const tokenScore = tokenSetSimilarity(a, b);
  const charScore = levenshteinRatio(a, b);
  const containmentBonus = a.includes(b) || b.includes(a) ? 0.15 : 0;

  return Math.min(1, tokenScore * 0.5 + charScore * 0.4 + containmentBonus);
}

// ─── Legacy helpers (used by matchTracks) ──────────────────────────────────

export function findBestMatch(
  source: Track,
  candidates: Track[]
): { match: Track | null; confidence: number } {
  const normSourceTitle = normalizeTitle(source.name);
  const normSourceArtist = normalizeArtist(source.artist);
  let bestMatch: Track | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const titleScore = similarity(normSourceTitle, normalizeTitle(candidate.name));
    const artistScore = similarity(normSourceArtist, normalizeArtist(candidate.artist));
    const combined = titleScore * 0.75 + artistScore * 0.25;
    if (combined > bestScore) {
      bestScore = combined;
      bestMatch = candidate;
    }
  }

  const CONFIDENCE_THRESHOLD = 0.45;
  return bestScore >= CONFIDENCE_THRESHOLD
    ? { match: bestMatch, confidence: bestScore }
    : { match: null, confidence: bestScore };
}

export async function matchTracks(
  sourceTracks: Track[],
  searchFn: (query: string) => Promise<Track[]>
): Promise<TrackMatchResult[]> {
  const results: TrackMatchResult[] = [];
  for (const track of sourceTracks) {
    const query = `${track.name} ${track.artist}`;
    const candidates = await searchFn(query);
    const { match, confidence } = findBestMatch(track, candidates);
    results.push({ sourceTrack: track, matchedTrack: match, matched: match !== null, confidence });
  }
  return results;
}
