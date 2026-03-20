"use client";

export default function Footer() {
  return (
    <footer style={{
      padding: "40px 60px",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Logo */}
      <a href="/" style={{
        display: "flex", alignItems: "center", gap: 8,
        textDecoration: "none", flexShrink: 0,
      }}>
        <img
          src="/favicon-32x32.png"
          alt="Syncly"
          width={20}
          height={20}
          style={{ display: "block", flexShrink: 0 }}
        />
        <span style={{
          fontFamily: "'Aleo', serif",
          fontSize: 18, fontWeight: 700,
          letterSpacing: "-0.5px",
          color: "#f0ede8",
        }}>
          Syncly
        </span>
      </a>

      {/* Note */}
      <div style={{ fontSize: 13, color: "#6b6870" }}>
        Built in public · Follow the journey on{" "}
        <a
          href="https://linkedin.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#6b6870", textDecoration: "underline", transition: "color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#f0ede8")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6b6870")}
        >
          LinkedIn
        </a>
      </div>

      {/* Links */}
      <div className="footer-links" style={{ display: "flex", gap: 24 }}>
        {[
          { label: "GitHub",  href: "#" },
          { label: "LinkedIn", href: "#" },
          { label: "Privacy", href: "#" },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            style={{ fontSize: 13, color: "#6b6870", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f0ede8")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6b6870")}
          >
            {label}
          </a>
        ))}
      </div>
    </footer>
  );
}
