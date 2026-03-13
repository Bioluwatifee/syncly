"use client";

import { useState } from "react";
import { Platform } from "@/types";
import PlatformSelector from "@/components/transfer/PlatformSelector";
import PlaylistList, { PlaylistItem } from "@/components/transfer/PlaylistList";

// ─── Types ────────────────────────────────────────────────────────────────────
type PageState = "empty" | "connected" | "transferring" | "success" | "partial" | "error";

interface TrackResult {
  id: string;
  name: string;
  artist: string;
  imageUrl?: string;
  status: "success" | "failed" | "pending";
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

const MOCK_FAILED_TRACKS: TrackResult[] = [
  { id: "f1", name: "Chasing the moon", artist: "Ryder", imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=100&h=100&fit=crop", status: "failed" },
  { id: "f2", name: "Chasing the moon", artist: "Ryder", imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=100&h=100&fit=crop", status: "failed" },
];

const SELECTED_PLAYLIST = MOCK_PLAYLISTS[0];

// ─── Shared sub-components ────────────────────────────────────────────────────

const SpotifyWordmark = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#1ed760">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
    <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Spotify</span>
  </div>
);

const YouTubeMusicWordmark = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#ff4444">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
    <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>YouTube Music</span>
  </div>
);

const SwapIcon = () => (
  <div style={{
    width: 32, height: 32, borderRadius: "50%",
    border: "1.5px solid rgba(255,255,255,0.25)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3L4 7l4 4"/><path d="M4 7h16"/>
      <path d="M16 21l4-4-4-4"/><path d="M20 17H4"/>
    </svg>
  </div>
);

const CheckIcon = () => (
  <div style={{
    width: 28, height: 28, borderRadius: "50%", background: "#1ed760",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </div>
);

const XIcon = () => (
  <div style={{
    width: 28, height: 28, borderRadius: "50%", background: "#e85f47",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </div>
);

const btnBase: React.CSSProperties = {
  flex: 1, padding: "16px 20px", borderRadius: 100,
  fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
  cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
  letterSpacing: "0.2px", border: "none",
};
const btnWhite: React.CSSProperties  = { ...btnBase, background: "#fff",    color: "#0a0a0b" };
const btnYellow: React.CSSProperties = { ...btnBase, background: "#e8c547", color: "#0a0a0b" };

// ─── Progress bar shared ──────────────────────────────────────────────────────
function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ height: 6, borderRadius: 100, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 10 }}>
        <div style={{
          height: "100%", borderRadius: 100,
          width: `${Math.round((done / total) * 100)}%`,
          background: "linear-gradient(90deg, #e8c547, #e85f47)",
          transition: "width 0.4s ease",
        }} />
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{label}</div>
    </div>
  );
}

// ─── Playlist card (yellow border) ───────────────────────────────────────────
function PlaylistCard() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "16px 20px", borderRadius: 14,
      border: "1px solid rgba(232,197,71,0.7)",
      background: "rgba(232,197,71,0.04)",
    }}>
      <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", background: "rgba(255,255,255,0.08)" }}>
        <img src={SELECTED_PLAYLIST.imageUrl!} alt={SELECTED_PLAYLIST.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{SELECTED_PLAYLIST.name}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{SELECTED_PLAYLIST.owner}</div>
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{SELECTED_PLAYLIST.trackCount} songs</div>
    </div>
  );
}

// ─── Platforms row ────────────────────────────────────────────────────────────
function PlatformRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <SpotifyWordmark />
      <SwapIcon />
      <YouTubeMusicWordmark />
    </div>
  );
}

// ─── State: Transferring ──────────────────────────────────────────────────────
function TransferringState({ tracks, total }: { tracks: TrackResult[]; total: number }) {
  const done = tracks.filter(t => t.status !== "pending").length;
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
        Migrating playlist…
      </h2>

      <PlaylistCard />

      <div style={{ margin: "4px 0 4px" }}>
        {tracks.map((t, i) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "13px 4px",
            borderBottom: i < tracks.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", width: 20, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
            <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0, position: "relative", background: "rgba(255,255,255,0.08)" }}>
              {t.imageUrl && <img src={t.imageUrl} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{t.artist}</div>
            </div>
            {t.status === "success" ? <CheckIcon /> : t.status === "failed" ? <XIcon /> : (
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)" }} />
            )}
          </div>
        ))}
      </div>

      <ProgressBar done={done} total={total} label={`${done} out of ${total} in progress`} />
    </>
  );
}

// ─── State: Success ───────────────────────────────────────────────────────────
function SuccessState() {
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
        Migrating playlist…
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "48px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Playlist successfully migrated</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 28 }}>
          {SELECTED_PLAYLIST.name} by {SELECTED_PLAYLIST.owner}
        </div>
        <div style={{ marginBottom: 36 }}><PlatformRow /></div>
        <div style={{ display: "flex", gap: 14 }}>
          <button style={btnWhite}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >Open YouTube Music</button>
          <button style={btnYellow}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Migrate a new playlist</button>
        </div>
      </div>
      <ProgressBar done={24} total={24} label="24 out of 24 completed" />
    </>
  );
}

// ─── State: Partial Match ─────────────────────────────────────────────────────
function PartialState({ failedTracks }: { failedTracks: TrackResult[] }) {
  const total = 24, migrated = 18;
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
        Migrating playlist…
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{migrated} out of {total} songs migrated</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 24 }}>{failedTracks.length} songs could not be found</div>
          <PlatformRow />
        </div>

        <div style={{ marginBottom: 28 }}>
          {failedTracks.map((t, i) => (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "13px 4px",
              borderBottom: i < failedTracks.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", width: 20, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
              <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0, position: "relative", background: "rgba(255,255,255,0.08)" }}>
                {t.imageUrl && <img src={t.imageUrl} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{t.artist}</div>
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic", flexShrink: 0 }}>Song not found</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <button style={btnWhite}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >Open YouTube Music</button>
          <button style={btnYellow}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Migrate a new playlist</button>
        </div>
      </div>
      <ProgressBar done={migrated} total={total} label={`${migrated} out of ${total} completed`} />
    </>
  );
}

// ─── State: Error ─────────────────────────────────────────────────────────────
function ErrorState() {
  return (
    <>
      <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
        Migrating playlist…
      </h2>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>We couldn&apos;t transfer any song</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 24 }}>This is on us not you, please try again!</div>
          <PlatformRow />
        </div>
        <div style={{ marginBottom: 28 }}><PlaylistCard /></div>
        <div style={{ display: "flex", gap: 14 }}>
          <button style={btnWhite}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >Try again</button>
          <button style={btnYellow}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(232,197,71,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >Migrate a new playlist</button>
        </div>
      </div>
    </>
  );
}

// ─── Dev state switcher ───────────────────────────────────────────────────────
const DEV_STATES: { key: PageState; label: string }[] = [
  { key: "empty",        label: "Empty"        },
  { key: "connected",    label: "Connected"    },
  { key: "transferring", label: "Transferring" },
  { key: "success",      label: "Success"      },
  { key: "partial",      label: "Partial Match"},
  { key: "error",        label: "Error"        },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TransferPage() {
  const [fromPlatform,  setFromPlatform]  = useState<Platform | null>(null);
  const [toPlatform,    setToPlatform]    = useState<Platform | null>(null);
  const [fromConnected, setFromConnected] = useState(false);
  const [toConnected,   setToConnected]   = useState(false);
  const [playlists,     setPlaylists]     = useState<PlaylistItem[]>([]);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [devState,      setDevState]      = useState<PageState>("empty");

  const isResultState = ["transferring", "success", "partial", "error"].includes(devState);

  async function handleFromConnect() {
    if (!fromPlatform) return;
    await new Promise(r => setTimeout(r, 1500)); // TODO: replace with real OAuth
    setFromConnected(true);
    setPlaylists(MOCK_PLAYLISTS);
    setSelectedId(null);
  }
  async function handleToConnect() {
    if (!toPlatform) return;
    await new Promise(r => setTimeout(r, 1500)); // TODO: replace with real OAuth
    setToConnected(true);
  }
  function handleFromSelect(p: Platform) { setFromPlatform(p); setFromConnected(false); setPlaylists([]); setSelectedId(null); }
  function handleToSelect(p: Platform)   { setToPlatform(p); setToConnected(false); }

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", padding: "32px 24px 72px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 740, margin: "0 auto" }}>

        {/* ── DEV: State switcher — remove before launch ── */}
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32,
          padding: "12px 16px", background: "rgba(255,255,255,0.04)",
          borderRadius: 12, border: "1px dashed rgba(255,255,255,0.12)",
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", alignSelf: "center", marginRight: 4, fontFamily: "monospace", letterSpacing: "1px" }}>DEV</span>
          {DEV_STATES.map(s => (
            <button key={s.key} onClick={() => setDevState(s.key)} style={{
              padding: "6px 14px", borderRadius: 100, border: "none", fontSize: 12, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.15s",
              background: devState === s.key ? "#e8c547" : "rgba(255,255,255,0.08)",
              color: devState === s.key ? "#0a0a0b" : "rgba(255,255,255,0.55)",
            }}>{s.label}</button>
          ))}
        </div>

        {/* ── Back arrow ── */}
        <a href="/" style={{
          display: "inline-flex", alignItems: "center",
          color: "#e8c547", textDecoration: "none", fontSize: 28,
          marginBottom: 24, lineHeight: 1, transition: "transform 0.2s",
        }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateX(-4px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "translateX(0)")}
          aria-label="Back to home"
        >←</a>

        {/* ── Page headings ── */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: 32, fontWeight: 400, color: "#e8c547", lineHeight: 1.15, marginBottom: 2 }}>
            Welcome, stranger…
          </h1>
          <p style={{ fontFamily: "'Calligraffitti', cursive", fontSize: 18, color: "#e8c547", fontWeight: 400, lineHeight: 1.3, opacity: 0.85 }}>
            Lets move some music!
          </p>
        </div>

        {/* ── Main card ── */}
        <div style={{
          background: "#131316", borderRadius: 24, padding: "36px 36px 32px",
          border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}>
          {/* Platform selector — always visible */}
          <h2 style={{ fontFamily: "'Calligraffitti', cursive", fontSize: 26, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
            Platform selector
          </h2>
          <PlatformSelector
            fromPlatform={isResultState ? "spotify" : fromPlatform}
            toPlatform={isResultState ? "youtube" : toPlatform}
            fromConnected={isResultState ? true : fromConnected}
            toConnected={isResultState ? false : toConnected}
            onFromSelect={handleFromSelect}
            onToSelect={handleToSelect}
            onFromConnect={handleFromConnect}
            onToConnect={handleToConnect}
          />

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "32px 0" }} />

          {/* ── Content switches by devState ── */}
          {(devState === "empty" || devState === "connected") && (
            <>
              <div style={{ marginBottom: 32 }}>
                <PlaylistList
                  platform={devState === "connected" ? "spotify" : fromPlatform}
                  connected={devState === "connected"}
                  playlists={devState === "connected" ? MOCK_PLAYLISTS : playlists}
                  selectedId={devState === "connected" ? "1" : selectedId}
                  onSelect={setSelectedId}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  disabled={devState !== "connected"}
                  style={{
                    width: "45%", minWidth: 200, padding: "16px 24px", borderRadius: 100, border: "none",
                    background: devState === "connected" ? "#e8c547" : "rgba(255,255,255,0.08)",
                    color: devState === "connected" ? "#0a0a0b" : "rgba(255,255,255,0.3)",
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16,
                    cursor: devState === "connected" ? "pointer" : "not-allowed",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { if (devState === "connected") { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(232,197,71,0.3)"; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >Transfer playlist</button>
              </div>
            </>
          )}

          {devState === "transferring" && <TransferringState tracks={MOCK_TRACKS} total={24} />}
          {devState === "success"      && <SuccessState />}
          {devState === "partial"      && <PartialState failedTracks={MOCK_FAILED_TRACKS} />}
          {devState === "error"        && <ErrorState />}
        </div>

      </div>
    </div>
  );
}
