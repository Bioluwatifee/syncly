"use client";

import { useState, useRef, useEffect } from "react";
import { Platform } from "@/types";

interface PlatformOption {
  id: Platform;
  label: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

const SpotifyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1ed760">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff4444">
    <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const PLATFORMS: PlatformOption[] = [
  { id: "spotify",  label: "Spotify",       icon: <SpotifyIcon /> },
  { id: "youtube",  label: "YouTube Music", icon: <YouTubeIcon /> },
  { id: "apple",    label: "Apple Music",   icon: <AppleIcon />,  comingSoon: true },
];

interface SideProps {
  label: "From" | "To";
  selected: Platform | null;
  connected: boolean;
  onSelect: (p: Platform) => void;
  onConnect: () => void;
}

function PlatformSide({ label, selected, connected, onSelect, onConnect }: SideProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedPlatform = PLATFORMS.find(p => p.id === selected);
  const isLeft = label === "From";

  return (
    <div style={{ flex: 1, position: "relative" }} ref={ref}>
      {/* Single unified input+button container — fixed height, no wrapping */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 52,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          overflow: "hidden",
          transition: "border-color 0.2s",
          userSelect: "none",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
      >
        {/* Clickable dropdown area — fills all space left of the button */}
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            height: "100%",
            cursor: "pointer",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
            {selectedPlatform ? (
              <>
                <span style={{ flexShrink: 0 }}>{selectedPlatform.icon}</span>
                <span style={{
                  fontSize: 15, fontWeight: 600, color: "#fff",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {selectedPlatform.label}
                </span>
              </>
            ) : (
              <span style={{
                fontSize: 14, color: "rgba(255,255,255,0.35)",
                whiteSpace: "nowrap",
              }}>
                Select platform...
              </span>
            )}
          </div>
          {/* Chevron */}
          <svg style={{ flexShrink: 0, marginLeft: 8 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Vertical divider */}
        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

        {/* Connect button — filled brand color when platform selected, grey outline when not */}
        <button
          onClick={onConnect}
          disabled={!selected}
          style={{
            height: "100%",
            padding: "0 20px",
            border: "none",
            background: selected
              ? connected
                ? (selected === "spotify" ? "#1ed760" : selected === "youtube" ? "#111" : "#fc3c44")
                : (selected === "spotify" ? "#1ed760" : selected === "youtube" ? "#111" : "#fc3c44")
              : "transparent",
            color: selected
              ? (selected === "youtube" ? "#fff" : "#000")
              : "rgba(255,255,255,0.35)",
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            cursor: selected ? "pointer" : "not-allowed",
            transition: "background 0.25s, color 0.25s, opacity 0.2s",
            whiteSpace: "nowrap",
            flexShrink: 0,
            borderRadius: "0 13px 13px 0",
            opacity: selected ? 1 : 0.4,
          }}
          onMouseEnter={e => {
            if (selected && !connected) {
              (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.filter = "none";
          }}
        >
          {connected ? "Connected ✓" : "Connect"}
        </button>
      </div>

      {/* Dropdown menu */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: isLeft ? 0 : "auto",
          right: isLeft ? "auto" : 0,
          width: "100%",
          minWidth: 240,
          background: "#222228",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          overflow: "hidden",
          zIndex: 50,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}>
          {PLATFORMS.map(p => (
            <div
              key={p.id}
              onClick={() => { if (!p.comingSoon) { onSelect(p.id); setOpen(false); } }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px",
                cursor: p.comingSoon ? "default" : "pointer",
                transition: "background 0.15s",
                opacity: p.comingSoon ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!p.comingSoon) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {p.icon}
                <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{p.label}</span>
              </div>
              {p.comingSoon && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>Coming soon...</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  fromPlatform: Platform | null;
  toPlatform: Platform | null;
  fromConnected: boolean;
  toConnected: boolean;
  onFromSelect: (p: Platform) => void;
  onToSelect: (p: Platform) => void;
  onFromConnect: () => void;
  onToConnect: () => void;
}

export default function PlatformSelector({
  fromPlatform, toPlatform,
  fromConnected, toConnected,
  onFromSelect, onToSelect,
  onFromConnect, onToConnect,
}: Props) {
  return (
    <div>
      {/* Label row */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px" }}>From</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px" }}>To</span>
      </div>

      {/* Selectors row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <PlatformSide
          label="From"
          selected={fromPlatform}
          connected={fromConnected}
          onSelect={onFromSelect}
          onConnect={onFromConnect}
        />

        {/* Swap icon — outlined circle */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.25)",
          background: "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, cursor: "pointer",
          transition: "border-color 0.2s, transform 0.3s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,197,71,0.6)"; (e.currentTarget as HTMLElement).style.transform = "rotate(180deg)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.25)"; (e.currentTarget as HTMLElement).style.transform = "rotate(0deg)"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3L4 7l4 4" />
            <path d="M4 7h16" />
            <path d="M16 21l4-4-4-4" />
            <path d="M20 17H4" />
          </svg>
        </div>

        <PlatformSide
          label="To"
          selected={toPlatform}
          connected={toConnected}
          onSelect={onToSelect}
          onConnect={onToConnect}
        />
      </div>
    </div>
  );
}
