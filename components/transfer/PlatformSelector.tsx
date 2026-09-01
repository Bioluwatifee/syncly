"use client";

import { useState, useRef, useEffect } from "react";
import { Platform } from "@/types";

interface PlatformOption {
  id: Platform;
  label: string;
  inputLogo: React.ReactNode;
  dropdownLogo: React.ReactNode;
  comingSoon?: boolean;
}

const SpotifyDropdownLogo = () => (
  <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
    <img
      src="/platform-logos/spotify-logo.png"
      alt="Spotify"
      style={{ height: 28, width: "auto", display: "block" }}
    />
  </div>
);

const SpotifyInputLogo = () => (
  <img
    src="/platform-logos/spotify-logo.png"
    alt="Spotify"
    style={{ height: 26, width: "auto", display: "block" }}
  />
);

const YouTubeInputLogo = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
    <img
      src="/platform-logos/youtube-icon-official.png"
      alt="YouTube Music"
      style={{ height: 24, width: "auto", display: "block", flexShrink: 0 }}
    />
    <span style={{
      fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    }}>
      YouTube Music
    </span>
  </div>
);

const AppleInputLogo = () => (
  <img
    src="/platform-logos/apple-music-logo.png"
    alt="Apple Music"
    style={{ height: 18, width: "auto", display: "block", opacity: 0.9 }}
  />
);

const YouTubeDropdownLogo = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
    <img
      src="/platform-logos/youtube-icon-official.png"
      alt="YouTube Music"
      style={{ height: 26, width: "auto", display: "block", flexShrink: 0 }}
    />
    <span style={{
      fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff",
      whiteSpace: "nowrap",
    }}>
      YouTube Music
    </span>
  </div>
);

const AppleDropdownLogo = () => (
  <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
    <img
      src="/platform-logos/apple-music-logo.png"
      alt="Apple Music"
      style={{ height: 20, width: "auto", display: "block", opacity: 0.9 }}
    />
  </div>
);

const PLATFORMS: PlatformOption[] = [
  { id: "spotify",  label: "Spotify",       inputLogo: <SpotifyInputLogo />, dropdownLogo: <SpotifyDropdownLogo /> },
  { id: "youtube",  label: "YouTube Music", inputLogo: <YouTubeInputLogo />, dropdownLogo: <YouTubeDropdownLogo /> },
  { id: "apple",    label: "Apple Music",   inputLogo: <AppleInputLogo />, dropdownLogo: <AppleDropdownLogo />, comingSoon: true },
];

interface SideProps {
  label: "From" | "To";
  selected: Platform | null;
  connected: boolean;
  onSelect: (p: Platform) => void;
  onConnect: () => Promise<void> | void;
  onDisconnect?: () => void;
  isMobile: boolean;
}

function PlatformSide({ label, selected, connected, onSelect, onConnect, onDisconnect, isMobile }: SideProps) {
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
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

  function handleActionButton() {
    if (!selected || connecting) return;
    if (connected) {
      onDisconnect?.();
      return;
    }
    void handleConnect();
  }

  const selectedPlatform = PLATFORMS.find(p => p.id === selected);

  const brandBg = selected === "spotify" ? "#1ed760"
    : selected === "youtube" ? "#111"
    : selected === "apple" ? "#fc3c44"
    : "transparent";

  const connectedBg = selected === "spotify" ? "rgba(30,215,96,0.15)"
    : selected === "youtube" ? "rgba(255,0,0,0.15)"
    : "rgba(252,60,68,0.15)";

  const connectedColor = selected === "spotify" ? "#1ed760"
    : selected === "youtube" ? "#FF0000"
    : "#fc3c44";

  const disconnectHoverBg = "rgba(232,95,71,0.22)";
  const btnBg = !selected
    ? "rgba(255,255,255,0.03)"
    : connected
      ? (isButtonHovered && onDisconnect ? disconnectHoverBg : connectedBg)
      : brandBg;
  const btnColor = !selected ? "rgba(255,255,255,0.38)"
    : connected
      ? (isButtonHovered && onDisconnect ? "#e85f47" : connectedColor)
    : selected === "youtube" ? "#fff" : "#000";
  const showingConnectedState = connected && !(isButtonHovered && onDisconnect);
  const btnLabel = connecting
    ? "Connecting..."
    : connected
      ? (isButtonHovered && onDisconnect ? "Disconnect" : "Connected")
      : "Connect";
  const btnDisabled = !selected || connecting || (connected && !onDisconnect);
  const buttonWidth = connected
    ? (isMobile ? 108 : undefined)
    : (isMobile ? 80 : undefined);

  return (
    <div className="platform-side" style={{ position: "relative" }} ref={ref}>
      <div
        className="platform-side-mobile-label"
        style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px", marginBottom: 8 }}
      >
        {label}
      </div>

      {/* Unified input + button container */}
      <div
        className="platform-side-box"
        style={{
          display: "flex", alignItems: "center",
          width: "100%",
          maxWidth: isMobile ? "100%" : 324,
          height: 40,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          padding: 4,
          gap: 4,
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
            padding: "0 12px", height: "100%",
            cursor: connected ? "default" : "pointer", minWidth: 0,
            borderRadius: 6,
          }}
        >
          <div className="platform-label-inner" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
            {selectedPlatform ? (
              <>
                <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{selectedPlatform.inputLogo}</span>
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

        {/* Connect button */}
        <button
          onClick={handleActionButton}
          disabled={btnDisabled}
          style={{
            background: btnBg, color: btnColor,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14,
            cursor: btnDisabled ? "default" : "pointer",
            opacity: 1,
            transition: "background 0.25s, color 0.25s",
            whiteSpace: "nowrap", flexShrink: 0,
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center", gap: connecting ? 7 : 0,
            width: buttonWidth,
            padding: isMobile ? "0 10px" : "0 13.5px",
            height: isMobile ? 30 : 32,
            minHeight: 0,
            minWidth: isMobile ? buttonWidth : undefined,
            maxWidth: isMobile ? buttonWidth : undefined,
            border: !selected ? "1px solid rgba(255,255,255,0.08)" : "none",
          }}
          onMouseEnter={e => {
            setIsButtonHovered(true);
            if (selected && !connected && !connecting) {
              (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)";
            }
          }}
          onMouseLeave={e => {
            setIsButtonHovered(false);
            (e.currentTarget as HTMLElement).style.filter = "none";
          }}
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
          background: "#222228",
          borderRadius: 16, overflow: "hidden", zIndex: 50,
          boxShadow: "0 10px 28px rgba(0,0,0,0.42), 0 2px 8px rgba(0,0,0,0.26)",
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
              <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                {p.dropdownLogo}
              </div>
              {p.comingSoon && (
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.35)",
                    fontStyle: "italic",
                    alignSelf: "flex-end",
                    lineHeight: 1,
                    paddingBottom: 2,
                  }}
                >
                  Coming soon...
                </span>
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
  onFromDisconnect?: () => void;
  onToDisconnect?: () => void;
  onSwap?: () => void;
}

export default function PlatformSelector({
  fromPlatform, toPlatform,
  fromConnected, toConnected,
  onFromSelect, onToSelect,
  onFromConnect, onToConnect,
  onFromDisconnect, onToDisconnect,
  onSwap,
}: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler as EventListener);
      return () => mq.removeEventListener("change", handler as EventListener);
    }

    // Safari fallback (older MediaQueryList API)
    const legacyHandler = (event: MediaQueryListEvent) => handler(event);
    mq.addListener(legacyHandler);
    return () => mq.removeListener(legacyHandler);
  }, []);

  return (
    <div>
      {/* From / To labels — hidden on mobile via CSS */}
      <div
        className="platform-selector-labels"
        style={{
          width: "100%",
        }}
      >
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px" }}>From</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px" }}>To</span>
      </div>

      {/* Row on desktop, column on mobile — driven by CSS not JS */}
      <div
        className="platform-selector-row"
        style={{
          display: "flex",
          width: "100%",
        }}
      >
        <PlatformSide
          label="From"
          selected={fromPlatform}
          connected={fromConnected}
          onSelect={onFromSelect}
          onConnect={onFromConnect}
          onDisconnect={onFromDisconnect}
          isMobile={isMobile}
        />

        {/* Swap icon — rotates 90° on mobile to act as a down-arrow between rows */}
        <div
          className="platform-swap-wrap"
          style={{
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <div
            className="swap-icon-circle"
            role="button"
            aria-label="Swap source and destination platforms"
            onClick={() => onSwap?.()}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "1.5px solid rgba(255,255,255,0.25)",
              background: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              transition: "border-color 0.2s, transform 0.3s",
              transform: "rotate(0deg)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,197,71,0.6)";
              if (!isMobile) (e.currentTarget as HTMLElement).style.transform = "rotate(180deg)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.25)";
              (e.currentTarget as HTMLElement).style.transform = "rotate(0deg)";
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
          onDisconnect={onToDisconnect}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
