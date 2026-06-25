import Link from "next/link";

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0f0f0f",
      fontFamily: "'DM Sans', sans-serif",
      color: "#f0ede8",
    }}>
      {/* Nav */}
      <nav className="legal-nav" style={{
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
      }}>
        <Link href="/" style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          textDecoration: "none",
        }}>
          <img
            src="/favicon-96x96.png"
            alt="Syncly"
            width={20}
            height={20}
            style={{ display: "block" }}
          />
          <span style={{
            fontFamily: "'Aleo', serif",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.5px",
            color: "#f0ede8",
          }}>
            Syncly
          </span>
        </Link>
      </nav>

      {/* Content */}
      <main style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "64px 24px 80px",
      }}>
        <div style={{ marginBottom: 48 }}>
          <h1 style={{
            fontFamily: "'Aleo', serif",
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: "-1px",
            color: "#f0ede8",
            margin: "0 0 12px",
            lineHeight: 1.2,
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.4)",
            margin: 0,
          }}>
            Last updated: {lastUpdated}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="legal-footer" style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <Link href="/" style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          textDecoration: "none",
          flexShrink: 0,
        }}>
          <img
            src="/favicon-96x96.png"
            alt="Syncly"
            width={20}
            height={20}
            style={{ display: "block" }}
          />
          <span style={{
            fontFamily: "'Aleo', serif",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.5px",
            color: "#f0ede8",
          }}>
            Syncly
          </span>
        </Link>
        <p style={{ fontSize: 13, color: "#6b6870", margin: 0 }}>
          &copy; {new Date().getFullYear()} Syncly
        </p>
      </footer>

      <style>{`
        .legal-nav {
          padding: 24px 60px;
        }
        .legal-footer {
          padding: 32px 60px;
        }
        @media (max-width: 768px) {
          .legal-nav {
            padding: 20px 24px !important;
          }
          .legal-footer {
            padding: 24px 24px !important;
          }
        }
        .legal-section p {
          font-size: 16px;
          line-height: 1.75;
          color: rgba(255,255,255,0.7);
          margin: 0 0 12px;
        }
        .legal-section p:last-child {
          margin-bottom: 0;
        }
        .legal-section ul {
          margin: 12px 0 16px;
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .legal-section ul li {
          font-size: 16px;
          line-height: 1.75;
          color: rgba(255,255,255,0.7);
        }
        .legal-section a {
          color: #e8c547;
          text-decoration: none;
        }
        .legal-section a:hover {
          text-decoration: underline;
        }
        .legal-intro a {
          color: #e8c547;
          text-decoration: none;
        }
        .legal-intro a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

export function LegalIntro({ children }: { children: React.ReactNode }) {
  return (
    <p className="legal-intro" style={{
      fontSize: 16,
      lineHeight: 1.75,
      color: "rgba(255,255,255,0.7)",
      marginBottom: 8,
    }}>
      {children}
    </p>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal-section">
      <h2 style={{
        fontFamily: "'Aleo', serif",
        fontSize: 20,
        fontWeight: 600,
        color: "#f0ede8",
        margin: "0 0 14px",
        letterSpacing: "-0.3px",
      }}>
        <span style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: "#e8c547",
          marginRight: 10,
          verticalAlign: "middle",
          position: "relative",
          top: -1,
        }} />
        {title}
      </h2>
      {children}
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
