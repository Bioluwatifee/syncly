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
    }} className="site-footer">

      <style>{`
        @media (max-width: 768px) {
          .site-footer {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            padding: 36px 24px !important;
            gap: 16px !important;
          }
        }
      `}</style>

      {/* Logo */}
      <a href="/" style={{
        display: "flex", alignItems: "center", gap: 8,
        textDecoration: "none", flexShrink: 0,
      }}>
        <img
          src="/favicon-96x96.png"
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
      <div style={{ fontSize: 13, color: "#6b6870", lineHeight: 1.6 }}>
        Built in public by Boluwatife Ayodeji · Follow the journey on{" "}
        <a
          href="https://www.linkedin.com/in/ayodeji-boluwatife/"
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
        <a
          href="https://x.com/hi_stanYe"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, color: "#6b6870", textDecoration: "none", transition: "color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#f0ede8")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6b6870")}
        >
          X / Twitter
        </a>
        <a
          href="#"
          style={{ fontSize: 13, color: "#6b6870", textDecoration: "none", transition: "color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#f0ede8")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6b6870")}
        >
          Privacy
        </a>
      </div>

    </footer>
  );
}
