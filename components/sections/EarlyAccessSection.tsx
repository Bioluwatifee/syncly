"use client";

export default function EarlyAccessSection() {
  return (
    <section style={{ padding: "0 60px 100px" }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid rgba(232,197,71,0.18)",
        borderRadius: 32, padding: "90px 60px",
        textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        {/* Glow */}
        <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse at 50% 0%, rgba(232,197,71,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Tag */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,197,71,0.07)", border: "1px solid rgba(232,197,71,0.2)", borderRadius: 100, padding: "6px 16px", fontSize: 11, fontWeight: 500, color: "var(--accent)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 28, position: "relative" }}>
          <div style={{ width: 6, height: 6, background: "var(--accent)", borderRadius: "50%", animation: "pulse 2s ease-in-out infinite" }} />
          Coming Soon
        </div>

        {/* Headline */}
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(38px, 5vw, 66px)", fontWeight: 700, letterSpacing: -2, lineHeight: 1.05, marginBottom: 20, position: "relative" }}>
          Be the first to know<br />
          <em style={{ fontStyle: "italic", color: "var(--accent)" }}>when we launch.</em>
        </h2>

        {/* Sub */}
        <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 44px", position: "relative", fontWeight: 300 }}>
          We&apos;re putting the final touches on Tuneshift. Drop your details and you&apos;ll be first in line — no spam, just the launch email.
        </p>

        {/* CTA */}
        <a
          href="https://tally.so/r/442xBY"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "var(--accent)", color: "#0a0a0b",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 16,
            padding: "18px 40px", borderRadius: 100,
            textDecoration: "none", position: "relative",
            transition: "transform 0.25s ease, box-shadow 0.25s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 50px rgba(232,197,71,0.3)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
        >
          <span style={{ fontSize: 14, opacity: 0.7 }}>✦</span>
          Get early access
          <span style={{ fontSize: 18 }}>→</span>
        </a>



        {/* Waveform */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, pointerEvents: "none" }} aria-hidden="true">
          <svg viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            <g fill="none" stroke="rgba(232,197,71,0.15)" strokeWidth="1.5">
              <polyline points="0,40 40,20 80,55 120,15 160,50 200,25 240,45 280,10 320,50 360,30 400,48 440,18 480,52 520,22 560,46 600,12 640,50 680,28 720,44 760,20 800,40" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}
