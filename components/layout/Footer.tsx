"use client";

export default function Footer() {
  return (
    <footer style={{
      padding: "40px 60px",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
      <div style={{ fontFamily: "'Aleo', serif", fontSize: 18, fontWeight: 700 }}>
        Syncly
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        Built in public · Follow the journey on LinkedIn
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {[
          { label: "GitHub", href: "#" },
          { label: "LinkedIn", href: "#" },
          { label: "Privacy", href: "#" },
        ].map((link) => (
          <a key={link.label} href={link.href}
            style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
          >
            {link.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
