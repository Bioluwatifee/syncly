import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Syncly",
  description: "How Syncly handles your data when transferring playlists between music streaming platforms.",
};

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0f0f0f",
      fontFamily: "'DM Sans', sans-serif",
      color: "#f0ede8",
    }}>
      {/* Nav */}
      <nav style={{
        padding: "24px 60px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
      }} className="privacy-nav">
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
        {/* Header */}
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
            Privacy Policy
          </h1>
          <p style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.4)",
            margin: 0,
          }}>
            Last updated: June 12, 2026
          </p>
        </div>

        {/* Intro */}
        <p style={{
          fontSize: 16,
          lineHeight: 1.75,
          color: "rgba(255,255,255,0.7)",
          marginBottom: 48,
        }}>
          Syncly (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is a playlist migration tool that helps you transfer
          playlists between music streaming platforms.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

          <Section title="What information we access">
            <p>
              When you connect a music streaming account (such as Spotify, YouTube Music, or other
              supported platforms), Syncly requests permission to:
            </p>
            <ul>
              <li>View your playlists and their contents</li>
              <li>Create and modify playlists on the destination platform</li>
            </ul>
            <p>
              This access is granted through each platform&apos;s official authentication system (OAuth).
              Syncly does not receive or store your account password.
            </p>
          </Section>

          <Section title="How we use this information">
            <p>Syncly uses this access solely to:</p>
            <ul>
              <li>Read your playlist contents from the source platform</li>
              <li>Search for matching tracks on the destination platform</li>
              <li>Create and populate a new playlist with matched tracks</li>
            </ul>
          </Section>

          <Section title="Data storage">
            <p>
              Syncly does not permanently store your playlist data, listening history, or personal
              account information. Playlist data is processed in real-time during a transfer and is
              not retained afterward.
            </p>
          </Section>

          <Section title="Third-party services">
            <p>
              Syncly integrates with the official APIs of supported music streaming platforms to
              perform playlist transfers. Your use of these platforms remains subject to their
              respective privacy policies and terms of service.
            </p>
          </Section>

          <Section title="Data sharing">
            <p>We do not sell, rent, or share your data with third parties.</p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              As Syncly adds support for additional platforms and features, this privacy policy may
              be updated. Continued use of Syncly after changes constitutes acceptance of the updated
              policy.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For questions about this privacy policy, contact us through{" "}
              <a
                href="https://synclyy.xyz"
                style={{ color: "#e8c547", textDecoration: "none" }}
              >
                synclyy.xyz
              </a>
              .
            </p>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: "32px 60px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "'DM Sans', sans-serif",
      }} className="privacy-footer">
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
        .privacy-nav {
          padding: 24px 60px;
        }
        .privacy-footer {
          padding: 32px 60px;
        }
        @media (max-width: 768px) {
          .privacy-nav {
            padding: 20px 24px !important;
          }
          .privacy-footer {
            padding: 24px 24px !important;
          }
        }
        .privacy-section ul {
          margin: 12px 0 16px;
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .privacy-section ul li {
          font-size: 16px;
          line-height: 1.75;
          color: rgba(255,255,255,0.7);
        }
        .privacy-section p {
          font-size: 16px;
          line-height: 1.75;
          color: rgba(255,255,255,0.7);
          margin: 0 0 4px;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="privacy-section">
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
