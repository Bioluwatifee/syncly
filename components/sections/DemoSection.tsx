"use client";
import PlatformSelector from "@/components/transfer/PlatformSelector";
import PlaylistList, { PlaylistItem } from "@/components/transfer/PlaylistList";

// ─── DemoSection ──────────────────────────────────────────────────────────────
// Static preview of the transfer experience. Renders the real PlatformSelector
// and PlaylistList components so this mockup always matches the live /transfer
// page. Wrapped in a pointer-events-none layer so nothing is clickable/hoverable
// — purely decorative — and constrained to the same 740px content column the
// real page uses, so proportions match instead of stretching to the wider demo
// frame.

// ─── Mock data ───────────────────────────────────────────────────────────────

const DEMO_PLAYLISTS: PlaylistItem[] = [
  {
    id: "1",
    name: "This feels like it",
    owner: "Stanye",
    trackCount: 22,
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop",
  },
  {
    id: "2",
    name: "Late night drive",
    owner: "Stanye",
    trackCount: 31,
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop",
  },
  {
    id: "3",
    name: "Sunday morning",
    owner: "Stanye",
    trackCount: 18,
    imageUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100&h=100&fit=crop",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DemoSection() {
  return (
    <section id="how" className="demo-section-tsx" style={{
      padding: "120px 60px",
      maxWidth: 1100,
      margin: "0 auto",
      fontFamily: "'DM Sans', sans-serif",
      boxSizing: "border-box",
    }}>
      <style>{`
        /* Stretch each platform side to fill the wider demo column instead of
           the real /transfer page's narrower 324px cap */
        .demo-section-tsx .platform-side-box {
          max-width: none !important;
        }

        @media (max-width: 768px) {
          .demo-section-tsx {
            padding: 64px 20px 48px !important;
          }
          .demo-section-tsx h2 {
            font-size: clamp(26px, 7vw, 38px) !important;
            letter-spacing: -1px !important;
          }
          .demo-section-tsx .demo-subtitle {
            font-size: 15px !important;
            margin-bottom: 36px !important;
            max-width: 100% !important;
          }
          .demo-section-tsx .demo-card {
            padding: 22px 16px 20px !important;
            border-radius: 18px !important;
          }
          .demo-section-tsx .platform-selector-label {
            font-size: 16px !important;
            margin-bottom: 16px !important;
          }
        }

        @media (max-width: 390px) {
          .demo-section-tsx {
            padding: 48px 14px 40px !important;
          }
          .demo-section-tsx .demo-card {
            padding: 18px 12px 16px !important;
          }
        }
      `}</style>

      {/* ── Outer section frame — preserved exactly ── */}
      <div style={{
        fontSize: 12, color: "#e8c547", letterSpacing: "2px",
        textTransform: "uppercase", fontWeight: 500, marginBottom: 16,
      }}>
        The transfer experience
      </div>

      <h2 style={{
        fontFamily: "'Aleo', serif",
        fontSize: "clamp(36px, 4vw, 56px)",
        fontWeight: 700,
        letterSpacing: "-1.5px",
        lineHeight: 1.1,
        marginBottom: 16,
        color: "#fff",
      }}>
        Built for music lovers.
      </h2>

      <p className="demo-subtitle" style={{
        color: "rgba(255,255,255,0.45)",
        fontSize: 16,
        lineHeight: 1.65,
        maxWidth: 480,
        marginBottom: 60,
      }}>
        A clean, transparent transfer flow. See exactly what matched, what didn&apos;t, and why.
      </p>

      {/* ── Inner mockup — real /transfer components, statically wired ── */}
      <div className="demo-card" style={{
        background: "#131316",
        borderRadius: 24,
        padding: "36px 36px 32px",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        position: "relative",
      }}>

        {/* Gold top-edge shimmer — matches original transfer-card::before */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(232,197,71,0.5), transparent)",
        }} />

        {/* Content column — widened from the real /transfer page's 740px cap so it
            sits close to the demo card's own edges instead of floating in the middle */}
        <div style={{ maxWidth: 920, margin: "0 auto" }}>

          {/* Platform selector label — matches /transfer page heading exactly */}
          <h3 className="platform-selector-label" style={{
            fontFamily: "'Calligraffitti', cursive",
            fontSize: 24, fontWeight: 400,
            color: "rgba(255,255,255,0.9)",
            marginBottom: 24, letterSpacing: "0.1px",
          }}>
            Platform selector
          </h3>

          {/* Real PlatformSelector + PlaylistList — non-interactive (display only) */}
          <div style={{ pointerEvents: "none" }}>
            <PlatformSelector
              fromPlatform="spotify"
              toPlatform="youtube"
              fromConnected={true}
              toConnected={true}
              onFromSelect={() => {}}
              onToSelect={() => {}}
              onFromConnect={async () => {}}
              onToConnect={async () => {}}
            />

            {/* Divider — matches /transfer page section divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "32px 0" }} />

            {/* "Spotify playlists..." header + rows, static */}
            <div style={{ marginBottom: 32 }}>
              <PlaylistList
                platform="spotify"
                connected={true}
                loading={false}
                playlists={DEMO_PLAYLISTS}
                selectedId="1"
                onSelect={() => {}}
              />
            </div>
          </div>

          {/* Transfer button — matches live button's size/radius/color exactly */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="transfer-pill" style={{
              width: "45%", minWidth: 200,
              padding: "16px 24px", borderRadius: 100,
              background: "#e8c547", color: "#0a0a0b",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
              fontSize: 16, letterSpacing: "0.2px", userSelect: "none",
              textAlign: "center",
            }}>
              Transfer playlist
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
