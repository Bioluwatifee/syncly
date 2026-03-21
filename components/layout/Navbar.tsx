"use client";

import { useState, useEffect } from "react";

export default function Navbar() {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "28px 60px",
          paddingTop: "max(28px, calc(28px + env(safe-area-inset-top)))",
          position: "fixed",
          top: 0, left: 0, right: 0,
          zIndex: 1000,
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
          background: scrolled ? "rgba(10,10,11,0.92)" : "rgba(10,10,11,0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          transition: "border-color 0.3s, background 0.3s",
        }}
        className="syncly-nav"
      >
        {/* Logo */}
        <a href="/" style={{
          fontFamily: "'Aleo', serif",
          fontSize: 22, fontWeight: 700,
          letterSpacing: "-0.5px",
          color: "#f0ede8",
          textDecoration: "none",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0,
        }}>
          <img
            src="/favicon-96x96.png"
            alt="Syncly"
            width={22}
            height={22}
            style={{ display: "block", flexShrink: 0 }}
          />
          Syncly
        </a>

        {/* Desktop nav links */}
        <ul style={{
          display: "flex", gap: 40, listStyle: "none",
          margin: 0, padding: 0,
        }} className="nav-links-desktop">
          <li><a href="#how" style={{ color: "#6b6870", textDecoration: "none", fontSize: 14, fontWeight: 400, letterSpacing: "0.3px", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f0ede8")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6b6870")}
          >How it works</a></li>
          <li><a href="#platforms" style={{ color: "#6b6870", textDecoration: "none", fontSize: 14, fontWeight: 400, letterSpacing: "0.3px", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f0ede8")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6b6870")}
          >Platforms</a></li>
        </ul>

        {/* Desktop CTA */}
        <a
          href="https://tally.so/r/442xBY"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-cta-desktop"
          style={{
            background: "#e8c547", color: "#0a0a0b",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            fontSize: 14, padding: "10px 24px",
            borderRadius: 100, border: "none",
            textDecoration: "none", display: "inline-block",
            letterSpacing: "0.2px",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(232,197,71,0.35)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
        >
          Get Early Access
        </a>

        {/* Hamburger — mobile only */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="hamburger"
          style={{
            display: "none",             // shown via CSS on mobile
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 5,
            width: 40, height: 40,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 8,
            borderRadius: 8,
            flexShrink: 0,
          }}
        >
          <span style={{
            display: "block", width: 22, height: 1.5,
            background: menuOpen ? "#e8c547" : "#f0ede8",
            borderRadius: 2,
            transition: "transform 0.25s, opacity 0.2s",
            transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none",
          }} />
          <span style={{
            display: "block", width: 22, height: 1.5,
            background: "#f0ede8",
            borderRadius: 2,
            transition: "opacity 0.2s",
            opacity: menuOpen ? 0 : 1,
          }} />
          <span style={{
            display: "block", width: 22, height: 1.5,
            background: menuOpen ? "#e8c547" : "#f0ede8",
            borderRadius: 2,
            transition: "transform 0.25s, opacity 0.2s",
            transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none",
          }} />
        </button>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className="mobile-menu"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 199,
          background: "rgba(10,10,11,0.97)",
          backdropFilter: "blur(20px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      >
        <nav style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 8,
          width: "100%", padding: "0 32px",
        }}>
          {[
            { href: "#how",       label: "How it works" },
            { href: "#platforms", label: "Platforms" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={closeMenu}
              style={{
                color: "#f0ede8",
                textDecoration: "none",
                fontSize: 28, fontWeight: 600,
                fontFamily: "'Aleo', serif",
                letterSpacing: "-0.5px",
                padding: "14px 0",
                width: "100%", textAlign: "center",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                transition: "color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#e8c547")}
              onMouseLeave={e => (e.currentTarget.style.color = "#f0ede8")}
            >
              {label}
            </a>
          ))}

          <a
            href="https://tally.so/r/442xBY"
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
            style={{
              marginTop: 32,
              background: "#e8c547", color: "#0a0a0b",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
              fontSize: 16, padding: "16px 40px",
              borderRadius: 100,
              textDecoration: "none",
              display: "inline-block",
              letterSpacing: "0.2px",
              width: "100%", textAlign: "center",
            }}
          >
            Get Early Access
          </a>
        </nav>
      </div>

      {/* Scoped styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }

        @media (max-width: 768px) {
          .syncly-nav {
            padding: 20px 20px !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          }
          .nav-links-desktop {
            display: none !important;
          }
          .nav-cta-desktop {
            display: none !important;
          }
          .hamburger {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
