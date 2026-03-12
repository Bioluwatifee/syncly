"use client";

import { useState } from "react";
import { Platform } from "@/types";
import PlatformSelector from "@/components/transfer/PlatformSelector";
import PlaylistList, { PlaylistItem } from "@/components/transfer/PlaylistList";

// ─── Mock playlists for demo/dev ─────────────────────────────────────────────
// Replace with real API call once Spotify OAuth is wired up
const MOCK_PLAYLISTS: PlaylistItem[] = [
  { id: "1", name: "This feels like it", owner: "Stanye", trackCount: 22, imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop" },
  { id: "2", name: "Green mirage",        owner: "Stanye", trackCount: 22, imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=100&h=100&fit=crop" },
  { id: "3", name: "Moments of nostalgia",owner: "Elara",  trackCount: 15, imageUrl: "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=100&h=100&fit=crop" },
  { id: "4", name: "Chasing the moon",    owner: "Ryder",  trackCount: 10, imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=100&h=100&fit=crop" },
];

export default function TransferPage() {
  const [fromPlatform, setFromPlatform] = useState<Platform | null>(null);
  const [toPlatform,   setToPlatform]   = useState<Platform | null>(null);
  const [fromConnected, setFromConnected] = useState(false);
  const [toConnected,   setToConnected]   = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const canTransfer = fromConnected && toConnected && selectedPlaylistId !== null;

  function handleFromConnect() {
    if (!fromPlatform) return;
    setFromConnected(true);
    // TODO: Replace with real OAuth redirect
    // For now load mock data
    setPlaylists(MOCK_PLAYLISTS);
    setSelectedPlaylistId(null);
  }

  function handleToConnect() {
    if (!toPlatform) return;
    setToConnected(true);
    // TODO: Replace with real OAuth redirect
  }

  function handleFromSelect(p: Platform) {
    setFromPlatform(p);
    setFromConnected(false);
    setPlaylists([]);
    setSelectedPlaylistId(null);
  }

  function handleToSelect(p: Platform) {
    setToPlatform(p);
    setToConnected(false);
  }

  async function handleTransfer() {
    if (!canTransfer) return;
    setIsTransferring(true);
    // TODO: Call /api/transfer with fromPlatform, toPlatform, selectedPlaylistId
    await new Promise(r => setTimeout(r, 2000)); // placeholder
    setIsTransferring(false);
  }

  return (
      <div style={{
        minHeight: "100vh",
        background: "#0f0f0f",
        padding: "72px 24px",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>

          {/* ── Page heading ── */}
          <div style={{ marginBottom: 40 }}>
            <h1 style={{
              fontFamily: "'Calligraffitti', cursive",
              fontSize: 32,
              fontWeight: 400,
              color: "#e8c547",
              lineHeight: 1.15,
              marginBottom: 2,
              letterSpacing: "0.5px",
            }}>
              Welcome, stranger…
            </h1>
            <p style={{
              fontFamily: "'Calligraffitti', cursive",
              fontSize: 18,
              color: "#e8c547",
              fontWeight: 400,
              lineHeight: 1.3,
              opacity: 0.85,
              letterSpacing: "0.3px",
            }}>
              Lets move some music!
            </p>
          </div>

          {/* ── Main card ── */}
          <div style={{
            background: "#131316",
            borderRadius: 24,
            padding: "36px 36px 32px",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          }}>

            {/* Platform selector section */}
            <div style={{ marginBottom: 0 }}>
              <h2 style={{
                fontFamily: "'Calligraffitti', cursive",
                fontSize: 26,
                fontWeight: 400,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 24,
                letterSpacing: "0.3px",
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
              />
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "32px 0" }} />

            {/* Playlist list section */}
            <div style={{ marginBottom: 32 }}>
              <PlaylistList
                platform={fromPlatform}
                connected={fromConnected}
                playlists={playlists}
                selectedId={selectedPlaylistId}
                onSelect={setSelectedPlaylistId}
              />
            </div>

            {/* Transfer button — centered pill, ~45% width */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleTransfer}
                disabled={!canTransfer || isTransferring}
                style={{
                  width: "45%",
                  minWidth: 200,
                  padding: "16px 24px",
                  borderRadius: 100,
                  border: "none",
                  background: canTransfer ? "#e8c547" : "rgba(255,255,255,0.08)",
                  color: canTransfer ? "#0a0a0b" : "rgba(255,255,255,0.3)",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: canTransfer ? "pointer" : "not-allowed",
                  transition: "background 0.3s, color 0.3s, transform 0.15s, box-shadow 0.3s",
                  letterSpacing: "0.2px",
                }}
                onMouseEnter={e => { if (canTransfer) { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(232,197,71,0.3)"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                {isTransferring ? "Transferring…" : "Transfer playlist"}
              </button>
            </div>
          </div>

        </div>
      </div>
  );
}
