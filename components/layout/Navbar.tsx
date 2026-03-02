"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "28px 60px",
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 100,
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
        background: scrolled ? "rgba(10,10,11,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        transition: "border-color 0.3s, background 0.3s",
      }}
    >
      {/* Logo */}
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, background: "var(--accent)", borderRadius: "50%", animation: "pulse 2s ease-in-out infinite" }} />
        Tuneshift
      </div>

      {/* Links */}
      <ul style={{ display: "flex", gap: 40, listStyle: "none" }}>
        {[{ label: "How it works", href: "#how" }, { label: "Platforms", href: "#platforms" }].map((link) => (
          <li key={link.href}>
            <a href={link.href} style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14, fontWeight: 400, transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a
        href="https://tally.so/r/442xBY"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: "var(--accent)", color: "#0a0a0b",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 14,
          padding: "10px 24px", borderRadius: 100, border: "none",
          textDecoration: "none", display: "inline-block",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(232,197,71,0.35)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
      >
        Get Early Access
      </a>
    </nav>
  );
}
