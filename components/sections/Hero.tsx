"use client";

const SpotifyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#1ed760">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#fc3c44">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4444">
    <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
  </svg>
);

export default function Hero() {
  const platforms = [
    { key: "spotify", label: "Spotify",       color: "#1ed760", icon: <SpotifyIcon /> },
    { key: "apple",   label: "Apple Music",   color: "#fc3c44", icon: <AppleIcon /> },
    { key: "youtube", label: "YouTube Music", color: "#ff4444", icon: <YouTubeIcon /> },
  ];

  return (
    <section className="hero" style={{
      minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center",
      padding: "140px 60px 80px",
      position: "relative", overflow: "hidden",
      isolation: "isolate",
    }}>
      {/* Background orbs */}
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", filter: "blur(120px)", background: "radial-gradient(circle, rgba(232,197,71,0.12) 0%, transparent 70%)", top: -200, left: -200, animation: "drift 12s ease-in-out infinite alternate", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", filter: "blur(120px)", background: "radial-gradient(circle, rgba(232,95,71,0.1) 0%, transparent 70%)", bottom: -100, right: -100, animation: "drift 9s ease-in-out infinite alternate-reverse", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", filter: "blur(120px)", background: "radial-gradient(circle, rgba(30,215,96,0.08) 0%, transparent 70%)", top: "50%", left: "60%", animation: "drift 15s ease-in-out infinite alternate", pointerEvents: "none" }} />

      {/* Vinyl */}
      <div style={{ position: "absolute", right: -80, top: "50%", transform: "translateY(-50%)", opacity: 0.15, pointerEvents: "none" }}>
        <div style={{
          width: 400, height: 400, borderRadius: "50%",
          background: "conic-gradient(from 0deg, #1a1a1a 0deg, #2a2a2a 5deg, #1a1a1a 10deg, #252525 15deg, #1a1a1a 20deg, #2a2a2a 25deg, #1a1a1a 30deg, #252525 35deg, #1a1a1a 40deg)",
          animation: "spin 8s linear infinite",
          position: "relative",
        }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 80, height: 80, background: "#1a1a1a", borderRadius: "50%", border: "2px solid #333" }} />
        </div>
      </div>

      {/* Badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "rgba(232,197,71,0.08)", border: "1px solid rgba(232,197,71,0.2)",
        borderRadius: 100, padding: "6px 16px",
        fontSize: 12, fontWeight: 500, color: "var(--accent)",
        letterSpacing: 1, textTransform: "uppercase",
        marginBottom: 32, animation: "fadeUp 0.8s ease both",
      }}>
        <div style={{ width: 6, height: 6, background: "var(--accent)", borderRadius: "50%", animation: "pulse 2s ease-in-out infinite" }} />
        Building in public
      </div>

      {/* Headline */}
      <h1 style={{
        fontFamily: "'Aleo', serif",
        fontSize: "clamp(52px, 7vw, 96px)",
        fontWeight: 700, lineHeight: 1.0,
        letterSpacing: -3, maxWidth: 800,
        marginBottom: 24, animation: "fadeUp 0.8s 0.1s ease both",
      }}>
        Your music,<br />
        <em style={{ fontStyle: "italic", color: "var(--accent)" }}>wherever</em> you go.
      </h1>

      {/* Subtext */}
      <p className="hero-sub" style={{
        fontSize: 18, color: "var(--muted)", maxWidth: 480,
        lineHeight: 1.65, marginBottom: 48, fontWeight: 300,
        animation: "fadeUp 0.8s 0.2s ease both",
      }}>
        Move entire playlists between Spotify, Apple Music, and YouTube Music in seconds. No lost songs. No starting over.
      </p>

      {/* Actions */}
      <div className="hero-actions" style={{ display: "flex", gap: 16, alignItems: "center", animation: "fadeUp 0.8s 0.3s ease both" }}>
        <a
          href="https://tally.so/r/442xBY"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{
            background: "var(--accent)", color: "#0a0a0b",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 16,
            padding: "16px 36px", borderRadius: 100,
            textDecoration: "none", display: "inline-block",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 40px rgba(232,197,71,0.3)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
        >
          Get Early Access →
        </a>
        <button
          onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
          className="btn-ghost"
          style={{
            background: "transparent", color: "var(--muted)",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 15,
            padding: "16px 24px", borderRadius: 100,
            border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer",
            transition: "color 0.2s, border-color 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--muted)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
        >
          See how it works
        </button>
      </div>

      {/* Platform pills — "Works with" on top, pills on one row below */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 10, marginTop: 64, animation: "fadeUp 0.8s 0.4s ease both",
      }}>
        <span style={{
          fontSize: 11, color: "var(--muted)", letterSpacing: "1.5px",
          textTransform: "uppercase", fontWeight: 500,
        }}>Works with</span>

        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          flexWrap: "nowrap",
        }}>
          {platforms.map(p => (
            <div key={p.key} className="platform-pill" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 13px", background: "var(--surface)",
              border: `1px solid rgba(255,255,255,0.07)`,
              borderRadius: 100, fontSize: 12, color: "var(--text)",
              transition: "border-color 0.2s, transform 0.2s",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = p.color; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              {p.icon}
              {p.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
