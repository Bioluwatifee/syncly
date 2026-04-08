"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "@/types";
import PlatformSelector from "@/components/transfer/PlatformSelector";
import PlaylistList, { PlaylistItem } from "@/components/transfer/PlaylistList";
import { useToast } from "@/components/ui/ToastProvider";
import CheckMarkIcon from "@/components/ui/CheckMarkIcon";

const SPOTIFY_PLAYLIST_COUNT_CACHE_KEY = "syncly_spotify_playlist_count_cache_v2";
const SPOTIFY_FORCE_FRESH_AUTH_KEY = "syncly_force_spotify_fresh_auth_once";

interface TrackResult {
  id: string;
  name: string;
  artist: string;
  imageUrl?: string;
  status: "success" | "failed" | "pending";
  failureReason?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_PLAYLISTS: PlaylistItem[] = [
  { id: "1", name: "This feels like it",   owner: "Stanye", trackCount: 22, imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop" },
  { id: "2", name: "Green mirage",          owner: "Stanye", trackCount: 22, imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=100&h=100&fit=crop" },
  { id: "3", name: "Moments of nostalgia",  owner: "Elara",  trackCount: 15, imageUrl: "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=100&h=100&fit=crop" },
  { id: "4", name: "Chasing the moon",      owner: "Ryder",  trackCount: 10, imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=100&h=100&fit=crop" },
];

const MOCK_TRACKS: TrackResult[] = [
  { id: "t1", name: "Green mirage",         artist: "Stanye", imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=100&h=100&fit=crop", status: "success" },
  { id: "t2", name: "Moments of nostalgia", artist: "Elara",  imageUrl: "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=100&h=100&fit=crop", status: "success" },
  { id: "t3", name: "Chasing the moon",     artist: "Ryder",  imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=100&h=100&fit=crop", status: "failed"  },
];

// TODO: Replace placeholder reasons with real API error responses when Spotify and YouTube Music OAuth is wired up
const MOCK_FAILED_TRACKS: TrackResult[] = [
  { id: "f1", name: "Chasing the moon",     artist: "Ryder", imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=100&h=100&fit=crop", status: "failed", failureReason: "Not available on YouTube Music" },
  { id: "f2", name: "Midnight Rain (Demo)", artist: "Taylor Swift", imageUrl: "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=100&h=100&fit=crop", status: "failed", failureReason: "Explicit version unavailable" },
  { id: "f3", name: "Golden Hour",          artist: "JVKE", imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=100&h=100&fit=crop", status: "failed", failureReason: "Region restricted" },
  { id: "f4", name: "Levitating",           artist: "Dua Lipa", imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=100&h=100&fit=crop", status: "failed", failureReason: "Not available on YouTube Music" },
];

// Subset of failed tracks that still fail after retry (for post-retry partial/error state)
const MOCK_POST_RETRY_FAILED: TrackResult[] = [
  { id: "f1", name: "Chasing the moon",     artist: "Ryder", imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=100&h=100&fit=crop", status: "failed", failureReason: "Not available on YouTube Music" },
  { id: "f3", name: "Golden Hour",          artist: "JVKE", imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=100&h=100&fit=crop", status: "failed", failureReason: "Region restricted" },
];

const SELECTED_PLAYLIST = MOCK_PLAYLISTS[0];

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
function PlaylistCard({ retryCount }: { retryCount?: number }) {
  const count = retryCount ?? SELECTED_PLAYLIST.trackCount;
  const showRetryLabel = retryCount !== undefined;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", borderRadius: 14,
      border: "1px solid rgba(232,197,71,0.7)",
      background: "rgba(232,197,71,0.04)",
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.08)" }}>
        <img src={SELECTED_PLAYLIST.imageUrl!} alt={SELECTED_PLAYLIST.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SELECTED_PLAYLIST.name}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{SELECTED_PLAYLIST.owner}</div>
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

// ─── Copy failed songs list button ───────────────────────────────────────────
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
        display: "flex", alignItems: "center", gap: 6,
        background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 100, padding: "10px 18px",
        fontSize: 13, color: "rgba(255,255,255,0.6)",
        fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
        cursor: "pointer", transition: "border-color 0.2s, color 0.2s",
        marginTop: 8,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      {copied ? "Copied!" : "Copy failed songs list"}
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
function TransferringState({ tracks, total, isMobile, isRetry }: { tracks: TrackResult[]; total: number; isMobile: boolean; isRetry?: boolean }) {
  const done = tracks.filter(t => t.status !== "pending").length;
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
        {isRetry ? `Retrying ${total} failed tracks` : "Transferring playlist…"}
      </h2>
      <PlaylistCard retryCount={isRetry ? total : undefined} />
      <div style={{ margin: "4px 0" }}>
        {tracks.map((t, i) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: isMobile ? "14px 4px" : "13px 4px",
            borderBottom: i < tracks.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
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
      <ProgressBar done={done} total={total} label={`${done} out of ${total} in progress`} />
    </>
  );
}

// ─── State: Success ───────────────────────────────────────────────────────────
function SuccessState({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
        Transferring playlist…
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? "32px 20px" : "48px 32px", textAlign: "center" }}>
        <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Playlist successfully transferred</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 24 }}>
          {SELECTED_PLAYLIST.name} by {SELECTED_PLAYLIST.owner}
        </div>
        <div style={{ marginBottom: 28 }}><PlatformRow /></div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
          <button style={btnWhite}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >Open YouTube Music</button>
          <button style={btnYellow}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Start another transfer</button>
        </div>
      </div>
      <ProgressBar done={24} total={24} label="24 out of 24 transferred" />
    </>
  );
}

// ─── State: Partial Match ─────────────────────────────────────────────────────
function PartialState({ failedTracks, isMobile, onRetry }: { failedTracks: TrackResult[]; isMobile: boolean; onRetry: () => void }) {
  const total = 24, transferred = 18;
  const failed = failedTracks.length;
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
        Transferring playlist…
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? "24px 16px" : "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{transferred} out of {total} songs transferred</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>{failed} songs could not be found</div>
          <SplitBar success={transferred} failed={failed} total={total} />
          <div style={{ marginTop: 20, marginBottom: 4 }}><PlatformRow /></div>
        </div>
        <FailedTrackList tracks={failedTracks} isMobile={isMobile} />
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <CopyFailedButton tracks={failedTracks} />
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
          <button style={btnWhite}
            onClick={onRetry}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >Retry failed songs</button>
          <button style={btnYellow}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Start another transfer</button>
        </div>
      </div>
      <ProgressBar done={transferred} total={total} label={`${transferred} out of ${total} completed`} sublabel={`${failed} songs not matched`} />
    </>
  );
}

// ─── State: Post-retry partial/full failure (no more retry allowed) ───────────
function PostRetryFailureState({ failedTracks, totalRetried, isMobile }: { failedTracks: TrackResult[]; totalRetried: number; isMobile: boolean }) {
  const transferred = totalRetried - failedTracks.length;
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
        Transferring playlist…
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? "24px 16px" : "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
            Oops! {transferred} out of {totalRetried} songs transferred
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>
            It&apos;s on us, {failedTracks.length} {failedTracks.length === 1 ? "song" : "songs"} still failed to transfer
          </div>
          <PlatformRow />
        </div>
        {/* Failed tracks with reasons */}
        {/* TODO: Replace placeholder reasons with real API error responses when Spotify and YouTube Music OAuth is wired up */}
        <div style={{ marginTop: 16 }}>
          <FailedTrackList tracks={failedTracks} isMobile={isMobile} showReasons />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <CopyFailedButton tracks={failedTracks} />
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
          <button style={btnWhite}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >Open YouTube Music</button>
          <button style={btnYellow}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Start another transfer</button>
        </div>
      </div>
    </>
  );
}

// ─── State: Error (total failure) ────────────────────────────────────────────
function ErrorState({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 22 : 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
        Transferring playlist…
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? "24px 16px" : "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>We couldn&apos;t transfer any song</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>This is on us not you, please try again!</div>
          <PlatformRow />
        </div>
        <div style={{ marginBottom: 24 }}><PlaylistCard /></div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
          <button style={btnWhite}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >Try again</button>
          <button style={btnYellow}
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
  const [hasLoadedSpotifyPlaylists, setHasLoadedSpotifyPlaylists] = useState(false);
  const [hasAttemptedSpotifyLoad, setHasAttemptedSpotifyLoad] = useState(false);
  const [playlistCountLoadingId, setPlaylistCountLoadingId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<"spotify" | "youtube" | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [hostReady, setHostReady] = useState(true);
  // Tracks whether the user has already used their one retry
  const [hasRetried,    setHasRetried]    = useState(false);
  const playlistsLoadInFlightRef = useRef(false);
  const countHydrationInFlightRef = useRef(false);
  const hydratedPlaylistIdsRef = useRef<Set<string>>(new Set());

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
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [hostReady]);

  const isDirectionSupported =
    (fromPlatform === "spotify" && toPlatform === "youtube") ||
    (fromPlatform === "youtube" && toPlatform === "spotify");
  const canTransfer = fromConnected && toConnected && selectedId !== null && isDirectionSupported;

  const loadSourcePlaylists = useCallback(async (sourcePlatform: "spotify" | "youtube") => {
    if (playlistsLoadInFlightRef.current) return;
    playlistsLoadInFlightRef.current = true;
    hydratedPlaylistIdsRef.current.clear();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);
    setIsLoadingPlaylists(true);
    setHasAttemptedSpotifyLoad(true);
    try {
      const cachedCountById: Record<string, number> =
        sourcePlatform === "spotify" && typeof window !== "undefined"
          ? (() => {
              try {
                const raw = window.localStorage.getItem(SPOTIFY_PLAYLIST_COUNT_CACHE_KEY);
                if (!raw) return {};
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                const normalized: Record<string, number> = {};
                for (const [key, value] of Object.entries(parsed)) {
                  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
                    normalized[key] = Math.trunc(value);
                  }
                }
                return normalized;
              } catch {
                return {};
              }
            })()
          : {};

      const response = await fetch(`/api/${sourcePlatform}?resource=playlists`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 401) {
          // If backend says disconnected, reflect that immediately in UI.
          setFromConnected(false);
          setPlaylists([]);
          setSelectedId(null);
          setPlaylistCountLoadingId(null);
          setHasLoadedSpotifyPlaylists(false);
          if (sourcePlatform === "spotify") {
            setSpotifyAccountConnected(false);
          } else {
            setYoutubeAccountConnected(false);
          }
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
  }, []);

  useEffect(() => {
    if (!hostReady) return;

    let mounted = true;

    async function hydrateConnectionState() {
      const params = new URLSearchParams(window.location.search);
      const authResult = params.get("auth");
      const reason = params.get("reason");
      const connectSide = params.get("connectSide");
      let shouldLoadSourcePlaylists = false;
      let sourceToLoad: "spotify" | "youtube" | null = null;

      if (authResult === "spotify_success") {
        setSpotifyAccountConnected(true);
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
        const message = reason ? `Authentication failed: ${reason.replaceAll("_", " ")}` : fallback;
        notify({
          tone: "error",
          title: "Authentication failed",
          description: message,
        });
      }

      if (authResult || reason || connectSide) {
        params.delete("auth");
        params.delete("reason");
        params.delete("connectSide");
        const newQuery = params.toString();
        const nextUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ""}`;
        window.history.replaceState({}, "", nextUrl);
      }

      try {
        const statusResponse = await fetch("/api/auth?action=status", { cache: "no-store" });
        if (!statusResponse.ok) return;

        const status = await statusResponse.json();
        if (!mounted) return;

        const spotifyConnected = Boolean(status.spotifyConnected);
        const youtubeConnected = Boolean(status.youtubeConnected);

        setSpotifyAccountConnected(spotifyConnected);
        setYoutubeAccountConnected(youtubeConnected);

        const fromIsConnected =
          (fromPlatform === "spotify" && spotifyConnected) ||
          (fromPlatform === "youtube" && youtubeConnected);
        const toIsConnected =
          (toPlatform === "spotify" && spotifyConnected) ||
          (toPlatform === "youtube" && youtubeConnected);

        setFromConnected(fromIsConnected);
        setToConnected(toIsConnected);

        if (!fromIsConnected) {
          setPlaylists([]);
          setSelectedId(null);
          setPlaylistCountLoadingId(null);
          setHasLoadedSpotifyPlaylists(false);
        } else if (fromPlatform === "spotify" || fromPlatform === "youtube") {
          shouldLoadSourcePlaylists = true;
          sourceToLoad = fromPlatform;
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
  }, [fromPlatform, hostReady, loadSourcePlaylists, notify, toPlatform]);

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
    if (!fromConnected) return;
    if (fromPlatform !== "spotify" && fromPlatform !== "youtube") return;

    void loadSourcePlaylists(fromPlatform);
  }, [fromConnected, fromPlatform, hostReady, loadSourcePlaylists]);

  useEffect(() => {
    if (!hostReady) return;
    if (!fromConnected || (fromPlatform !== "spotify" && fromPlatform !== "youtube")) return;
    if (!selectedId) return;

    const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedId);
    if (!selectedPlaylist || selectedPlaylist.trackCount !== null) return;

    let cancelled = false;
    const playlistId = selectedId;

    async function loadSelectedPlaylistCount() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      setPlaylistCountLoadingId(playlistId);
      try {
        const response = await fetch(`/api/${fromPlatform}?resource=trackCount&playlistId=${encodeURIComponent(playlistId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = await response.json();
        const totalParsed = Number(payload?.total);
        const resolvedCount =
          Number.isFinite(totalParsed) && totalParsed >= 0
            ? Math.trunc(totalParsed)
            : null;

        if (cancelled || resolvedCount === null) return;

        setPlaylists((prev) =>
          prev.map((playlist) =>
            playlist.id === playlistId ? { ...playlist, trackCount: resolvedCount } : playlist
          )
        );
      } catch {
        // Keep UI responsive; leave count unresolved if this request times out.
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setPlaylistCountLoadingId((current) => (current === playlistId ? null : current));
        }
      }
    }

    void loadSelectedPlaylistCount();

    return () => {
      cancelled = true;
    };
  }, [fromConnected, fromPlatform, hostReady, playlists, selectedId]);

  useEffect(() => {
    if (!hostReady) return;
    if (!fromConnected || (fromPlatform !== "spotify" && fromPlatform !== "youtube")) return;
    if (isLoadingPlaylists) return;
    if (playlists.length === 0) return;
    if (countHydrationInFlightRef.current) return;

    const pendingIds = playlists
      .filter((playlist) => playlist.trackCount === null && !hydratedPlaylistIdsRef.current.has(playlist.id))
      .map((playlist) => playlist.id);

    if (pendingIds.length === 0) return;

    let cancelled = false;
    countHydrationInFlightRef.current = true;

    async function hydrateAllPlaylistCounts() {
      for (const playlistId of pendingIds) {
        if (cancelled) break;

        hydratedPlaylistIdsRef.current.add(playlistId);

        try {
          const response = await fetch(`/api/${fromPlatform}?resource=trackCount&playlistId=${encodeURIComponent(playlistId)}`, {
            cache: "no-store",
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            const message = String(payload?.error ?? "").toLowerCase();
            if (response.status === 429 || message.includes("too many requests") || message.includes("rate limit")) {
              break;
            }
            continue;
          }

          const payload = await response.json();
          const totalParsed = Number(payload?.total);
          const resolvedCount =
            Number.isFinite(totalParsed) && totalParsed >= 0 ? Math.trunc(totalParsed) : null;

          if (resolvedCount === null) continue;

          setPlaylists((prev) =>
            prev.map((playlist) =>
              playlist.id === playlistId ? { ...playlist, trackCount: resolvedCount } : playlist
            )
          );

          if (typeof window !== "undefined" && fromPlatform === "spotify") {
            try {
              const raw = window.localStorage.getItem(SPOTIFY_PLAYLIST_COUNT_CACHE_KEY);
              const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
              parsed[playlistId] = resolvedCount;
              window.localStorage.setItem(SPOTIFY_PLAYLIST_COUNT_CACHE_KEY, JSON.stringify(parsed));
            } catch {
              // Ignore storage failures for MVP stability.
            }
          }
        } catch {
          // Ignore transient per-playlist failures.
        }

        // Gentle pacing to avoid triggering Spotify rate limits.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      countHydrationInFlightRef.current = false;
    }

    void hydrateAllPlaylistCounts();

    return () => {
      cancelled = true;
      countHydrationInFlightRef.current = false;
    };
  }, [fromConnected, fromPlatform, hostReady, isLoadingPlaylists, playlists]);

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

    const authUrl = new URL("/api/auth", window.location.origin);
    authUrl.searchParams.set("action", "connect");
    authUrl.searchParams.set("platform", toPlatform);
    authUrl.searchParams.set("returnTo", "/transfer?connectSide=to");
    if (typeof window !== "undefined" && toPlatform === "spotify") {
      const shouldForceFreshAuth = window.localStorage.getItem(SPOTIFY_FORCE_FRESH_AUTH_KEY) === "1";
      if (shouldForceFreshAuth) {
        authUrl.searchParams.set("forceDialog", "1");
        window.localStorage.removeItem(SPOTIFY_FORCE_FRESH_AUTH_KEY);
      }
    }
    window.location.href = authUrl.toString();
  }

  function handleFromSelect(p: Platform) {
    setFromPlatform(p);
    const connected = p === "spotify" ? spotifyAccountConnected : p === "youtube" ? youtubeAccountConnected : false;
    setFromConnected(connected);
    setPlaylists([]);
    setSelectedId(null);
    setPlaylistCountLoadingId(null);
    setHasLoadedSpotifyPlaylists(false);
    setHasAttemptedSpotifyLoad(false);
    hydratedPlaylistIdsRef.current.clear();
  }
  function handleToSelect(p: Platform) {
    setToPlatform(p);
    const connected = p === "spotify" ? spotifyAccountConnected : p === "youtube" ? youtubeAccountConnected : false;
    setToConnected(connected);
  }

  function handleRetry() {
    setHasRetried(true);
    // TODO: trigger real retry API call here
  }

  function handleFromDisconnect() {
    if (!fromConnected || (fromPlatform !== "spotify" && fromPlatform !== "youtube")) return;
    setDisconnectTarget(fromPlatform);
  }

  function handleToDisconnect() {
    if (!toConnected || (toPlatform !== "spotify" && toPlatform !== "youtube")) return;
    setDisconnectTarget(toPlatform);
  }

  async function disconnectPlatformConnection({ requireFreshAuth = false }: { requireFreshAuth?: boolean } = {}) {
    if (!disconnectTarget || isDisconnecting) return;

    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/auth?action=disconnect&platform=${disconnectTarget}`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to disconnect platform.");
      }

      if (disconnectTarget === "spotify") {
        setSpotifyAccountConnected(false);
        if (fromPlatform === "spotify") {
          setFromConnected(false);
        }
        if (toPlatform === "spotify") {
          setToConnected(false);
        }
        setPlaylists([]);
        setSelectedId(null);
        setPlaylistCountLoadingId(null);
        setHasLoadedSpotifyPlaylists(false);
        setHasAttemptedSpotifyLoad(false);
        hydratedPlaylistIdsRef.current.clear();
        if (requireFreshAuth && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(SPOTIFY_FORCE_FRESH_AUTH_KEY, "1");
          } catch {
            // Ignore storage failures for MVP stability.
          }
        }

        notify({
          tone: "success",
          title: requireFreshAuth ? "Spotify reset" : "Spotify disconnected",
          description: requireFreshAuth
            ? "Next Spotify connect will ask for fresh authorization."
            : "You can reconnect Spotify anytime.",
        });
      } else if (disconnectTarget === "youtube") {
        setYoutubeAccountConnected(false);
        if (fromPlatform === "youtube") {
          setFromConnected(false);
          setPlaylists([]);
          setSelectedId(null);
          setPlaylistCountLoadingId(null);
          setHasLoadedSpotifyPlaylists(false);
          setHasAttemptedSpotifyLoad(false);
          hydratedPlaylistIdsRef.current.clear();
        }
        if (toPlatform === "youtube") {
          setToConnected(false);
        }
        notify({
          tone: "success",
          title: "YouTube Music disconnected",
          description: "You can reconnect YouTube Music anytime.",
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
    void disconnectPlatformConnection({ requireFreshAuth: false });
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
          marginBottom: isMobile ? 28 : 30,
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
            <img src="/favicon-96x96.png" alt="Syncly" width={24} height={24} style={{ display: "block", flexShrink: 0 }} />
            <span style={{ fontFamily: "'Aleo', serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px", color: "#f0ede8" }}>
              Syncly
            </span>
          </a>
        </div>

        {/* ── Page headings ── */}
        <div style={{ marginBottom: isMobile ? 16 : 30 }}>
          <h1 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: isMobile ? 24 : 32, fontWeight: 400, color: "#e8c547", lineHeight: 1.15, marginBottom: 0 }}>
            Welcome, lets move some playlists.
          </h1>
        </div>

        {/* ── Main card ── */}
        <div style={{
          background: "#131316", borderRadius: isMobile ? 18 : 24,
          padding: cardPadding,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }} className="transfer-card-inner">
          {/* Platform selector */}
          <h2 style={{
            fontFamily: "'Calligraffitti', cursive",
            fontSize: isMobile ? 20 : 26,
            fontWeight: 400, color: "rgba(255,255,255,0.5)",
            marginBottom: isMobile ? 16 : 24,
          }}>
            Platform selector
          </h2>

          <PlatformSelector
            fromPlatform={fromPlatform}
            toPlatform={toPlatform}
            fromConnected={fromConnected}
            toConnected={toConnected}
            onFromSelect={handleFromSelect}
            onToSelect={handleToSelect}
            onFromConnect={handleFromConnect}
            onToConnect={handleToConnect}
            onFromDisconnect={handleFromDisconnect}
            onToDisconnect={handleToDisconnect}
          />

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: isMobile ? "20px 0" : "32px 0" }} />

          {/* ── Playlist list + Transfer button (default/connected state) ── */}
          <div style={{ marginBottom: isMobile ? 20 : 32 }}>
            <PlaylistList
              platform={fromPlatform}
              connected={fromConnected}
              loading={isLoadingPlaylists}
              playlists={playlists}
              selectedId={selectedId}
              countLoadingId={playlistCountLoadingId}
              onSelect={setSelectedId}
            />
          </div>

          <div style={{ display: "flex", justifyContent: isMobile ? "stretch" : "center" }} className="transfer-btn-wrapper">
            <button
              disabled={!canTransfer}
              style={{
                width: isMobile ? "100%" : "45%",
                minWidth: isMobile ? "auto" : 200,
                padding: isMobile ? "18px 24px" : "16px 24px",
                borderRadius: 100, border: "none",
                background: canTransfer ? "#e8c547" : "rgba(255,255,255,0.08)",
                color: canTransfer ? "#0a0a0b" : "rgba(255,255,255,0.3)",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
                fontSize: isMobile ? 17 : 16,
                cursor: canTransfer ? "pointer" : "not-allowed",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => { if (canTransfer) { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(232,197,71,0.3)"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >Transfer playlist</button>
          </div>
        </div>

      </div>

      {disconnectTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(3px)",
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
    </div>
  );
}
