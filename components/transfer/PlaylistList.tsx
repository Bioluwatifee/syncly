"use client";

import { Platform } from "@/types";

export interface PlaylistItem {
  id: string;
  name: string;
  owner: string;
  trackCount: number;
  imageUrl?: string;
}

interface Props {
  platform: Platform | null;
  connected: boolean;
  playlists: PlaylistItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  spotify: "Spotify",
  youtube: "YouTube Music",
  apple: "Apple Music",
};

export default function PlaylistList({ platform, connected, playlists, selectedId, onSelect }: Props) {
  const platformLabel = platform ? PLATFORM_LABELS[platform] : "";

  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "'Calligraffitti', cursive",
          fontSize: 28,
          fontWeight: 400,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.5px",
        }}>
          {connected && platform ? `${platformLabel} playlists...` : "Your Playlists"}
        </h2>
        {connected && playlists.length > 0 && (
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
            We found {playlists.length} playlists...
          </span>
        )}
      </div>

      {/* Content area */}
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        overflow: "hidden",
        minHeight: connected && playlists.length > 0 ? "auto" : 320,
        display: "flex",
        flexDirection: "column",
        justifyContent: connected && playlists.length > 0 ? "flex-start" : "center",
        alignItems: connected && playlists.length > 0 ? "stretch" : "center",
      }}>
        {!connected || playlists.length === 0 ? (
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
            Your playlists will appear here...
          </p>
        ) : (
          playlists.map((pl, i) => {
            const isSelected = pl.id === selectedId;
            return (
              <div
                key={pl.id}
                onClick={() => onSelect(pl.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 20px",
                  cursor: "pointer",
                  borderBottom: i < playlists.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  border: isSelected ? "1px solid rgba(232,197,71,0.7)" : undefined,
                  borderRadius: isSelected ? 12 : 0,
                  margin: isSelected ? "2px 4px" : 0,
                  background: isSelected ? "rgba(232,197,71,0.04)" : "transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {/* Artwork */}
                <div style={{
                  width: 52, height: 52, borderRadius: 8, flexShrink: 0,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.08)",
                }}>
                  {pl.imageUrl ? (
                    <img src={pl.imageUrl} alt={pl.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #2a2a3a, #1a1a2a)" }} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 600, color: "#fff",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginBottom: 3,
                  }}>
                    {pl.name}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                    {pl.owner}
                  </div>
                </div>

                {/* Track count */}
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                  {pl.trackCount} songs
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
