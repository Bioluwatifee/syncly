"use client";

export default function Hero() {
  const platforms = [
    { key: "spotify", label: "Spotify", color: "#1ed760" },
    { key: "apple",   label: "Apple Music", color: "#fc3c44" },
    { key: "youtube", label: "YouTube Music", color: "#ff4444" },
  ];

  return (
    <section style={{
      minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center",
      padding: "140px 60px 80px",
      position: "relative", overflow: "hidden",
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

      {/* Platform pills */}
      <div style={{ display: "flex", gap: 12, marginTop: 64, animation: "fadeUp 0.8s 0.4s ease both", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: 12, color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase", marginRight: 4 }}>Works with</span>
        {platforms.map(p => (
          <div key={p.key} className="platform-pill" style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 16px", background: "var(--surface)",
            border: `1px solid rgba(255,255,255,0.07)`,
            borderRadius: 100, fontSize: 13, color: "var(--text)",
            transition: "border-color 0.2s, transform 0.2s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = p.color; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
            {p.label}
          </div>
        ))}
      </div>
    </section>
  );
}
