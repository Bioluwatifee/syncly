"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "@/types";
import PlatformSelector from "@/components/transfer/PlatformSelector";
import PlaylistList, { PlaylistItem } from "@/components/transfer/PlaylistList";
import { useToast } from "@/components/ui/ToastProvider";
import CheckMarkIcon from "@/components/ui/CheckMarkIcon";

const SPOTIFY_PLAYLIST_COUNT_CACHE_KEY = "syncly_spotify_playlist_count_cache_v2";
const YOUTUBE_PLAYLIST_COUNT_CACHE_KEY = "syncly_youtube_playlist_count_cache_v1";
const SPOTIFY_FORCE_FRESH_AUTH_KEY = "syncly_force_spotify_fresh_auth_once";
const PLAYLISTS_SESSION_CACHE_KEY = "syncly_playlists_session_cache_v1";
const PLAYLIST_COUNT_CACHE_TTL_MS = 15 * 60 * 1000;
const PLAYLIST_COUNT_MIN_GAP_MS = 1000;
const PLAYLIST_COUNT_COOLDOWN_MS = 5 * 60 * 1000;

interface TrackResult {
  id: string;
  name: string;
  artist: string;
  imageUrl?: string;
  status: "success" | "failed" | "pending";
  failureReason?: string;
  failureDetails?: {
    searchQuery: string;
    searchQueries: string[];
    threshold: number;
    diagnostics: {
      searchQueries: string[];
      threshold: number;
      attempts: Array<{
        searchQuery: string;
        topCandidates: Array<{
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
        }>;
        rejectionReason: string;
        matchFound: boolean;
      }>;
      topCandidates: Array<{
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
      }>;
      selectedCandidate: {
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
      } | null;
      rejectionReason: string;
    };
    retryEligible: boolean;
  };
}

type TransferViewState = "idle" | "transferring" | "success" | "partial" | "error" | "postRetryFailure";

interface TransferProgress {
  transferId: string;
  status: "idle" | "running" | "done" | "error";
  playlistName?: string;
  sourceTrackCount?: number;
  trackResults?: Array<{
    id: string;
    name: string;
    artist: string;
    imageUrl?: string;
    status: "pending" | "success" | "failed";
    failureReason?: string;
  }>;
  processedTrackCount?: number;
  transferredCount?: number;
  failedCount?: number;
  batchIndex?: number;
  totalBatches?: number;
  batchProcessedCount?: number;
  batchSize?: number;
  currentTrackName?: string;
  currentTrackArtist?: string;
  currentTrackIndex?: number;
  currentTrackTotal?: number;
  targetPlaylistId?: string | null;
  targetPlaylistUrl?: string | null;
  transferDurationMs?: number;
  completedAt?: string;
  error?: string;
  overallStatus?: "success" | "partial" | "failure";
  result?: any;
  updatedAt: number;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const SpotifyWordmark = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1ed760">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Spotify</span>
  </div>
);

const YouTubeMusicWordmark = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff4444">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>YouTube Music</span>
  </div>
);

const SwapIcon = () => (
  <div style={{
    width: 28, height: 28, borderRadius: "50%",
    border: "1.5px solid rgba(255,255,255,0.25)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3L4 7l4 4"/><path d="M4 7h16"/>
      <path d="M16 21l4-4-4-4"/><path d="M20 17H4"/>
    </svg>
  </div>
);

const CheckIcon = () => (
  <div style={{
    width: 26, height: 26, borderRadius: "50%", background: "#1ed760",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }}>
    <CheckMarkIcon size={13} color="#0a0a0b" />
  </div>
);

const XIcon = () => (
  <div style={{
    width: 26, height: 26, borderRadius: "50%", background: "#e85f47",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </div>
);

// ─── Shared button styles ─────────────────────────────────────────────────────
const btnBase: React.CSSProperties = {
  flex: 1, padding: "16px 16px", borderRadius: 100,
  fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
  cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
  letterSpacing: "0.2px", border: "none",
};
const btnWhite: React.CSSProperties  = { ...btnBase, background: "#fff",    color: "#0a0a0b" };
const btnYellow: React.CSSProperties = { ...btnBase, background: "#e8c547", color: "#0a0a0b" };

// ─── Progress bar (gradient) ──────────────────────────────────────────────────
function ProgressBar({ done, total, label, sublabel }: { done: number; total: number; label: string; sublabel?: string }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ height: 6, borderRadius: 100, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 8 }}>
        <div style={{
          height: "100%", borderRadius: 100,
          width: `${Math.round((done / total) * 100)}%`,
          background: "linear-gradient(90deg, #e8c547, #e85f47)",
          transition: "width 0.4s ease",
        }} />
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
        {label}
        {sublabel && (
          <span style={{ opacity: 0.45 }}>{" · "}{sublabel}</span>
        )}
      </div>
    </div>
  );
}

// ─── Success/fail split bar ───────────────────────────────────────────────────
function SplitBar({ success, failed, total }: { success: number; failed: number; total: number }) {
  const successPct = Math.round((success / total) * 100);
  const failedPct  = Math.round((failed  / total) * 100);
  return (
    <div style={{ margin: "16px 0 8px" }}>
      <div style={{ height: 8, borderRadius: 100, overflow: "hidden", background: "rgba(255,255,255,0.08)", display: "flex" }}>
        <div style={{ width: `${successPct}%`, background: "#1ed760", borderRadius: "100px 0 0 100px", transition: "width 0.4s ease" }} />
        <div style={{ width: `${failedPct}%`,  background: "#e85f47", borderRadius: failedPct === 100 ? 100 : "0 100px 100px 0", transition: "width 0.4s ease" }} />
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "#1ed760", flexShrink: 0 }} />
          {success} successful
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "#e85f47", flexShrink: 0 }} />
          {failed} failed
        </div>
      </div>
    </div>
  );
}

// ─── Playlist card (yellow border) ───────────────────────────────────────────
function PlaylistCard({ playlist, retryCount }: { playlist: PlaylistItem; retryCount?: number }) {
  const count = retryCount ?? playlist.trackCount;
  const showRetryLabel = retryCount !== undefined;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", borderRadius: 14,
      border: "1px solid rgba(232,197,71,0.7)",
      background: "rgba(232,197,71,0.04)",
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.08)" }}>
        {playlist.imageUrl && <img src={playlist.imageUrl} alt={playlist.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{playlist.name}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{playlist.owner}</div>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", flexShrink: 0, textAlign: "right" }}>
        <span>{count} songs</span>
        {showRetryLabel && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>(failed previously)</div>
        )}
      </div>
    </div>
  );
}

// ─── Platform row ─────────────────────────────────────────────────────────────
function PlatformRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
      <SpotifyWordmark />
      <SwapIcon />
      <YouTubeMusicWordmark />
    </div>
  );
}

// ─── Copy list button ─────────────────────────────────────────────────────────
function CopyFailedButton({ tracks }: { tracks: TrackResult[] }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    const text = tracks.map((t, i) => `${i + 1}. ${t.name} — ${t.artist}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "transparent", border: "none", padding: 0,
        fontSize: 13, color: "rgba(255,255,255,0.4)",
        fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
        cursor: "pointer", transition: "color 0.2s",
        marginTop: 4,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      {copied ? "Copied!" : "Copy list"}
    </button>
  );
}

// ─── Shared failed track list ─────────────────────────────────────────────────
function FailedTrackList({ tracks, isMobile, showReasons }: { tracks: TrackResult[]; isMobile: boolean; showReasons?: boolean }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {tracks.map((t, i) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: isMobile ? "14px 0" : "13px 4px",
          borderBottom: i < tracks.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
          <div style={{ width: 40, height: 40, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.08)" }}>
            {t.imageUrl && <img src={t.imageUrl} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{t.artist}</div>
          </div>
          {showReasons && t.failureReason ? (
            // TODO: Replace placeholder reasons with real API error responses when Spotify and YouTube Music OAuth is wired up
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic", flexShrink: 0, maxWidth: 120, textAlign: "right", lineHeight: 1.3 }}>{t.failureReason}</span>
          ) : (
            <XIcon />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── State: Transferring ──────────────────────────────────────────────────────
// Shows roughly 4-5 rows before scrolling, matching the approved mockup.
const TRANSFERRING_LIST_MAX_HEIGHT = 280;

function TransferringState({
  progress,
  total,
  isMobile,
  playlist,
  isRetry,
  onCancel,
}: {
  progress: TransferProgress | null;
  total: number;
  isMobile: boolean;
  playlist: PlaylistItem;
  isRetry?: boolean;
  onCancel: () => void;
}) {
  const trackTotal = Math.max(progress?.sourceTrackCount ?? total, 1);
  const liveTracks = progress?.trackResults ?? [];
  const done = liveTracks.length > 0
    ? liveTracks.filter(t => t.status !== "pending").length
    : (progress?.processedTrackCount ?? 0);

  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 16 : 24, fontWeight: 400, color: "rgba(255,255,255,0.9)", marginBottom: 16, letterSpacing: "0.1px" }}>
        {isRetry ? `Retrying ${total} failed tracks` : "Transferring playlist…"}
      </h2>
      <PlaylistCard playlist={playlist} retryCount={isRetry ? total : undefined} />
      <ProgressBar done={done} total={trackTotal} label={`${done} out of ${trackTotal} in progress`} />
      <div style={{ marginTop: 4, maxHeight: TRANSFERRING_LIST_MAX_HEIGHT, overflowY: "auto" }}>
        {liveTracks.map((t, i) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: isMobile ? "14px 4px" : "13px 4px",
            borderBottom: i < liveTracks.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
            <div style={{ width: 40, height: 40, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.08)" }}>
              {t.imageUrl && <img src={t.imageUrl} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{t.artist}</div>
            </div>
            {t.status === "success" ? <CheckIcon /> : t.status === "failed" ? <XIcon /> : (
              <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
        <button
          onClick={onCancel}
          style={{
            ...btnWhite,
            flex: "none",
            width: isMobile ? "100%" : "45%",
            minWidth: isMobile ? "auto" : 200,
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
        >Cancel transfer</button>
      </div>
    </>
  );
}

// ─── State: Success ───────────────────────────────────────────────────────────
function SuccessState({
  isMobile,
  playlist,
  total,
  targetPlaylistId,
  onStartAnother,
}: { isMobile: boolean; playlist: PlaylistItem; total: number; targetPlaylistId: string | null; onStartAnother: () => void }) {
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 16 : 24, fontWeight: 400, color: "rgba(255,255,255,0.9)", marginBottom: 16, letterSpacing: "0.1px" }}>
        Transferring playlist…
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? "32px 20px" : "48px 32px", textAlign: "center" }}>
        <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Playlist successfully transferred</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 24 }}>
          {playlist.name} by {playlist.owner}
        </div>
        <div style={{ marginBottom: 28 }}><PlatformRow /></div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, justifyContent: "center" }}>
          <button style={{ ...btnYellow, ...(isMobile ? {} : { maxWidth: 280 }) }} onClick={onStartAnother}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Start another transfer</button>
        </div>
      </div>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDurationMs(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatCompletedAt(completedAt: string | null): string | null {
  if (!completedAt) return null;
  try {
    const date = new Date(completedAt);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

// ─── State: Partial Match ─────────────────────────────────────────────────────
function PartialState({
  failedTracks,
  isMobile,
  sourceTrackCount,
  transferred,
  transferDurationMs,
  completedAt,
  targetPlaylistUrl,
  onRetry,
  onStartAnother,
}: {
  failedTracks: TrackResult[];
  isMobile: boolean;
  sourceTrackCount: number;
  transferred: number;
  transferDurationMs: number;
  completedAt: string | null;
  targetPlaylistUrl: string | null;
  onRetry: () => void;
  onStartAnother: () => void;
}) {
  const failed = failedTracks.length;
  const completionLabel = formatCompletedAt(completedAt);
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 16 : 24, fontWeight: 400, color: "rgba(255,255,255,0.9)", marginBottom: 16, letterSpacing: "0.1px" }}>
        Transfer result
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? "24px 16px" : "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{transferred} out of {sourceTrackCount} songs transferred</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>{failed} {failed === 1 ? "song" : "songs"} could not be found</div>
          <div style={{ marginBottom: 4 }}><PlatformRow /></div>
        </div>
        <div style={{ display: "grid", gap: 10, margin: "18px 0 20px", textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Source tracks</span><strong style={{ color: "#fff" }}>{sourceTrackCount}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Transferred</span><strong style={{ color: "#1ed760" }}>{transferred}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Failed</span><strong style={{ color: "#e85f47" }}>{failed}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Duration</span><strong style={{ color: "#fff" }}>{formatDurationMs(transferDurationMs)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Time</span><strong style={{ color: "#fff" }}>{completionLabel ?? "—"}</strong>
          </div>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <FailedTrackList tracks={failedTracks} isMobile={isMobile} showReasons />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
          <CopyFailedButton tracks={failedTracks} />
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
          <button style={btnWhite} onClick={onRetry}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >Retry failed songs ({failed})</button>
          <button style={btnYellow} onClick={onStartAnother}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Start another transfer</button>
        </div>
      </div>
    </>
  );
}

// ─── State: Post-retry failure (Component 20 — retry pass already used) ──────
function PostRetryFailureState({
  playlist,
  failedTracks,
  totalRetried,
  isMobile,
  onStartAnother,
}: {
  playlist: PlaylistItem;
  failedTracks: TrackResult[];
  totalRetried: number;
  isMobile: boolean;
  onStartAnother: () => void;
}) {
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 16 : 24, fontWeight: 400, color: "rgba(255,255,255,0.9)", marginBottom: 16, letterSpacing: "0.1px" }}>
        Transfer result
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? "24px 16px" : "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
            Oops! Retry failed
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16, lineHeight: 1.5, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
            These songs couldn&apos;t be transferred after multiple attempts. Advanced search is coming to Syncly soon.
            Copy the list of failed songs for later and continue transferring your other playlists.
          </div>
          <div style={{ marginBottom: 4 }}><PlatformRow /></div>
        </div>
        <div style={{ margin: "18px 0" }}>
          <PlaylistCard playlist={playlist} retryCount={totalRetried} />
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <FailedTrackList tracks={failedTracks} isMobile={isMobile} showReasons />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
          <CopyFailedButton tracks={failedTracks} />
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, justifyContent: "center" }}>
          <button style={{ ...btnYellow, ...(isMobile ? {} : { maxWidth: 280 }) }} onClick={onStartAnother}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Start another transfer</button>
        </div>
      </div>
    </>
  );
}

// ─── State: Error (total failure) ────────────────────────────────────────────
function ErrorState({
  isMobile,
  playlist,
  failedTracks,
  sourceTrackCount,
  transferredCount,
  transferDurationMs,
  completedAt,
  targetPlaylistUrl,
  onTryAgain,
  onStartAnother,
}: {
  isMobile: boolean;
  playlist: PlaylistItem;
  failedTracks: TrackResult[];
  sourceTrackCount: number;
  transferredCount: number;
  transferDurationMs: number;
  completedAt: string | null;
  targetPlaylistUrl: string | null;
  onTryAgain: () => void;
  onStartAnother: () => void;
}) {
  const completionLabel = formatCompletedAt(completedAt);
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 16 : 24, fontWeight: 400, color: "rgba(255,255,255,0.9)", marginBottom: 16, letterSpacing: "0.1px" }}>
        Transfer result
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? "24px 16px" : "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>We couldn&apos;t transfer any song</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>This is on us not you, please try again!</div>
          <PlatformRow />
        </div>
        <div style={{ marginBottom: 24 }}><PlaylistCard playlist={playlist} /></div>
        <div style={{ display: "grid", gap: 10, margin: "0 0 20px", textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Source tracks</span><strong style={{ color: "#fff" }}>{sourceTrackCount}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Transferred</span><strong style={{ color: "#1ed760" }}>{transferredCount}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Failed</span><strong style={{ color: "#e85f47" }}>{failedTracks.length}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Duration</span><strong style={{ color: "#fff" }}>{formatDurationMs(transferDurationMs)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            <span>Time</span><strong style={{ color: "#fff" }}>{completionLabel ?? "—"}</strong>
          </div>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <FailedTrackList tracks={failedTracks} isMobile={isMobile} showReasons />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
          <CopyFailedButton tracks={failedTracks} />
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
          <button style={btnWhite} onClick={onTryAgain}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >Try again</button>
          <button style={btnYellow} onClick={onStartAnother}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Start another transfer</button>
        </div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TransferPage() {
  const { notify } = useToast();
  const [fromPlatform,  setFromPlatform]  = useState<Platform | null>(null);
  const [toPlatform,    setToPlatform]    = useState<Platform | null>(null);
  const [fromConnected, setFromConnected] = useState(false);
  const [toConnected,   setToConnected]   = useState(false);
  const [playlists,     setPlaylists]     = useState<PlaylistItem[]>([]);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [isMobile,      setIsMobile]      = useState(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [spotifyAccountConnected, setSpotifyAccountConnected] = useState(false);
  const [youtubeAccountConnected, setYoutubeAccountConnected] = useState(false);
  const [spotifySessionExpired, setSpotifySessionExpired] = useState(false);
  const [youtubeSessionExpired, setYoutubeSessionExpired] = useState(false);
  const [hasLoadedSpotifyPlaylists, setHasLoadedSpotifyPlaylists] = useState(false);
  const [hasAttemptedSpotifyLoad, setHasAttemptedSpotifyLoad] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<"spotify" | "youtube" | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showCancelTransferConfirm, setShowCancelTransferConfirm] = useState(false);
  const [hostReady, setHostReady] = useState(true);
  const [isPreparingTransfer, setIsPreparingTransfer] = useState(false);
  const [playlistCountLoadingId, setPlaylistCountLoadingId] = useState<string | null>(null);
  const [playlistCountCooldownUntil, setPlaylistCountCooldownUntil] = useState(0);
  const [transferView, setTransferView] = useState<TransferViewState>("idle");
  const [failedTracks, setFailedTracks] = useState<TrackResult[]>([]);
  const [transferTotal, setTransferTotal] = useState(0);
  const [transferSucceeded, setTransferSucceeded] = useState(0);
  const [transferTargetPlaylistId, setTransferTargetPlaylistId] = useState<string | null>(null);
  const [transferTargetPlaylistUrl, setTransferTargetPlaylistUrl] = useState<string | null>(null);
  const [transferCompletedAt, setTransferCompletedAt] = useState<string | null>(null);
  const [transferDurationMs, setTransferDurationMs] = useState<number>(0);
  const [transferOverallStatus, setTransferOverallStatus] = useState<"success" | "partial" | "failure" | null>(null);
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [activeTransferPlaylist, setActiveTransferPlaylist] = useState<PlaylistItem | null>(null);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const playlistsLoadInFlightRef = useRef(false);
  const playlistCountInFlightRef = useRef(false);
  const lastPlaylistCountFetchAtRef = useRef(0);
  const playlistListAreaRef = useRef<HTMLDivElement | null>(null);
  const platformSelectorAreaRef = useRef<HTMLDivElement | null>(null);
  const transferButtonAreaRef = useRef<HTMLDivElement | null>(null);
  const transferProgressPollRef = useRef<number | null>(null);
  const transferAbortControllerRef = useRef<AbortController | null>(null);
  const transferCancelledRef = useRef(false);
  const transferIsRetryAttemptRef = useRef(false);
  const transferResultAppliedRef = useRef(false);
  const transferNotificationShownRef = useRef(false);

  useEffect(() => {
    // Keep this as a no-op hydration guard for future use.
    // We intentionally avoid forced localhost/127 redirects because they can trap
    // users in a redirecting state when browser/session policies change.
    if (typeof window === "undefined") return;
    setHostReady(true);
  }, []);

  useEffect(() => {
    if (!hostReady) return;

    const mq = window.matchMedia("(max-width: 600px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler as EventListener);
      return () => mq.removeEventListener("change", handler as EventListener);
    }

    const legacyHandler = (event: MediaQueryListEvent) => handler(event);
    mq.addListener(legacyHandler);
    return () => mq.removeListener(legacyHandler);
  }, [hostReady]);

  useEffect(() => {
    if (!selectedId) return;

    function handleOutsidePointerDown(event: MouseEvent | TouchEvent) {
      const container = playlistListAreaRef.current;
      if (!container) return;
      const platformSelectorArea = platformSelectorAreaRef.current;
      const transferButtonArea = transferButtonAreaRef.current;
      const target = event.target as Node | null;
      if (!target) return;
      if (platformSelectorArea?.contains(target)) return;
      if (transferButtonArea?.contains(target)) return;
      if (!container.contains(target)) {
        setSelectedId(null);
      }
    }

    document.addEventListener("mousedown", handleOutsidePointerDown);
    document.addEventListener("touchstart", handleOutsidePointerDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointerDown);
      document.removeEventListener("touchstart", handleOutsidePointerDown);
    };
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (transferProgressPollRef.current !== null) {
        window.clearInterval(transferProgressPollRef.current);
      }
    };
  }, []);

  const isDirectionSupported = fromPlatform === "spotify" && toPlatform === "youtube";
  const fromSessionReady =
    fromPlatform === "spotify" ? !spotifySessionExpired : fromPlatform === "youtube" ? !youtubeSessionExpired : false;
  const toSessionReady =
    toPlatform === "spotify" ? !spotifySessionExpired : toPlatform === "youtube" ? !youtubeSessionExpired : false;
  const fromConnectedEffective = fromConnected && fromSessionReady;
  const toConnectedEffective = toConnected && toSessionReady;
  const canTransfer = fromConnectedEffective && toConnectedEffective && selectedId !== null && isDirectionSupported;
  const transferDisabledReason = !fromPlatform || !toPlatform
    ? "Select source and destination platforms."
    : !fromConnectedEffective || !toConnectedEffective
      ? "Connect both platforms."
      : !isDirectionSupported
        ? "Only Spotify -> YouTube Music is supported right now."
        : !selectedId
          ? "Select a source playlist to enable transfer."
          : null;

  const refreshAuthStatus = useCallback(async () => {
    const statusResponse = await fetch("/api/auth?action=status", { cache: "no-store" });
    if (!statusResponse.ok) return null;

    const status = await statusResponse.json().catch(() => null);
    const spotifyConnected = Boolean(status?.spotifyConnected);
    const youtubeConnected = Boolean(status?.youtubeConnected);

    setSpotifyAccountConnected(spotifyConnected);
    setYoutubeAccountConnected(youtubeConnected);
    setSpotifySessionExpired(!spotifyConnected);
    setYoutubeSessionExpired(!youtubeConnected);

    if (fromPlatform === "spotify") setFromConnected(spotifyConnected);
    if (fromPlatform === "youtube") setFromConnected(youtubeConnected);
    if (toPlatform === "spotify") setToConnected(spotifyConnected);
    if (toPlatform === "youtube") setToConnected(youtubeConnected);

    return {
      spotifyConnected,
      youtubeConnected,
    };
  }, [fromPlatform, toPlatform]);

  function getCountCacheKey(platform: "spotify" | "youtube") {
    return platform === "spotify"
      ? SPOTIFY_PLAYLIST_COUNT_CACHE_KEY
      : YOUTUBE_PLAYLIST_COUNT_CACHE_KEY;
  }

  function readPlaylistCountCache(platform: "spotify" | "youtube"): Record<string, number> {
    if (typeof window === "undefined") return {};

    try {
      const raw = window.localStorage.getItem(getCountCacheKey(platform));
      if (!raw) return {};
      const parsed = JSON.parse(raw) as { timestamp?: number; counts?: Record<string, unknown> };
      if (!parsed || typeof parsed.timestamp !== "number" || !parsed.counts) return {};

      if (Date.now() - parsed.timestamp > PLAYLIST_COUNT_CACHE_TTL_MS) {
        window.localStorage.removeItem(getCountCacheKey(platform));
        return {};
      }

      const normalized: Record<string, number> = {};
      for (const [playlistId, value] of Object.entries(parsed.counts)) {
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
          normalized[playlistId] = Math.trunc(value);
        }
      }
      return normalized;
    } catch {
      return {};
    }
  }

  function writePlaylistCountCache(
    platform: "spotify" | "youtube",
    playlistId: string,
    count: number
  ) {
    if (typeof window === "undefined") return;
    if (!Number.isFinite(count) || count < 0) return;

    try {
      const cacheKey = getCountCacheKey(platform);
      const existingRaw = window.localStorage.getItem(cacheKey);
      const existing = existingRaw
        ? (JSON.parse(existingRaw) as { timestamp?: number; counts?: Record<string, number> })
        : { timestamp: Date.now(), counts: {} };
      const mergedCounts: Record<string, number> = { ...(existing.counts ?? {}) };
      mergedCounts[playlistId] = Math.trunc(count);
      const payload = {
        timestamp: Date.now(),
        counts: mergedCounts,
      };
      window.localStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch {
      // Ignore storage failures for MVP stability.
    }
  }

  const loadSourcePlaylists = useCallback(async (sourcePlatform: "spotify" | "youtube") => {
    if (playlistsLoadInFlightRef.current) return;
    playlistsLoadInFlightRef.current = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);
    setIsLoadingPlaylists(true);
    setHasAttemptedSpotifyLoad(true);
    try {
      const status = await refreshAuthStatus().catch(() => null);
      const sourceConnected = sourcePlatform === "spotify" ? status?.spotifyConnected : status?.youtubeConnected;
      if (status && !sourceConnected) {
        setPlaylists([]);
        setSelectedId(null);
        setPlaylistCountLoadingId(null);
        setPlaylistCountCooldownUntil(0);
        playlistCountInFlightRef.current = false;
        setHasLoadedSpotifyPlaylists(false);
        throw new Error(`${sourcePlatform === "spotify" ? "Spotify" : "YouTube Music"} is not connected.`);
      }

      const cachedCountById: Record<string, number> = readPlaylistCountCache(sourcePlatform);

      const response = await fetch(`/api/${sourcePlatform}?resource=playlists`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 401) {
          if (sourcePlatform === "spotify") {
            setSpotifySessionExpired(true);
          } else {
            setYoutubeSessionExpired(true);
          }
          // Source session is expired; clear stale source playlists so UI matches reality.
          setPlaylists([]);
          setSelectedId(null);
          setPlaylistCountLoadingId(null);
          setPlaylistCountCooldownUntil(0);
          playlistCountInFlightRef.current = false;
          setHasLoadedSpotifyPlaylists(false);
        }
        const platformLabel = sourcePlatform === "spotify" ? "Spotify" : "YouTube";
        const message = payload?.error ?? `Unable to fetch ${platformLabel} playlists right now.`;
        throw new Error(message);
      }

      const payload = await response.json();
      const nextPlaylists: PlaylistItem[] = Array.isArray(payload.playlists)
        ? payload.playlists.map((playlist: any) => {
            const id = String(playlist?.id ?? "");
            const rawTrackCount =
              playlist?.trackCount ??
              playlist?.tracks?.total ??
              playlist?.tracksTotal ??
              playlist?.track_count;
            const parsedTrackCount = Number(rawTrackCount);
            const safeTrackCount = Number.isFinite(parsedTrackCount) && parsedTrackCount >= 0
              ? Math.trunc(parsedTrackCount)
              : (typeof cachedCountById[id] === "number" ? cachedCountById[id] : null);

            return {
              id,
              name: String(playlist?.name ?? "Untitled playlist"),
              owner: String(playlist?.owner ?? "Spotify User"),
              trackCount: safeTrackCount,
              imageUrl: playlist?.imageUrl ? String(playlist.imageUrl) : undefined,
            };
          })
        : [];
      setPlaylists((previous) => {
        const previousById = new Map(previous.map((playlist) => [playlist.id, playlist]));
        return nextPlaylists.map((playlist) => {
          const existing = previousById.get(playlist.id);
          if (!existing) return playlist;

          return {
            ...playlist,
            // Preserve a known good count in-session if a later response omits totals.
            trackCount: playlist.trackCount ?? existing.trackCount,
          };
        });
      });
      setHasLoadedSpotifyPlaylists(true);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        const platformLabel = sourcePlatform === "spotify" ? "Spotify" : "YouTube";
        throw new Error(`${platformLabel} request timed out. Please click connect again.`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      setIsLoadingPlaylists(false);
      playlistsLoadInFlightRef.current = false;
    }
  }, [refreshAuthStatus]);

  useEffect(() => {
    if (!hostReady) return;

    let mounted = true;

    async function hydrateConnectionState() {
      const params = new URLSearchParams(window.location.search);
      const authResult = params.get("auth");
      const reason = params.get("reason");
      const connectSide = params.get("connectSide");
      const fromParam = params.get("from");
      const sourcePlaylistIdParam = params.get("sourcePlaylistId");
      let shouldLoadSourcePlaylists = false;
      let sourceToLoad: "spotify" | "youtube" | null = null;
      const sourceActionOnly = connectSide === "from";

      if (fromParam === "spotify" || fromParam === "youtube") {
        setFromPlatform(fromParam);
      }
      if (sourcePlaylistIdParam) {
        setSelectedId(sourcePlaylistIdParam);
      }

      // When returning from destination OAuth, restore cached playlists instantly
      // so the list never flickers or reloads — the source hasn't changed.
      if (connectSide === "to") {
        try {
          const raw = window.sessionStorage.getItem(PLAYLISTS_SESSION_CACHE_KEY);
          if (raw) {
            const cached = JSON.parse(raw) as {
              platform: string;
              playlists: PlaylistItem[];
              selectedId: string | null;
            };
            const expectedPlatform = fromParam ?? fromPlatform;
            if (cached.platform === expectedPlatform && Array.isArray(cached.playlists) && cached.playlists.length > 0) {
              setPlaylists(cached.playlists);
              setHasLoadedSpotifyPlaylists(true);
              if (cached.selectedId) setSelectedId(cached.selectedId);
            }
            window.sessionStorage.removeItem(PLAYLISTS_SESSION_CACHE_KEY);
          }
        } catch {
          // ignore — sessionStorage may be unavailable
        }
      }

      if (authResult === "spotify_success") {
        setSpotifyAccountConnected(true);
        setSpotifySessionExpired(false);
        if (connectSide === "to") {
          setToPlatform("spotify");
          setToConnected(true);
        } else {
          setFromPlatform("spotify");
          setFromConnected(true);
          setHasAttemptedSpotifyLoad(false);
          shouldLoadSourcePlaylists = true;
          sourceToLoad = "spotify";
        }
      }

      if (authResult === "youtube_success") {
        setYoutubeAccountConnected(true);
        setYoutubeSessionExpired(false);
        if (connectSide === "from") {
          setFromPlatform("youtube");
          setFromConnected(true);
          setHasAttemptedSpotifyLoad(false);
          shouldLoadSourcePlaylists = true;
          sourceToLoad = "youtube";
        } else {
          setToPlatform("youtube");
          setToConnected(true);
        }
      }

      if (authResult?.endsWith("_error")) {
        const fallback = "Authentication failed. Please try again.";
        const message = reason ? `Authentication failed: ${reason.split("_").join(" ")}` : fallback;
        notify({
          tone: "error",
          title: "Authentication failed",
          description: message,
        });
      }

      if (authResult || reason || connectSide || fromParam || sourcePlaylistIdParam) {
        params.delete("auth");
        params.delete("reason");
        params.delete("connectSide");
        params.delete("from");
        params.delete("sourcePlaylistId");
        const newQuery = params.toString();
        const nextUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ""}`;
        window.history.replaceState({}, "", nextUrl);
      }

      try {
        const status = await refreshAuthStatus();
        if (!status || !mounted) return;
        const { spotifyConnected, youtubeConnected } = status;

        const fromIsConnected =
          (fromPlatform === "spotify" && spotifyConnected) ||
          (fromPlatform === "youtube" && youtubeConnected);
        const toIsConnected =
          (toPlatform === "spotify" && spotifyConnected) ||
          (toPlatform === "youtube" && youtubeConnected);

        if (fromIsConnected) {
          setFromConnected(true);
        }
        if (toIsConnected) {
          setToConnected(true);
        }

        if (!fromPlatform) {
          // Product direction is Spotify -> YouTube first.
          // Never auto-default source to YouTube; either default to Spotify or stay unset.
          if (spotifyConnected && toPlatform !== "spotify") {
            setFromPlatform("spotify");
            setFromConnected(true);
            if (sourceActionOnly || !connectSide) {
              shouldLoadSourcePlaylists = true;
              sourceToLoad = "spotify";
            }
          }
        } else if (!fromIsConnected) {
          // Source session is no longer valid: clear stale source data immediately.
          setPlaylists([]);
          setSelectedId(null);
          setPlaylistCountLoadingId(null);
          setPlaylistCountCooldownUntil(0);
          playlistCountInFlightRef.current = false;
          setHasLoadedSpotifyPlaylists(false);
        } else if (
          (fromPlatform === "spotify" || fromPlatform === "youtube") &&
          !hasLoadedSpotifyPlaylists &&
          !spotifySessionExpired &&
          !youtubeSessionExpired
        ) {
          // Avoid source playlist re-fetch loops after destination reconnect when source is already loaded.
          if (sourceActionOnly || !connectSide) {
            shouldLoadSourcePlaylists = true;
            sourceToLoad = fromPlatform;
          }
        }
      } catch {
        // Ignore auth status fetch errors for MVP UX continuity.
      }

      if (!mounted || !shouldLoadSourcePlaylists || !sourceToLoad) return;

      try {
        await loadSourcePlaylists(sourceToLoad);
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Unable to fetch playlists.";
        notify({
          tone: "error",
          title: "Could not load playlists",
          description: message,
        });
      }
    }

    hydrateConnectionState();
    return () => {
      mounted = false;
    };
  }, [
    fromPlatform,
    hasLoadedSpotifyPlaylists,
    hostReady,
    loadSourcePlaylists,
    notify,
    refreshAuthStatus,
    spotifySessionExpired,
    toPlatform,
    youtubeSessionExpired,
  ]);

  useEffect(() => {
    if (!hostReady) return;

    const fromIsConnected =
      (fromPlatform === "spotify" && spotifyAccountConnected) ||
      (fromPlatform === "youtube" && youtubeAccountConnected);
    const toIsConnected =
      (toPlatform === "spotify" && spotifyAccountConnected) ||
      (toPlatform === "youtube" && youtubeAccountConnected);

    setFromConnected(fromIsConnected);
    setToConnected(toIsConnected);
  }, [fromPlatform, hostReady, spotifyAccountConnected, toPlatform, youtubeAccountConnected]);

  useEffect(() => {
    if (!hostReady) return;
    if (!fromConnectedEffective) return;
    if (fromPlatform !== "spotify" && fromPlatform !== "youtube") return;
    if (hasLoadedSpotifyPlaylists) return;

    void loadSourcePlaylists(fromPlatform).catch((error) => {
      const message = error instanceof Error ? error.message : "Unable to fetch playlists.";
      notify({
        tone: "error",
        title: "Could not load playlists",
        description: message,
      });
    });
  }, [fromConnectedEffective, fromPlatform, hasLoadedSpotifyPlaylists, hostReady, loadSourcePlaylists, notify]);

  async function handleFromConnect() {
    if (!hostReady) return;
    if (!fromPlatform) return;

    if (fromPlatform !== "spotify" && fromPlatform !== "youtube") {
      notify({
        tone: "info",
        title: "Source not supported yet",
        description: "MVP currently supports Spotify or YouTube Music as source.",
      });
      return;
    }

    const status = await refreshAuthStatus().catch(() => null);
    const realSpotifyConnected = status?.spotifyConnected ?? spotifyAccountConnected;
    const realYoutubeConnected = status?.youtubeConnected ?? youtubeAccountConnected;
    const alreadyAuthorized =
      (fromPlatform === "spotify" && realSpotifyConnected) ||
      (fromPlatform === "youtube" && realYoutubeConnected);
    if (alreadyAuthorized) {
      if (fromPlatform === "spotify") setSpotifySessionExpired(false);
      if (fromPlatform === "youtube") setYoutubeSessionExpired(false);
      setFromConnected(true);
      setHasAttemptedSpotifyLoad(false);
      try {
        await loadSourcePlaylists(fromPlatform);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to fetch playlists.";
        notify({
          tone: "error",
          title: "Could not load playlists",
          description: message,
        });
      }
      return;
    }

    setHasAttemptedSpotifyLoad(false);

    const authUrl = new URL("/api/auth", window.location.origin);
    authUrl.searchParams.set("action", "connect");
    authUrl.searchParams.set("platform", fromPlatform);
    authUrl.searchParams.set("returnTo", "/transfer?connectSide=from");
    if (typeof window !== "undefined" && fromPlatform === "spotify") {
      const shouldForceFreshAuth = window.localStorage.getItem(SPOTIFY_FORCE_FRESH_AUTH_KEY) === "1";
      if (shouldForceFreshAuth) {
        authUrl.searchParams.set("forceDialog", "1");
        window.localStorage.removeItem(SPOTIFY_FORCE_FRESH_AUTH_KEY);
      }
    }
    window.location.href = authUrl.toString();
  }

  async function handleToConnect() {
    if (!hostReady) return;
    if (!toPlatform) return;

    if (toPlatform !== "spotify" && toPlatform !== "youtube") {
      notify({
        tone: "info",
        title: "Destination not supported yet",
        description: "MVP currently supports Spotify or YouTube Music as destination.",
      });
      return;
    }

    const status = await refreshAuthStatus().catch(() => null);
    const realSpotifyConnected = status?.spotifyConnected ?? spotifyAccountConnected;
    const realYoutubeConnected = status?.youtubeConnected ?? youtubeAccountConnected;
    const alreadyAuthorized =
      (toPlatform === "spotify" && realSpotifyConnected) ||
      (toPlatform === "youtube" && realYoutubeConnected);
    if (alreadyAuthorized) {
      if (toPlatform === "spotify") setSpotifySessionExpired(false);
      if (toPlatform === "youtube") setYoutubeSessionExpired(false);
      setToConnected(true);
      notify({
        tone: "success",
        title: `${toPlatform === "spotify" ? "Spotify" : "YouTube Music"} reconnected`,
        description: "No fresh authorization needed.",
      });
      return;
    }

    const authUrl = new URL("/api/auth", window.location.origin);
    authUrl.searchParams.set("action", "connect");
    authUrl.searchParams.set("platform", toPlatform);
    const returnParams = new URLSearchParams({ connectSide: "to" });
    if (fromPlatform === "spotify" || fromPlatform === "youtube") {
      returnParams.set("from", fromPlatform);
    }
    if (selectedId) {
      returnParams.set("sourcePlaylistId", selectedId);
    }
    authUrl.searchParams.set("returnTo", `/transfer?${returnParams.toString()}`);
    if (typeof window !== "undefined" && toPlatform === "spotify") {
      const shouldForceFreshAuth = window.localStorage.getItem(SPOTIFY_FORCE_FRESH_AUTH_KEY) === "1";
      if (shouldForceFreshAuth) {
        authUrl.searchParams.set("forceDialog", "1");
        window.localStorage.removeItem(SPOTIFY_FORCE_FRESH_AUTH_KEY);
      }
    }

    // Save playlists before navigating so they can be restored instantly on return,
    // avoiding a visible reload/flash when the user comes back after connecting destination.
    if (playlists.length > 0 && fromPlatform && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          PLAYLISTS_SESSION_CACHE_KEY,
          JSON.stringify({ platform: fromPlatform, playlists, selectedId })
        );
      } catch {
        // ignore — sessionStorage may be unavailable
      }
    }

    window.location.href = authUrl.toString();
  }

  function handleFromSelect(p: Platform) {
    resetTransferSession();
    if (toPlatform && p === toPlatform) {
      notify({
        tone: "info",
        title: "Choose a different source",
        description: "Source and destination platforms must be different.",
      });
      return;
    }

    setFromPlatform(p);
    const connected = p === "spotify" ? spotifyAccountConnected : p === "youtube" ? youtubeAccountConnected : false;
    setFromConnected(connected);
    setPlaylists([]);
    setSelectedId(null);
    setPlaylistCountLoadingId(null);
    setPlaylistCountCooldownUntil(0);
    playlistCountInFlightRef.current = false;
    setHasLoadedSpotifyPlaylists(false);
    setHasAttemptedSpotifyLoad(false);
  }
  function handleToSelect(p: Platform) {
    resetTransferSession();
    if (fromPlatform && p === fromPlatform) {
      notify({
        tone: "info",
        title: "Choose a different destination",
        description: "Source and destination platforms must be different.",
      });
      return;
    }

    setToPlatform(p);
    const connected = p === "spotify" ? spotifyAccountConnected : p === "youtube" ? youtubeAccountConnected : false;
    setToConnected(connected);
  }

  async function fetchPlaylistCountByIntent(playlistId: string) {
    if (!hostReady) return;
    if (!fromConnectedEffective) return;
    if (fromPlatform !== "spotify" && fromPlatform !== "youtube") return;
    if (!playlistId) return;
    if (playlistCountInFlightRef.current) return;

    const current = playlists.find((playlist) => playlist.id === playlistId);
    if (!current || current.trackCount !== null) return;

    if (Date.now() < playlistCountCooldownUntil) return;

    playlistCountInFlightRef.current = true;
    setPlaylistCountLoadingId(playlistId);

    try {
      const sinceLastFetch = Date.now() - lastPlaylistCountFetchAtRef.current;
      if (sinceLastFetch < PLAYLIST_COUNT_MIN_GAP_MS) {
        await new Promise((resolve) => setTimeout(resolve, PLAYLIST_COUNT_MIN_GAP_MS - sinceLastFetch));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(
        `/api/${fromPlatform}?resource=trackCount&playlistId=${encodeURIComponent(playlistId)}`,
        { cache: "no-store", signal: controller.signal }
      );
      clearTimeout(timeoutId);
      lastPlaylistCountFetchAtRef.current = Date.now();

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = String(payload?.error ?? "").toLowerCase();
        if (response.status === 429 || message.includes("rate limit") || message.includes("too many")) {
          const nextCooldownUntil = Date.now() + PLAYLIST_COUNT_COOLDOWN_MS;
          setPlaylistCountCooldownUntil(nextCooldownUntil);
          notify({
            tone: "info",
            title: "Playlist counts paused",
            description: "To protect stability, count checks are paused briefly.",
          });
        }
        return;
      }

      const payload = await response.json();
      const parsedTotal = Number(payload?.total);
      if (!Number.isFinite(parsedTotal) || parsedTotal < 0) return;

      const safeCount = Math.trunc(parsedTotal);
      setPlaylists((prev) =>
        prev.map((playlist) =>
          playlist.id === playlistId ? { ...playlist, trackCount: safeCount } : playlist
        )
      );
      writePlaylistCountCache(fromPlatform, playlistId, safeCount);
    } catch {
      // Intent fetch is best-effort only.
    } finally {
      playlistCountInFlightRef.current = false;
      setPlaylistCountLoadingId((currentLoadingId) =>
        currentLoadingId === playlistId ? null : currentLoadingId
      );
    }
  }

  function handlePlaylistSelect(playlistId: string) {
    setSelectedId(playlistId);
    void fetchPlaylistCountByIntent(playlistId);
  }

  function resetTransferSession() {
    if (transferProgressPollRef.current !== null) {
      window.clearInterval(transferProgressPollRef.current);
      transferProgressPollRef.current = null;
    }
    setTransferView("idle");
    setFailedTracks([]);
    setTransferTotal(0);
    setTransferSucceeded(0);
    setTransferTargetPlaylistId(null);
    setTransferTargetPlaylistUrl(null);
    setTransferCompletedAt(null);
    setTransferDurationMs(0);
    setTransferOverallStatus(null);
    setTransferProgress(null);
    setActiveTransferId(null);
    setActiveTransferPlaylist(null);
    transferResultAppliedRef.current = false;
    transferNotificationShownRef.current = false;
    transferIsRetryAttemptRef.current = false;
    setShowCancelTransferConfirm(false);
  }

  function handleRequestCancelTransfer() {
    if (transferView !== "transferring") return;
    setShowCancelTransferConfirm(true);
  }

  function handleConfirmCancelTransfer() {
    setShowCancelTransferConfirm(false);
    transferCancelledRef.current = true;

    // Tell the backend to stop processing further tracks. Best effort — fire
    // and forget so the UI resets immediately regardless of network latency.
    const transferIdToCancel = activeTransferId;
    if (transferIdToCancel) {
      void fetch("/api/transfer/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId: transferIdToCancel }),
        cache: "no-store",
        keepalive: true,
      }).catch(() => {
        // best effort only — the abort below still stops the client side.
      });
    }

    if (transferAbortControllerRef.current) {
      transferAbortControllerRef.current.abort();
      transferAbortControllerRef.current = null;
    }
    if (transferProgressPollRef.current !== null) {
      window.clearInterval(transferProgressPollRef.current);
      transferProgressPollRef.current = null;
    }
    notify({
      tone: "info",
      title: "Transfer cancelled",
      description: "We've stopped this transfer. Songs already added to the destination playlist will remain there.",
    });
    resetTransferSession();
  }

  function handleRetry() {
    if (isPreparingTransfer) return;

    if (!isDirectionSupported) {
      notify({
        tone: "info",
        title: "Direction not supported",
        description: "Only Spotify to YouTube Music transfers are supported right now.",
      });
      return;
    }

    if (!fromConnectedEffective || !toConnectedEffective) {
      notify({
        tone: "error",
        title: "Reconnect required",
        description: "Please reconnect the disconnected platform, then try again.",
      });
      return;
    }

    const retryPlaylistId = selectedId ?? activeTransferPlaylist?.id ?? null;
    if (!retryPlaylistId) {
      notify({
        tone: "info",
        title: "Select a playlist",
        description: "Choose a source playlist to retry this transfer.",
      });
      setTransferView("idle");
      return;
    }

    const retryTrackIds = failedTracks.map((track) => track.id).filter(Boolean);
    if (retryTrackIds.length === 0) {
      notify({
        tone: "info",
        title: "Nothing to retry",
        description: "We did not capture any failed tracks from the last transfer.",
      });
      return;
    }

    if (!selectedId) {
      setSelectedId(retryPlaylistId);
    }

    void runTransfer(retryPlaylistId, {
      retryTrackIds,
      targetPlaylistId: transferTargetPlaylistId,
      matchMode: "relaxed",
    });
  }

  function handleFromDisconnect() {
    if (!fromConnected || (fromPlatform !== "spotify" && fromPlatform !== "youtube")) return;
    setDisconnectTarget(fromPlatform);
  }

  function handleToDisconnect() {
    if (!toConnected || (toPlatform !== "spotify" && toPlatform !== "youtube")) return;
    setDisconnectTarget(toPlatform);
  }

  function applyTransferPayload(payload: any, options?: { notify?: boolean }): boolean {
    if (!payload || transferResultAppliedRef.current) return false;

    const failuresFromApi: TrackResult[] = Array.isArray(payload?.failedTracks ?? payload?.failures)
      ? (payload.failedTracks ?? payload.failures)
          .map((failure: any) => ({
            id: String(failure?.sourceTrack?.id ?? ""),
            name: String(failure?.sourceTrack?.name ?? ""),
            artist: String(failure?.sourceTrack?.artist ?? ""),
            imageUrl: failure?.sourceTrack?.imageUrl ? String(failure.sourceTrack.imageUrl) : undefined,
            status: "failed" as const,
            failureReason: String(failure?.reason ?? "Track could not be transferred."),
            failureDetails: failure ? {
              searchQuery: String(failure?.searchQuery ?? ""),
              searchQueries: Array.isArray(failure?.searchQueries) ? failure.searchQueries.map((q: any) => String(q)) : [],
              threshold: Number.isFinite(Number(failure?.threshold)) ? Number(failure.threshold) : 0,
              diagnostics: {
                searchQueries: Array.isArray(failure?.diagnostics?.searchQueries)
                  ? failure.diagnostics.searchQueries.map((q: any) => String(q))
                  : [],
                threshold: Number.isFinite(Number(failure?.diagnostics?.threshold))
                  ? Number(failure.diagnostics.threshold)
                  : 0,
                attempts: Array.isArray(failure?.diagnostics?.attempts)
                  ? failure.diagnostics.attempts.map((attempt: any) => ({
                      searchQuery: String(attempt?.searchQuery ?? ""),
                      topCandidates: Array.isArray(attempt?.topCandidates)
                        ? attempt.topCandidates.map((candidate: any) => ({
                            id: String(candidate?.id ?? ""),
                            name: String(candidate?.name ?? ""),
                            artist: String(candidate?.artist ?? ""),
                            album: String(candidate?.album ?? ""),
                            durationMs: Number.isFinite(Number(candidate?.durationMs)) ? Math.trunc(Number(candidate.durationMs)) : 0,
                            durationDeltaMs: candidate?.durationDeltaMs === null || candidate?.durationDeltaMs === undefined
                              ? null
                              : Number.isFinite(Number(candidate?.durationDeltaMs))
                                ? Math.trunc(Number(candidate.durationDeltaMs))
                                : null,
                            durationStatus: candidate?.durationStatus === "matched" || candidate?.durationStatus === "mismatch" || candidate?.durationStatus === "unavailable"
                              ? candidate.durationStatus
                              : "unavailable",
                            titleScore: Number(candidate?.titleScore ?? 0),
                            artistScore: Number(candidate?.artistScore ?? 0),
                            combinedScore: Number(candidate?.combinedScore ?? 0),
                            rejectionReason: candidate?.rejectionReason === null || candidate?.rejectionReason === undefined
                              ? null
                              : String(candidate.rejectionReason),
                          }))
                        : [],
                      rejectionReason: String(attempt?.rejectionReason ?? ""),
                      matchFound: Boolean(attempt?.matchFound),
                    }))
                  : [],
                topCandidates: Array.isArray(failure?.diagnostics?.topCandidates)
                  ? failure.diagnostics.topCandidates.map((candidate: any) => ({
                      id: String(candidate?.id ?? ""),
                      name: String(candidate?.name ?? ""),
                      artist: String(candidate?.artist ?? ""),
                      album: String(candidate?.album ?? ""),
                      durationMs: Number.isFinite(Number(candidate?.durationMs)) ? Math.trunc(Number(candidate.durationMs)) : 0,
                      durationDeltaMs: candidate?.durationDeltaMs === null || candidate?.durationDeltaMs === undefined
                        ? null
                        : Number.isFinite(Number(candidate?.durationDeltaMs))
                          ? Math.trunc(Number(candidate.durationDeltaMs))
                          : null,
                      durationStatus: candidate?.durationStatus === "matched" || candidate?.durationStatus === "mismatch" || candidate?.durationStatus === "unavailable"
                        ? candidate.durationStatus
                        : "unavailable",
                      titleScore: Number(candidate?.titleScore ?? 0),
                      artistScore: Number(candidate?.artistScore ?? 0),
                      combinedScore: Number(candidate?.combinedScore ?? 0),
                      rejectionReason: candidate?.rejectionReason === null || candidate?.rejectionReason === undefined
                        ? null
                        : String(candidate.rejectionReason),
                    }))
                  : [],
                selectedCandidate: failure?.diagnostics?.selectedCandidate
                  ? {
                      id: String(failure.diagnostics.selectedCandidate.id ?? ""),
                      name: String(failure.diagnostics.selectedCandidate.name ?? ""),
                      artist: String(failure.diagnostics.selectedCandidate.artist ?? ""),
                      album: String(failure.diagnostics.selectedCandidate.album ?? ""),
                      durationMs: Number.isFinite(Number(failure.diagnostics.selectedCandidate.durationMs))
                        ? Math.trunc(Number(failure.diagnostics.selectedCandidate.durationMs))
                        : 0,
                      durationDeltaMs:
                        failure.diagnostics.selectedCandidate.durationDeltaMs === null ||
                        failure.diagnostics.selectedCandidate.durationDeltaMs === undefined
                          ? null
                          : Number.isFinite(Number(failure.diagnostics.selectedCandidate.durationDeltaMs))
                            ? Math.trunc(Number(failure.diagnostics.selectedCandidate.durationDeltaMs))
                            : null,
                      durationStatus:
                        failure.diagnostics.selectedCandidate.durationStatus === "matched" ||
                        failure.diagnostics.selectedCandidate.durationStatus === "mismatch" ||
                        failure.diagnostics.selectedCandidate.durationStatus === "unavailable"
                          ? failure.diagnostics.selectedCandidate.durationStatus
                          : "unavailable",
                      titleScore: Number(failure.diagnostics.selectedCandidate.titleScore ?? 0),
                      artistScore: Number(failure.diagnostics.selectedCandidate.artistScore ?? 0),
                      combinedScore: Number(failure.diagnostics.selectedCandidate.combinedScore ?? 0),
                      rejectionReason:
                        failure.diagnostics.selectedCandidate.rejectionReason === null ||
                        failure.diagnostics.selectedCandidate.rejectionReason === undefined
                          ? null
                          : String(failure.diagnostics.selectedCandidate.rejectionReason),
                    }
                  : null,
                rejectionReason: String(failure?.diagnostics?.rejectionReason ?? ""),
              },
              retryEligible: Boolean(failure?.retryEligible),
            } : undefined,
          }))
          .filter((track: TrackResult) => Boolean(track.id && track.name))
      : [];

    const processedTrackCount = Number.isFinite(Number(payload?.processedTrackCount))
      ? Math.max(0, Math.trunc(Number(payload.processedTrackCount)))
      : 0;
    const transferredCount = Number.isFinite(Number(payload?.transferredCount))
      ? Math.max(0, Math.trunc(Number(payload.transferredCount)))
      : 0;
    const failedCount = Number.isFinite(Number(payload?.failedCount))
      ? Math.max(0, Math.trunc(Number(payload.failedCount)))
      : failuresFromApi.length;
    const total = Number.isFinite(Number(payload?.sourceTrackCount))
      ? Math.max(0, Math.trunc(Number(payload.sourceTrackCount)))
      : processedTrackCount || transferredCount + failedCount;
    const targetPlaylistId = payload?.targetPlaylistId ? String(payload.targetPlaylistId) : null;
    const targetPlaylistUrl = payload?.targetPlaylistUrl
      ? String(payload.targetPlaylistUrl)
      : targetPlaylistId
        ? `https://music.youtube.com/playlist?list=${targetPlaylistId}`
        : null;
    const transferDuration = Number.isFinite(Number(payload?.transferDurationMs))
      ? Math.max(0, Math.trunc(Number(payload.transferDurationMs)))
      : 0;
    const completedAt = payload?.completedAt ? String(payload.completedAt) : null;
    const overallStatus = payload?.overallStatus === "success" || payload?.overallStatus === "partial" || payload?.overallStatus === "failure"
      ? payload.overallStatus
      : (transferredCount === 0 ? "failure" : failedCount > 0 ? "partial" : "success");

    setFailedTracks(failuresFromApi);
    setTransferTotal(total);
    setTransferSucceeded(transferredCount);
    setTransferTargetPlaylistId(targetPlaylistId);
    setTransferTargetPlaylistUrl(targetPlaylistUrl);
    setTransferDurationMs(transferDuration);
    setTransferCompletedAt(completedAt);
    setTransferOverallStatus(overallStatus);
    setTransferProgress((current) =>
      current
        ? {
            ...current,
            status: "done",
            sourceTrackCount: total,
            processedTrackCount,
            transferredCount,
            failedCount,
            targetPlaylistId,
            targetPlaylistUrl,
            transferDurationMs: transferDuration,
            completedAt: completedAt ?? undefined,
            overallStatus,
            result: payload,
          }
        : current
    );

    if (total === 0) {
      setTransferView("idle");
      notify({
        tone: "info",
        title: "No tracks found",
        description: "This playlist has no transferable tracks yet.",
      });
      transferResultAppliedRef.current = true;
      transferNotificationShownRef.current = true;
      return true;
    }

    if (transferIsRetryAttemptRef.current && failedCount > 0) {
      // This was a retry pass (one allowed) and some tracks still failed —
      // show the dedicated post-retry-failure state instead of the normal
      // partial/error screens, since no further retry is offered.
      setTransferView("postRetryFailure");
    } else if (overallStatus === "failure" || transferredCount === 0) {
      setTransferView("error");
    } else if (failedCount > 0) {
      setTransferView("partial");
    } else {
      setTransferView("success");
    }

    transferResultAppliedRef.current = true;
    if (options?.notify !== false && !transferNotificationShownRef.current) {
      const tone = overallStatus === "failure" || transferredCount === 0 ? "error" : "success";
      notify({
        tone,
        title:
          overallStatus === "success"
            ? "Transfer complete"
            : overallStatus === "partial"
              ? "Transfer finished with partial matches"
              : "Transfer finished with no matches",
        description: `${transferredCount} transferred, ${failedCount} failed.`,
      });
      transferNotificationShownRef.current = true;
    }
    return true;
  }

  async function runTransfer(
    playlistId: string,
    options?: {
      retryTrackIds?: string[];
      targetPlaylistId?: string | null;
      matchMode?: "normal" | "relaxed";
    }
  ) {
    let requestAborted = false;
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("[transfer:click] runTransfer invoked", {
          playlistId,
          fromPlatform,
          toPlatform,
          fromConnected,
          toConnected,
          fromConnectedEffective,
          toConnectedEffective,
          spotifySessionExpired,
          youtubeSessionExpired,
        });
      }
      const status = await refreshAuthStatus();
      if (status) {
        const { spotifyConnected, youtubeConnected } = status;
        if (process.env.NODE_ENV !== "production") {
          console.log("[transfer:click] auth status preflight", {
            spotifyConnected,
            youtubeConnected,
          });
        }

        const sourceConnected =
          (fromPlatform === "spotify" && spotifyConnected) ||
          (fromPlatform === "youtube" && youtubeConnected);
        const destinationConnected =
          (toPlatform === "spotify" && spotifyConnected) ||
          (toPlatform === "youtube" && youtubeConnected);

        if (!sourceConnected || !destinationConnected) {
          const expiredPlatforms: string[] = [];
          if (!spotifyConnected && (fromPlatform === "spotify" || toPlatform === "spotify")) {
            expiredPlatforms.push("Spotify");
          }
          if (!youtubeConnected && (fromPlatform === "youtube" || toPlatform === "youtube")) {
            expiredPlatforms.push("YouTube Music");
          }
          const reconnectText =
            expiredPlatforms.length > 0
              ? `${expiredPlatforms.join(" and ")} session${expiredPlatforms.length > 1 ? "s" : ""} expired.`
              : "One of your platform sessions expired.";
          notify({
            tone: "error",
            title: "Reconnect required",
            description: `${reconnectText} Please reconnect and try again.`,
          });
          return;
        }
      }
    } catch {
      // If status preflight fails, proceed and let transfer API return the concrete error.
    }

    const selectedPlaylist = playlists.find((playlist) => playlist.id === playlistId) ?? null;
    if (!selectedPlaylist) {
      notify({
        tone: "error",
        title: "Playlist not found",
        description: "Please reselect the source playlist and try again.",
      });
      return;
    }

    setIsPreparingTransfer(true);
    setTransferView("transferring");
    setActiveTransferPlaylist(selectedPlaylist);
    setFailedTracks([]);
    setTransferTotal(0);
    setTransferSucceeded(0);
    setTransferTargetPlaylistId(null);
    setTransferTargetPlaylistUrl(null);
    setTransferCompletedAt(null);
    setTransferDurationMs(0);
    setTransferOverallStatus(null);
    setTransferProgress(null);
    transferResultAppliedRef.current = false;
    transferNotificationShownRef.current = false;

    const transferId = window.crypto.randomUUID();
    setActiveTransferId(transferId);
    const controller = new AbortController();
    transferAbortControllerRef.current = controller;
    transferCancelledRef.current = false;
    transferIsRetryAttemptRef.current = Boolean(options?.retryTrackIds && options.retryTrackIds.length > 0);
    const timeoutId = setTimeout(() => controller.abort(), 75_000);

    if (transferProgressPollRef.current !== null) {
      window.clearInterval(transferProgressPollRef.current);
      transferProgressPollRef.current = null;
    }

    const pollTransferProgress = async () => {
      if (transferCancelledRef.current) return;
      try {
        const progressResponse = await fetch(`/api/transfer/progress?transferId=${encodeURIComponent(transferId)}`, {
          cache: "no-store",
        });
        if (!progressResponse.ok) return;
        const progress = await progressResponse.json().catch(() => null);
        if (!progress) return;
        setTransferProgress(progress);
        if ((progress.status === "done" || progress.status === "error") && progress.result && !transferResultAppliedRef.current) {
          applyTransferPayload(progress.result, { notify: true });
        }
        if (progress.status === "done" || progress.status === "error") {
          if (transferProgressPollRef.current !== null) {
            window.clearInterval(transferProgressPollRef.current);
            transferProgressPollRef.current = null;
          }
        }
      } catch {
        // best effort only
      }
    };

    void pollTransferProgress();
    transferProgressPollRef.current = window.setInterval(() => {
      void pollTransferProgress();
    }, 1000);

    try {
      const response = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePlatform: fromPlatform,
          targetPlatform: toPlatform,
          playlistId,
          playlistName: selectedPlaylist.name,
          transferId,
          retryTrackIds: options?.retryTrackIds ?? [],
          targetPlaylistId: options?.targetPlaylistId ?? null,
          matchMode: options?.matchMode ?? "normal",
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);
      if (process.env.NODE_ENV !== "production") {
        console.log("[transfer:click] /api/transfer response", {
          ok: response.ok,
          status: response.status,
          payload,
        });
      }

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to transfer playlist right now.");
      }

      applyTransferPayload(payload, { notify: true });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        requestAborted = true;
        if (transferCancelledRef.current) {
          // User explicitly cancelled — handleCancelTransfer already reset the UI.
          return;
        }
        // Do not flip to error — the progress poll keeps watching until the
        // backend finishes and posts the final result.
        notify({
          tone: "info",
          title: "Transfer still running",
          description: "We are keeping an eye on the transfer progress.",
        });
        return;
      }

      // Non-abort error (e.g. gateway timeout, network blip): the backend may
      // have already finished successfully. Keep the poll alive so it can
      // deliver the real result instead of showing a premature error screen.
      requestAborted = true;
      notify({
        tone: "info",
        title: "Transfer still running",
        description: "Checking for results…",
      });
    } finally {
      clearTimeout(timeoutId);
      setIsPreparingTransfer(false);
      if (!requestAborted && transferProgressPollRef.current !== null) {
        window.clearInterval(transferProgressPollRef.current);
        transferProgressPollRef.current = null;
      }
    }
  }

  async function handleTransferClick() {
    if (!canTransfer) return;
    if (!selectedId) return;
    void runTransfer(selectedId);
  }

  async function disconnectPlatformConnection({
    requireFreshAuth = false,
    softOnly = false,
  }: { requireFreshAuth?: boolean; softOnly?: boolean } = {}) {
    if (!disconnectTarget || isDisconnecting) return;

    setIsDisconnecting(true);
    try {
      if (!softOnly) {
        const response = await fetch(`/api/auth?action=disconnect&platform=${disconnectTarget}`, {
          method: "POST",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Failed to disconnect platform.");
        }
      }

      if (disconnectTarget === "spotify") {
        setSpotifySessionExpired(false);
        resetTransferSession();
        if (!softOnly) {
          setSpotifyAccountConnected(false);
        }
        if (fromPlatform === "spotify") {
          setFromConnected(false);
        }
        if (toPlatform === "spotify") {
          setToConnected(false);
        }
        setPlaylists([]);
        setSelectedId(null);
        setPlaylistCountLoadingId(null);
        setPlaylistCountCooldownUntil(0);
        playlistCountInFlightRef.current = false;
        setHasLoadedSpotifyPlaylists(false);
        setHasAttemptedSpotifyLoad(false);
        if (requireFreshAuth && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(SPOTIFY_FORCE_FRESH_AUTH_KEY, "1");
          } catch {
            // Ignore storage failures for MVP stability.
          }
        }

        if (softOnly) {
          notify({
            tone: "success",
            title: "Spotify disconnected",
            description: "You can reconnect instantly without fresh authorization.",
          });
        } else {
          notify({
            tone: "success",
            title: requireFreshAuth ? "Spotify reset" : "Spotify disconnected",
            description: requireFreshAuth
              ? "Next Spotify connect will ask for fresh authorization."
              : "You can reconnect Spotify anytime.",
          });
        }
      } else if (disconnectTarget === "youtube") {
        setYoutubeSessionExpired(false);
        resetTransferSession();
        if (!softOnly) {
          setYoutubeAccountConnected(false);
        }
        if (fromPlatform === "youtube") {
          setFromConnected(false);
          setPlaylists([]);
          setSelectedId(null);
          setPlaylistCountLoadingId(null);
          setPlaylistCountCooldownUntil(0);
          playlistCountInFlightRef.current = false;
          setHasLoadedSpotifyPlaylists(false);
          setHasAttemptedSpotifyLoad(false);
        }
        if (toPlatform === "youtube") {
          setToConnected(false);
        }
        notify({
          tone: "success",
          title: "YouTube Music disconnected",
          description: softOnly
            ? "You can reconnect instantly without fresh authorization."
            : "You can reconnect YouTube Music anytime.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to disconnect platform.";
      notify({
        tone: "error",
        title: "Disconnect failed",
        description: message,
      });
    } finally {
      setIsDisconnecting(false);
      setDisconnectTarget(null);
    }
  }

  function handleYesDisconnect() {
    void disconnectPlatformConnection({ requireFreshAuth: false, softOnly: true });
  }

  function handleResetConnection() {
    void disconnectPlatformConnection({ requireFreshAuth: true });
  }

  const cardPadding = isMobile ? "24px 16px 24px" : "36px 36px 32px";
  const disconnectPlatformLabel = disconnectTarget === "spotify" ? "Spotify" : "YouTube Music";

  if (!hostReady) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0f0f0f",
        color: "rgba(255,255,255,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
      }}>
        Redirecting...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0f0f0f",
      padding: isMobile ? "24px 16px 48px" : "32px 24px 72px",
      fontFamily: "'DM Sans', sans-serif",
      overflowX: "hidden",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        body { overflow-x: hidden; }
      `}</style>

      <div style={{ maxWidth: 740, margin: "0 auto", width: "100%" }}>

        {/* ── Top bar: back arrow + logo ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: isMobile ? 20 : 22,
        }}>
          <a href="/" style={{
            display: "inline-flex", alignItems: "center",
            color: "#e8c547", textDecoration: "none",
            lineHeight: 1, transition: "transform 0.2s",
            minHeight: 44, minWidth: 44,
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateX(-4px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateX(0)")}
            aria-label="Back to home"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="16" />
            </svg>
          </a>

          <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
            <img src="/apple-touch-icon.png" alt="Syncly" width={24} height={24} style={{ display: "block", flexShrink: 0, borderRadius: 999 }} />
            <span style={{ fontFamily: "'Aleo', serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px", color: "#f0ede8" }}>
              Syncly
            </span>
          </a>
        </div>

        {/* ── Main card ── */}
        <div style={{
          background: "#131316", borderRadius: isMobile ? 18 : 24,
          padding: cardPadding,
          border: "none",
          boxShadow: "none",
        }} className="transfer-card-inner">
          {/* Platform selector */}
          <h2 style={{
            fontFamily: "'Calligraffitti', cursive",
            fontSize: isMobile ? 16 : 24,
            fontWeight: 400, color: "rgba(255,255,255,0.9)",
            marginBottom: isMobile ? 16 : 24,
            letterSpacing: "0.1px",
          }}>
            Platform selector
          </h2>

          <div ref={platformSelectorAreaRef}>
            <PlatformSelector
              fromPlatform={fromPlatform}
              toPlatform={toPlatform}
              fromConnected={fromConnectedEffective}
              toConnected={toConnectedEffective}
              onFromSelect={handleFromSelect}
              onToSelect={handleToSelect}
              onFromConnect={handleFromConnect}
              onToConnect={handleToConnect}
              onFromDisconnect={handleFromDisconnect}
              onToDisconnect={handleToDisconnect}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: isMobile ? "20px 0" : "32px 0" }} />

          {transferView === "idle" && (
            <>
              <div ref={playlistListAreaRef} style={{ marginBottom: isMobile ? 20 : 32 }}>
                <PlaylistList
                  platform={fromPlatform}
                  connected={fromConnected}
                  loading={isLoadingPlaylists}
                  playlists={playlists}
                  selectedId={selectedId}
                  countLoadingId={playlistCountLoadingId}
                  onSelect={handlePlaylistSelect}
                />
              </div>

              <div
                ref={transferButtonAreaRef}
                style={{ display: "flex", justifyContent: isMobile ? "stretch" : "center" }}
                className="transfer-btn-wrapper"
              >
                <button
                  disabled={Boolean(transferDisabledReason) || isPreparingTransfer}
                  style={{
                    width: isMobile ? "100%" : "45%",
                    minWidth: isMobile ? "auto" : 200,
                    padding: isMobile ? "18px 24px" : "16px 24px",
                    borderRadius: 100, border: "none",
                    background: !transferDisabledReason && !isPreparingTransfer ? "#e8c547" : "rgba(255,255,255,0.08)",
                    color: !transferDisabledReason && !isPreparingTransfer ? "#0a0a0b" : "rgba(255,255,255,0.3)",
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
                    fontSize: isMobile ? 17 : 16,
                    cursor: !transferDisabledReason && !isPreparingTransfer ? "pointer" : "not-allowed",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { if (!transferDisabledReason) { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(232,197,71,0.3)"; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                  onClick={handleTransferClick}
                >
                  {isPreparingTransfer ? "Preparing transfer..." : "Transfer playlist"}
                </button>
              </div>
            </>
          )}

          {transferView === "transferring" && activeTransferPlaylist && (
            <TransferringState
              progress={transferProgress}
              total={Math.max(transferTotal || activeTransferPlaylist.trackCount || 1, 1)}
              isMobile={isMobile}
              playlist={activeTransferPlaylist}
              onCancel={handleRequestCancelTransfer}
            />
          )}

          {transferView === "success" && activeTransferPlaylist && (
            <SuccessState
              isMobile={isMobile}
              playlist={activeTransferPlaylist}
              total={transferTotal}
              targetPlaylistId={transferTargetPlaylistId}
              onStartAnother={resetTransferSession}
            />
          )}

          {transferView === "partial" && activeTransferPlaylist && (
            <PartialState
              failedTracks={failedTracks}
              isMobile={isMobile}
              sourceTrackCount={transferTotal}
              transferred={transferSucceeded}
              transferDurationMs={transferDurationMs}
              completedAt={transferCompletedAt}
              targetPlaylistUrl={transferTargetPlaylistUrl}
              onRetry={handleRetry}
              onStartAnother={resetTransferSession}
            />
          )}

          {transferView === "error" && activeTransferPlaylist && (
            <ErrorState
              isMobile={isMobile}
              playlist={activeTransferPlaylist}
              failedTracks={failedTracks}
              sourceTrackCount={transferTotal}
              transferredCount={transferSucceeded}
              transferDurationMs={transferDurationMs}
              completedAt={transferCompletedAt}
              targetPlaylistUrl={transferTargetPlaylistUrl}
              onTryAgain={handleRetry}
              onStartAnother={resetTransferSession}
            />
          )}

          {transferView === "postRetryFailure" && activeTransferPlaylist && (
            <PostRetryFailureState
              playlist={activeTransferPlaylist}
              failedTracks={failedTracks}
              totalRetried={transferTotal}
              isMobile={isMobile}
              onStartAnother={resetTransferSession}
            />
          )}
        </div>

      </div>

      {disconnectTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: isMobile ? "12px" : "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#131316",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: isMobile ? "18px 16px 20px" : "20px 22px 24px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setDisconnectTarget(null)}
              disabled={isDisconnecting}
              aria-label="Close modal"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 30,
                height: 30,
                minWidth: 30,
                minHeight: 30,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.72)",
                fontSize: 18,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                cursor: isDisconnecting ? "not-allowed" : "pointer",
                opacity: isDisconnecting ? 0.55 : 1,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ×
            </button>
            <h3
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 22,
                lineHeight: 1.2,
                color: "#f0ede8",
                margin: "0 0 10px",
                paddingRight: 36,
              }}
            >
              Disconnect {disconnectPlatformLabel}?
            </h3>
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.58)",
                lineHeight: 1.5,
                margin: "0 0 26px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Disconnect keeps quick reconnect. Reset connection asks for fresh auth on next connect.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: isMobile ? 6 : 8,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleYesDisconnect}
                disabled={isDisconnecting}
                style={{
                  ...btnWhite,
                  flex: "0 0 auto",
                  padding: isMobile ? "10px 14px" : "10px 20px",
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  borderRadius: 8,
                  color: "#0a0a0b",
                  opacity: isDisconnecting ? 0.6 : 1,
                  cursor: isDisconnecting ? "not-allowed" : "pointer",
                }}
              >
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
              <button
                onClick={handleResetConnection}
                disabled={isDisconnecting}
                style={{
                  ...btnWhite,
                  flex: "0 0 auto",
                  padding: isMobile ? "10px 14px" : "10px 20px",
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  borderRadius: 8,
                  background: "#e8c547",
                  color: "#0a0a0b",
                  opacity: isDisconnecting ? 0.7 : 1,
                  cursor: isDisconnecting ? "not-allowed" : "pointer",
                }}
              >
                {isDisconnecting ? "Resetting..." : "Reset connection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelTransferConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: isMobile ? "12px" : "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#131316",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: isMobile ? "18px 16px 20px" : "20px 22px 24px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowCancelTransferConfirm(false)}
              aria-label="Close modal"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 30,
                height: 30,
                minWidth: 30,
                minHeight: 30,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.72)",
                fontSize: 18,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ×
            </button>
            <h3
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 22,
                lineHeight: 1.2,
                color: "#f0ede8",
                margin: "0 0 10px",
                paddingRight: 36,
              }}
            >
              Cancel this transfer?
            </h3>
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.58)",
                lineHeight: 1.5,
                margin: "0 0 26px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              We&apos;ll stop the transfer right away. Songs already added to the destination playlist will remain there — this can&apos;t be undone.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: isMobile ? 6 : 8,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowCancelTransferConfirm(false)}
                style={{
                  ...btnWhite,
                  flex: "0 0 auto",
                  padding: isMobile ? "10px 14px" : "10px 20px",
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  borderRadius: 8,
                  color: "#0a0a0b",
                }}
              >
                Keep transferring
              </button>
              <button
                onClick={handleConfirmCancelTransfer}
                style={{
                  ...btnWhite,
                  flex: "0 0 auto",
                  padding: isMobile ? "10px 14px" : "10px 20px",
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  borderRadius: 8,
                  background: "#e8c547",
                  color: "#0a0a0b",
                }}
              >
                Cancel transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
