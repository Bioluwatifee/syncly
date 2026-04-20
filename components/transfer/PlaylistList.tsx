"use client";

import { useState, useEffect } from "react";
import { Platform } from "@/types";

export interface PlaylistItem {
  id: string;
  name: string;
  owner: string;
  trackCount: number | null;
  imageUrl?: string;
}

interface Props {
  platform: Platform | null;
  connected: boolean;
  loading?: boolean;
  playlists: PlaylistItem[];
  selectedId: string | null;
  countLoadingId?: string | null;
  onSelect: (id: string) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  spotify: "Spotify",
  youtube: "YouTube Music",
  apple: "Apple Music",
};

export default function PlaylistList({
  platform,
  connected,
  loading = false,
  playlists,
  selectedId,
  countLoadingId = null,
  onSelect,
}: Props) {
  const platformLabel = platform ? PLATFORM_LABELS[platform] : "";
  const isLoading = connected && loading;
  const hasPlaylists = connected && playlists.length > 0;
  const showNoPlatformSelectedState = !platform;
  const showConnectedButEmptyState = Boolean(platform && connected && playlists.length === 0);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "baseline",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 6 : 0,
          marginBottom: 20,
        }}
      >
        <h2 style={{
          fontFamily: "'Calligraffitti', cursive",
          fontSize: isMobile ? 20 : 28,
          fontWeight: 400,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.5px",
        }}>
          {connected && platform ? `${platformLabel} playlists...` : "Your Playlists"}
        </h2>
        {hasPlaylists && (
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
            We found {playlists.length} playlists...
          </span>
        )}
      </div>

      {/* Outer container — fixed height, clips overflow */}
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        overflow: "hidden",
        minHeight: hasPlaylists ? "auto" : 320,
        maxHeight: 360,
        display: "flex",
        flexDirection: "column",
        justifyContent: hasPlaylists ? "flex-start" : "center",
        alignItems: hasPlaylists ? "stretch" : "center",
      }}>

        {isLoading ? (
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", fontStyle: "italic" }}>
            Fetching your playlists...
          </p>
        ) : !hasPlaylists ? (
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
            {showNoPlatformSelectedState
              ? "Your playlists will appear here..."
              : showConnectedButEmptyState
                ? "Oops, no playlists yet. Create one and it'll appear here."
                : "Connect to view your playlists..."}
          </p>
        ) : (
          <>
            {/* Webkit scrollbar styles */}
            <style>{`
              .playlist-scroll::-webkit-scrollbar { width: 4px; }
              .playlist-scroll::-webkit-scrollbar-track { background: transparent; }
              .playlist-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 100px; }
              .playlist-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
            `}</style>

            <div
              className="playlist-scroll"
              style={{
                overflowY: "auto",
                flex: 1,
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(255,255,255,0.12) transparent",
              } as React.CSSProperties}
            >
              {playlists.map((pl, i) => {
                const isSelected = pl.id === selectedId;
                const countLabel =
                  pl.trackCount === null
                    ? (isSelected && countLoadingId === pl.id ? "Loading..." : "-")
                    : `${pl.trackCount} songs`;
                return (
                  <div
                    key={pl.id}
                    onClick={() => onSelect(pl.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: isMobile ? 12 : 16,
                      padding: isMobile ? "12px 14px" : "14px 20px",
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
                      width: isMobile ? 46 : 52, height: isMobile ? 46 : 52, borderRadius: 8, flexShrink: 0,
                      overflow: "hidden", background: "rgba(255,255,255,0.08)",
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
                        fontSize: isMobile ? 14 : 15, fontWeight: 600, color: "#fff",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        marginBottom: 3,
                      }}>
                        {pl.name}
                      </div>
                      <div style={{ fontSize: isMobile ? 12 : 13, color: "rgba(255,255,255,0.4)" }}>
                        {pl.owner}
                      </div>
                    </div>

                    {/* Track count */}
                    <div style={{ fontSize: isMobile ? 12 : 13, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                      {countLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
