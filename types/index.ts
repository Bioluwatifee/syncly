// ─────────────────────────────────────────────
// Platform types
// ─────────────────────────────────────────────
export type Platform = "spotify" | "youtube" | "apple";

export interface PlatformConfig {
  id: Platform;
  label: string;
  color: string;
}

// ─────────────────────────────────────────────
// Music data types
// ─────────────────────────────────────────────
export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  imageUrl?: string;
  platformId?: string; // the ID on the source platform
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  trackCount: number;
  platform: Platform;
  tracks?: Track[];
}

// ─────────────────────────────────────────────
// Transfer types
// ─────────────────────────────────────────────
export type TransferStatus = "idle" | "fetching" | "matching" | "creating" | "done" | "error";

export interface TrackMatchResult {
  sourceTrack: Track;
  matchedTrack: Track | null;
  matched: boolean;
  confidence?: number;
}

export interface Transfer {
  id: string;
  userId: string;
  sourcePlatform: Platform;
  targetPlatform: Platform;
  sourcePlaylistId: string;
  sourcePlaylistName: string;
  status: TransferStatus;
  totalTracks: number;
  matchedTracks: number;
  failedTracks: number;
  results: TrackMatchResult[];
  createdAt: string;
  completedAt?: string;
}

// ─────────────────────────────────────────────
// Auth / User types
// ─────────────────────────────────────────────
export interface ConnectedPlatform {
  platform: Platform;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
  displayName?: string;
}

export interface User {
  id: string;
  email: string;
  connectedPlatforms: ConnectedPlatform[];
  transferHistory: Transfer[];
}
