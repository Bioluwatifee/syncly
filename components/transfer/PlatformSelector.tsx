"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
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
  onConnect: () => Promise<void> | void;
  isMobile: boolean;
}

function PlatformSide({ label, selected, connected, onSelect, onConnect, isMobile }: SideProps) {
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setConnecting(false); }, [selected]);

  async function handleConnect() {
    if (!selected || connected || connecting) return;
    setConnecting(true);
    await onConnect();
    setConnecting(false);
  }

  const selectedPlatform = PLATFORMS.find(p => p.id === selected);

  const brandBg = selected === "spotify" ? "#1ed760"
    : selected === "youtube" ? "#111"
    : selected === "apple" ? "#fc3c44"
    : "transparent";

  const connectedBg = selected === "spotify" ? "rgba(30,215,96,0.15)"
    : selected === "youtube" ? "rgba(255,68,68,0.15)"
    : "rgba(252,60,68,0.15)";

  const connectedColor = selected === "spotify" ? "#1ed760"
    : selected === "youtube" ? "#ff4444"
    : "#fc3c44";

  const btnBg    = !selected ? "transparent" : connected ? connectedBg : brandBg;
  const btnColor = !selected ? "rgba(255,255,255,0.35)"
    : connected ? connectedColor
    : selected === "youtube" ? "#fff" : "#000";
  const btnLabel = connecting ? "Connecting..." : connected ? "Connected ✓" : "Connect";
  const btnDisabled = !selected || connected || connecting;

  return (
    <div className="platform-side" style={{ position: "relative" }} ref={ref}>
      {/* From/To label — shown inline above input on mobile */}
      {isMobile && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px", marginBottom: 8 }}>
          {label}
        </div>
      )}

      {/* Unified input + button container */}
      <div
        style={{
          display: "flex", alignItems: "center", height: isMobile ? 56 : 52,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14, overflow: "hidden",
          transition: "border-color 0.2s", userSelect: "none",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
      >
        {/* Dropdown trigger */}
        <div
          onClick={() => !connected && setOpen(o => !o)}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 14px", height: "100%",
            cursor: connected ? "default" : "pointer", minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
            {selectedPlatform ? (
              <>
                <span style={{ flexShrink: 0 }}>{selectedPlatform.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selectedPlatform.label}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                Select platform...
              </span>
            )}
          </div>
          {!connected && (
            <svg style={{ flexShrink: 0, marginLeft: 8 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>

        {/* Vertical divider */}
        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={btnDisabled}
          style={{
            height: "100%", padding: isMobile ? "0 16px" : "0 18px", border: "none",
            background: btnBg, color: btnColor,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
            cursor: btnDisabled ? "default" : "pointer",
            opacity: !selected ? 0.4 : 1,
            transition: "background 0.25s, color 0.25s",
            whiteSpace: "nowrap", flexShrink: 0,
            borderRadius: "0 13px 13px 0",
            display: "flex", alignItems: "center", gap: 7,
            minWidth: isMobile ? 88 : undefined,
          }}
          onMouseEnter={e => { if (selected && !connected && !connecting) (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
        >
          {connecting && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          {btnLabel}
        </button>
      </div>

      {/* Dropdown menu — full width */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)",
          left: 0, right: 0,
          background: "#222228", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16, overflow: "hidden", zIndex: 50,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}>
          {PLATFORMS.map(p => (
            <div
              key={p.id}
              onClick={() => { if (!p.comingSoon) { onSelect(p.id); setOpen(false); } }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: isMobile ? "16px 20px" : "14px 20px",
                cursor: p.comingSoon ? "default" : "pointer",
                transition: "background 0.15s", opacity: p.comingSoon ? 0.5 : 1,
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  onFromConnect: () => Promise<void> | void;
  onToConnect: () => Promise<void> | void;
}

export default function PlatformSelector({
  fromPlatform, toPlatform,
  fromConnected, toConnected,
  onFromSelect, onToSelect,
  onFromConnect, onToConnect,
}: Props) {
  // useLayoutEffect fires synchronously before paint — eliminates the
  // desktop→mobile flash that useEffect causes on narrow viewports.
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div>
      {/* CSS handles mobile layout — no JS timing dependency */}
      <style>{`
        .platform-selector-labels { display: flex; justify-content: space-between; margin-bottom: 14px; }
        .platform-selector-row    { display: flex; flex-direction: row; align-items: center; gap: 16px; }
        .platform-side            { flex: 1; }
        @media (max-width: 768px) {
          .platform-selector-labels { display: none; }
          .platform-selector-row    { flex-direction: column !important; align-items: stretch !important; width: 100% !important; }
          .platform-selector-row > * { width: 100% !important; }
          .platform-side            { flex: none !important; width: 100% !important; }
        }
      `}</style>

      {/* From / To labels — hidden on mobile via CSS */}
      <div className="platform-selector-labels">
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px" }}>From</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px" }}>To</span>
      </div>

      {/* Row on desktop, column on mobile — driven by CSS not JS */}
      <div className="platform-selector-row">
        <PlatformSide
          label="From"
          selected={fromPlatform}
          connected={fromConnected}
          onSelect={onFromSelect}
          onConnect={onFromConnect}
          isMobile={isMobile}
        />

        {/* Swap icon — rotates 90° on mobile to act as a down-arrow between rows */}
        <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: "50%",
              border: "1.5px solid rgba(255,255,255,0.25)",
              background: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              transition: "border-color 0.2s, transform 0.3s",
              transform: isMobile ? "rotate(90deg)" : "rotate(0deg)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,197,71,0.6)";
              if (!isMobile) (e.currentTarget as HTMLElement).style.transform = "rotate(180deg)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.25)";
              (e.currentTarget as HTMLElement).style.transform = isMobile ? "rotate(90deg)" : "rotate(0deg)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3L4 7l4 4" />
              <path d="M4 7h16" />
              <path d="M16 21l4-4-4-4" />
              <path d="M20 17H4" />
            </svg>
          </div>
        </div>

        <PlatformSide
          label="To"
          selected={toPlatform}
          connected={toConnected}
          onSelect={onToSelect}
          onConnect={onToConnect}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
