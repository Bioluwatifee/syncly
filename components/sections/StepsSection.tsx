"use client";

import { useEffect, useRef } from "react";

const steps = [
  { n: "1", icon: "🔑", title: "Connect your accounts",   body: "Log in to your source and destination platforms securely via OAuth. We never store your passwords." },
  { n: "2", icon: "🎯", title: "Pick a playlist",          body: "Browse all your playlists and select one — or all of them. We'll show you a full preview before anything moves." },
  { n: "3", icon: "✨", title: "Watch it transfer",        body: "We match each track and build your playlist on the new platform. You get a detailed report of every match — hits and misses." },
];

export default function StepsSection() {
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            (entry.target as HTMLElement).style.opacity = "1";
            (entry.target as HTMLElement).style.transform = "translateY(0)";
          }, i * 100);
        }
      });
    }, { threshold: 0.1 });

    cardsRef.current.forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  return (
    <section id="platforms" style={{ padding: "80px 60px 120px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, marginBottom: 16 }}>
        How it works
      </div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1 }}>
        Three steps.<br />That&apos;s genuinely it.
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 60 }}>
        {steps.map((s, i) => (
          <div
            key={s.n}
            ref={el => { cardsRef.current[i] = el; }}
            className="step-card"
            style={{
              background: "var(--surface)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20, padding: 32, position: "relative", overflow: "hidden",
              opacity: 0, transform: "translateY(20px)",
              transition: "opacity 0.5s ease, transform 0.5s ease, border-color 0.3s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,197,71,0.25)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 64, fontWeight: 700, color: "rgba(255,255,255,0.04)", position: "absolute", top: 16, right: 24, lineHeight: 1, pointerEvents: "none" }}>{s.n}</span>
            <div style={{ width: 44, height: 44, background: "rgba(232,197,71,0.08)", border: "1px solid rgba(232,197,71,0.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 20 }}>{s.icon}</div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 10 }}>{s.title}</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.65 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
