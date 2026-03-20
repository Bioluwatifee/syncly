"use client";

// ─── DemoSection ──────────────────────────────────────────────────────────────
// Static preview of the transfer experience, styled identically to /transfer.
// No interactivity — purely visual.

// ─── Icons ───────────────────────────────────────────────────────────────────

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

const CheckIcon = () => (
  <div style={{
    width: 26, height: 26, borderRadius: "50%", background: "#1ed760",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </div>
);

// ─── Static platform input (connected state) ──────────────────────────────────

interface StaticPlatformInputProps {
  icon: React.ReactNode;
  label: string;
  connectedBg: string;
  connectedColor: string;
}

function StaticPlatformInput({ icon, label, connectedBg, connectedColor }: StaticPlatformInputProps) {
  return (
    <div className="demo-platform-side" style={{
      flex: 1,
      display: "flex", alignItems: "center", height: 52,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 14,
      userSelect: "none",
    }}>
      {/* Platform label */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 10,
        padding: "0 14px", height: "100%", minWidth: "fit-content",
      }}>
        <span style={{ flexShrink: 0 }}>{icon}</span>
        <span className="platform-label-text" style={{ fontSize: 15, fontWeight: 600, color: "#fff", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </div>

      {/* Vertical divider */}
      <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

      {/* Connected ✓ button */}
      <div className="connected-btn" style={{
        height: "100%", padding: "0 18px",
        background: connectedBg, color: connectedColor,
        fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
        whiteSpace: "nowrap", flexShrink: 0,
        borderRadius: "0 13px 13px 0",
        display: "flex", alignItems: "center",
        overflow: "hidden",
      }}>
        Connected ✓
      </div>
    </div>
  );
}

// ─── Mock tracks ─────────────────────────────────────────────────────────────

const DEMO_TRACKS = [
  {
    name: "Green mirage",
    artist: "Stanye",
    imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=80&h=80&fit=crop",
  },
  {
    name: "Moments of nostalgia",
    artist: "Elara",
    imageUrl: "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=80&h=80&fit=crop",
  },
  {
    name: "Chasing the moon",
    artist: "Ryder",
    imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=80&h=80&fit=crop",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DemoSection() {
  return (
    <section id="how" className="demo-section-tsx" style={{
      padding: "120px 60px",
      maxWidth: 1100,
      margin: "0 auto",
      fontFamily: "'DM Sans', sans-serif",
      boxSizing: "border-box",
    }}>
      <style>{`
        @media (max-width: 768px) {
          .demo-section-tsx {
            padding: 64px 20px 48px !important;
          }
          .demo-section-tsx h2 {
            font-size: clamp(26px, 7vw, 38px) !important;
            letter-spacing: -1px !important;
          }
          .demo-section-tsx .demo-subtitle {
            font-size: 15px !important;
            margin-bottom: 36px !important;
            max-width: 100% !important;
          }
          .demo-section-tsx .demo-card {
            padding: 22px 16px 20px !important;
            border-radius: 18px !important;
          }
          .demo-section-tsx .platform-row-inner {
            gap: 8px !important;
          }
          .demo-section-tsx .swap-icon-wrap {
            width: 32px !important;
            height: 32px !important;
          }
          .demo-section-tsx .platform-label-text {
            font-size: 13px !important;
          }
          .demo-section-tsx .connected-btn {
            padding: 0 12px !important;
            font-size: 12px !important;
          }
          .demo-section-tsx .playlist-card {
            padding: 12px 14px !important;
            gap: 12px !important;
          }
          .demo-section-tsx .playlist-artwork {
            width: 44px !important;
            height: 44px !important;
          }
          .demo-section-tsx .track-row {
            padding: 11px 14px !important;
            gap: 10px !important;
          }
          .demo-section-tsx .track-artwork {
            width: 36px !important;
            height: 36px !important;
          }
          .demo-section-tsx .transfer-pill {
            padding: 14px 32px !important;
            font-size: 14px !important;
          }
          .demo-section-tsx .playlists-header {
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
        }

        @media (max-width: 390px) {
          .demo-section-tsx {
            padding: 48px 14px 40px !important;
          }
          .demo-section-tsx .demo-card {
            padding: 18px 12px 16px !important;
          }
        }
      `}</style>

      {/* ── Outer section frame — preserved exactly ── */}
      <div style={{
        fontSize: 12, color: "#e8c547", letterSpacing: "2px",
        textTransform: "uppercase", fontWeight: 500, marginBottom: 16,
      }}>
        The transfer experience
      </div>

      <h2 style={{
        fontFamily: "'Aleo', serif",
        fontSize: "clamp(36px, 4vw, 56px)",
        fontWeight: 700,
        letterSpacing: "-1.5px",
        lineHeight: 1.1,
        marginBottom: 16,
        color: "#fff",
      }}>
        Built for music lovers,<br />not for engineers.
      </h2>

      <p className="demo-subtitle" style={{
        color: "rgba(255,255,255,0.45)",
        fontSize: 16,
        lineHeight: 1.65,
        maxWidth: 480,
        marginBottom: 60,
      }}>
        A clean, transparent transfer flow. See exactly what matched, what didn&apos;t, and why.
      </p>

      {/* ── Inner mockup — /transfer page styles ── */}
      <div className="demo-card" style={{
        background: "#131316",
        borderRadius: 24,
        padding: "36px 36px 32px",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        position: "relative",
      }}>

        {/* Gold top-edge shimmer — matches original transfer-card::before */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(232,197,71,0.5), transparent)",
        }} />

        {/* Platform selector label */}
        <h3 style={{
          fontFamily: "'Calligraffitti', cursive",
          fontSize: 22, fontWeight: 400,
          color: "rgba(255,255,255,0.5)",
          marginBottom: 20, letterSpacing: "0.3px",
        }}>
          Platform selector
        </h3>

        {/* From / To labels */}
        <div className="demo-platform-labels" style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px" }}>From</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.3px" }}>To</span>
        </div>

        {/* Platform inputs */}
        <div className="platform-row-inner" style={{ display: "flex", alignItems: "center", gap: 16 }}>

          {/* Spotify — green Connected ✓ */}
          <StaticPlatformInput
            icon={<SpotifyIcon />}
            label="Spotify"
            connectedBg="rgba(30,215,96,0.15)"
            connectedColor="#1ed760"
          />

          {/* Swap icon */}
          <div className="swap-icon-wrap" style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3L4 7l4 4"/><path d="M4 7h16"/>
              <path d="M16 21l4-4-4-4"/><path d="M20 17H4"/>
            </svg>
          </div>

          {/* YouTube Music — red Connected ✓ */}
          <StaticPlatformInput
            icon={<YouTubeIcon />}
            label="YouTube Music"
            connectedBg="rgba(255,68,68,0.15)"
            connectedColor="#ff4444"
          />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "28px 0" }} />

        {/* Playlists header */}
        <div className="playlists-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <h3 style={{
            fontFamily: "'Calligraffitti', cursive",
            fontSize: 24, fontWeight: 400,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.5px", margin: 0,
          }}>
            Spotify playlists...
          </h3>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
            We found 4 playlists...
          </span>
        </div>

        {/* Selected playlist — yellow border */}
        <div className="playlist-card" style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "14px 20px",
          border: "1px solid rgba(232,197,71,0.7)",
          borderRadius: 12,
          background: "rgba(232,197,71,0.04)",
          marginBottom: 4,
        }}>
          <div className="playlist-artwork" style={{
            width: 52, height: 52, borderRadius: 8, flexShrink: 0,
            overflow: "hidden", background: "rgba(255,255,255,0.08)",
          }}>
            <img
              src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop"
              alt="This feels like it"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 3 }}>
              This feels like it
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Stanye</div>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>22 songs</div>
        </div>

        {/* Track list — 3 songs with checkmarks */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, overflow: "hidden",
          marginBottom: 28,
        }}>
          {DEMO_TRACKS.map((track, i) => (
            <div key={track.name} className="track-row" style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "13px 20px",
              borderBottom: i < DEMO_TRACKS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", width: 18, textAlign: "right", flexShrink: 0 }}>
                {i + 1}.
              </span>
              <div className="track-artwork" style={{
                width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                overflow: "hidden", background: "rgba(255,255,255,0.08)",
              }}>
                <img
                  src={track.imageUrl}
                  alt={track.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: "#fff",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2,
                }}>
                  {track.name}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{track.artist}</div>
              </div>
              <CheckIcon />
            </div>
          ))}
        </div>

        {/* Transfer button — yellow pill, centered */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="transfer-pill" style={{
            padding: "16px 48px", borderRadius: 100,
            background: "#e8c547", color: "#0a0a0b",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
            fontSize: 16, letterSpacing: "0.2px", userSelect: "none",
          }}>
            Transfer playlist
          </div>
        </div>

      </div>
    </section>
  );
}
