"use client";

const tracks = [
  { num: 1, emoji: "🎸", name: "Blinding Lights",        artist: "The Weeknd",  matched: true },
  { num: 2, emoji: "🎹", name: "Golden Hour",            artist: "JVKE",        matched: true },
  { num: 3, emoji: "🥁", name: "Levitating (feat. DaBaby)", artist: "Dua Lipa", matched: true },
  { num: 4, emoji: "🎷", name: "Midnight Rain (Demo)",   artist: "Taylor Swift", matched: false },
];

export default function DemoSection() {
  return (
    <section id="how" style={{ padding: "120px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, marginBottom: 16 }}>
        The transfer experience
      </div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 16 }}>
        Built for music lovers,<br />not for engineers.
      </h2>
      <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.65, maxWidth: 480, marginBottom: 60 }}>
        A clean, transparent transfer flow. See exactly what matched, what didn't, and why.
      </p>

      {/* Transfer card */}
      <div style={{
        background: "var(--surface)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 24, padding: 40, position: "relative", overflow: "hidden",
      }}>
        {/* Top gradient line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--accent), transparent)", opacity: 0.5 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 13, color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>Active Transfer</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--accent)", background: "rgba(232,197,71,0.08)", padding: "4px 12px", borderRadius: 100 }}>Step 2 of 3</span>
        </div>

        {/* Platform row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
          {["Spotify", "YouTube Music"].map((name, i) => (
            <>
              {i === 1 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.07), var(--accent), rgba(255,255,255,0.07))", position: "relative" }}>
                    <span style={{ position: "absolute", right: -6, top: -9, color: "var(--accent)", fontSize: 18 }}>›</span>
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--accent)" }}>24 tracks</span>
                </div>
              )}
              <div key={name} style={{ flex: 1, background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>{i === 0 ? "From" : "To"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 500 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: i === 0 ? "rgba(30,215,96,0.12)" : "rgba(255,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    {i === 0 ? "🎵" : "▶"}
                  </div>
                  {name}
                </div>
              </div>
            </>
          ))}
        </div>

        {/* Playlist label */}
        <div style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Late Night Drives 🌙</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>24 tracks · Spotify</div>
        </div>

        {/* Track list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {tracks.map((t) => (
            <div key={t.num} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--surface2)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--muted)", width: 16, textAlign: "center" }}>{t.num}</span>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: "linear-gradient(135deg, #2a2a3a, #1a1a2a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{t.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.artist}</div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, flexShrink: 0,
                background: t.matched ? "rgba(30,215,96,0.12)" : "rgba(232,95,71,0.12)",
                color: t.matched ? "var(--spotify)" : "var(--accent2)",
              }}>
                {t.matched ? "✓" : "!"}
              </div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ height: 4, background: "var(--surface2)", borderRadius: 100, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: "75%", background: "linear-gradient(90deg, var(--accent), var(--accent2))", borderRadius: 100, animation: "progressFill 2s ease-out both" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>
            <span>18 / 24 matched</span>
            <span>75%</span>
          </div>
        </div>

        <button style={{
          width: "100%", background: "var(--accent)", color: "#0a0a0b",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 15,
          padding: 16, borderRadius: 12, border: "none", cursor: "none",
          transition: "opacity 0.2s, transform 0.2s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
        >
          Complete Transfer →
        </button>
      </div>
    </section>
  );
}
