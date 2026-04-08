"use client";

import { useEffect, useRef } from "react";

const ConnectAccountIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5.94916 1.25L6 1.25L6.05085 1.25H6.05089C6.83242 1.24997 7.49342 1.24994 8.02016 1.32076C8.57988 1.39601 9.09891 1.56338 9.51777 1.98224C9.93663 2.40109 10.104 2.92013 10.1792 3.47984C10.2501 4.00659 10.25 4.66759 10.25 5.44912V5.44916V5.55084V5.55088C10.25 6.33241 10.2501 6.99342 10.1792 7.52016C10.104 8.07988 9.93663 8.59891 9.51777 9.01777C9.09891 9.43663 8.57988 9.60399 8.02016 9.67924C7.49342 9.75006 6.83241 9.75004 6.05088 9.75H6.05084H5.94916H5.94912C5.16759 9.75004 4.50659 9.75006 3.97984 9.67924C3.42013 9.60399 2.90109 9.43663 2.48224 9.01777C2.06338 8.59891 1.89601 8.07988 1.82076 7.52016C1.74994 6.99342 1.74997 6.33242 1.75 5.55089V5.55085L1.75 5.5L1.75 5.44916V5.44912C1.74997 4.66759 1.74994 4.00659 1.82076 3.47984C1.89601 2.92013 2.06338 2.40109 2.48224 1.98224C2.90109 1.56338 3.42013 1.39601 3.97984 1.32076C4.50659 1.24994 5.16759 1.24997 5.94912 1.25H5.94916Z" fill="currentColor"/>
    <path d="M4.53035 13.8179C4.95899 13.4909 5.42694 13.25 6 13.25C6.57306 13.25 7.04101 13.4909 7.46965 13.8179C7.87188 14.1248 8.38723 14.6402 8.90907 15.1621C9.43097 15.684 9.87517 16.1281 10.1821 16.5303C10.5091 16.959 10.75 17.4269 10.75 18C10.75 18.5731 10.5091 19.041 10.1821 19.4697C9.87517 19.8719 9.43097 20.316 8.90907 20.8379C8.38723 21.3598 7.87187 21.8752 7.46965 22.1821C7.04101 22.5091 6.57306 22.75 6 22.75C5.42694 22.75 4.95899 22.5091 4.53035 22.1821C4.12812 21.8752 3.61278 21.3598 3.09093 20.8379C2.56903 20.316 2.12483 19.8719 1.81795 19.4697C1.4909 19.041 1.25 18.5731 1.25 18C1.25 17.4269 1.4909 16.959 1.81795 16.5303C2.12483 16.1281 2.64022 15.6128 3.16212 15.0909C3.68397 14.569 4.12812 14.1248 4.53035 13.8179Z" fill="currentColor"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M6 8C5.44771 8 5 8.44772 5 9V14C5 14.5523 5.44771 15 6 15C6.55229 15 7 14.5523 7 14V9C7 8.44772 6.55229 8 6 8ZM16 18C16 17.4477 15.5523 17 15 17H10C9.44772 17 9 17.4477 9 18C9 18.5523 9.44772 19 10 19H15C15.5523 19 16 18.5523 16 18Z" fill="currentColor"/>
    <path d="M18.4492 13.75L18.5 13.75L18.5508 13.75H18.5509C19.3324 13.75 19.9934 13.7499 20.5202 13.8208C21.0799 13.896 21.5989 14.0634 22.0178 14.4822C22.4366 14.9011 22.604 15.4201 22.6792 15.9798C22.7501 16.5066 22.75 17.1676 22.75 17.9491V17.9492V18.0508V18.0509C22.75 18.8324 22.7501 19.4934 22.6792 20.0202C22.604 20.5799 22.4366 21.0989 22.0178 21.5178C21.5989 21.9366 21.0799 22.104 20.5202 22.1792C19.9934 22.2501 19.3324 22.25 18.5509 22.25H18.5508H18.4492H18.4491C17.6676 22.25 17.0066 22.2501 16.4798 22.1792C15.9201 22.104 15.4011 21.9366 14.9822 21.5178C14.5634 21.0989 14.396 20.5799 14.3208 20.0202C14.2499 19.4934 14.25 18.8324 14.25 18.0509V18.0508L14.25 18L14.25 17.9492V17.9491C14.25 17.1676 14.2499 16.5066 14.3208 15.9798C14.396 15.4201 14.5634 14.9011 14.9822 14.4822C15.4011 14.0634 15.9201 13.896 16.4798 13.8208C17.0066 13.7499 17.6676 13.75 18.4491 13.75H18.4492Z" fill="currentColor"/>
  </svg>
);

const PickPlaylistIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path opacity="0.4" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" fill="currentColor"/>
    <path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z" fill="currentColor"/>
    <path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M14 2.20004C13.3538 2.06886 12.6849 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 11.3151 21.9311 10.6462 21.8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M19.1749 2.33007L19.6913 4.30912L21.6703 4.82548C22.0407 4.92211 22.1164 5.39591 21.8103 5.70196L20.661 6.85135C19.8813 7.63105 18.7927 7.96805 17.8491 7.72186L16.6035 7.39687L16.2785 6.15129C16.0323 5.20771 16.3694 4.11915 17.1491 3.33944L18.2984 2.19006C18.6045 1.88401 19.0783 1.95969 19.1749 2.33007Z" fill="currentColor"/>
    <path d="M16.6031 7.39687L12 12M16.6031 7.39687L16.2781 6.15129C16.0319 5.20771 16.369 4.11915 17.1487 3.33944L18.298 2.19006C18.6041 1.88401 19.0779 1.95969 19.1745 2.33007L19.6909 4.30912L21.6699 4.82548C22.0403 4.92211 22.116 5.39591 21.8099 5.70196L20.6606 6.85135C19.8809 7.63105 18.7923 7.96805 17.8487 7.72186L16.6031 7.39687Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WatchTransferIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9.26289 19.2885C10.9169 18.7371 13.0833 18.7372 14.7372 19.2885C15.0873 19.4052 15.3005 19.7592 15.2399 20.1233L15.2397 20.1245C15.2395 20.5184 14.8758 21.3149 14.6939 21.6639C14.2751 22.4536 13.5064 23.4098 12.1751 23.7293C12.06 23.7569 11.9401 23.7569 11.825 23.7293C10.4938 23.4098 9.72501 22.4536 9.30622 21.6639C9.027 21.2125 8.82591 20.4487 8.76028 20.1233C8.6996 19.7593 8.91278 19.4052 9.26289 19.2885Z" fill="currentColor"/>
    <path d="M21.5242 18.6097C21.7411 18.766 22.0248 18.7951 22.2688 18.686C22.5129 18.5769 22.6804 18.3461 22.7086 18.0803L22.7092 18.0773C22.7756 17.857 22.7463 17.3876 22.7233 17.1801C22.7 16.6558 22.6176 15.9372 22.3763 15.1742C22.1 14.3004 21.6105 13.3639 20.7743 12.6043C20.4634 12.3219 20.308 12.1807 20.1358 12.2464C19.9637 12.312 19.9393 12.5427 19.8906 13.0043C19.7611 14.2306 19.5133 15.5371 19.1297 16.9261C19.0498 17.2155 19.0098 17.3602 19.0695 17.4676C19.1293 17.5749 19.2778 17.6185 19.5748 17.7057C20.2893 17.9155 20.9685 18.2092 21.5242 18.6097Z" fill="currentColor"/>
    <path d="M2.47578 18.6097C2.25891 18.766 1.97524 18.795 1.73119 18.6859C1.48715 18.5769 1.31961 18.3461 1.29145 18.0803L1.29083 18.0772C1.22443 17.8569 1.25368 17.3876 1.27667 17.18C1.30002 16.6558 1.38243 15.9371 1.62372 15.1742C1.90004 14.3004 2.38948 13.3639 3.22562 12.6043C3.5365 12.3219 3.69194 12.1807 3.8641 12.2464C4.03627 12.312 4.06064 12.5427 4.10938 13.0043C4.23888 14.2306 4.48669 15.5371 4.87026 16.926C4.95019 17.2155 4.99016 17.3602 4.93041 17.4676C4.87066 17.5749 4.72214 17.6185 4.42511 17.7057C3.7107 17.9154 3.03153 18.2092 2.47578 18.6097Z" fill="currentColor"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M11.7594 0.289642C11.9154 0.236786 12.0845 0.236786 12.2406 0.289642C13.9946 0.883737 16.2772 2.50913 17.6223 5.44204C18.9745 8.39058 19.3442 12.5793 17.4152 18.2418C17.3414 18.4585 17.1728 18.6295 16.9573 18.7064C16.7417 18.7833 16.5029 18.7576 16.3087 18.6366C15.8682 18.3621 14.2707 17.6875 12 17.6875C9.72924 17.6875 8.13176 18.3621 7.69129 18.6366C7.49707 18.7576 7.25823 18.7833 7.0427 18.7064C6.82717 18.6295 6.65853 18.4585 6.58474 18.2418C4.65577 12.5793 5.02543 8.39058 6.37769 5.44204C7.72277 2.50913 10.0054 0.883737 11.7594 0.289642ZM14.5 8C14.5 6.61929 13.3807 5.5 12 5.5C10.6193 5.5 9.5 6.61929 9.5 8C9.5 9.38071 10.6193 10.5 12 10.5C13.3807 10.5 14.5 9.38071 14.5 8Z" fill="currentColor"/>
  </svg>
);

const steps = [
  { n: "1", icon: <ConnectAccountIcon />, title: "Connect your accounts",   body: "Log in to your source and destination platforms securely via OAuth. We never store your passwords." },
  { n: "2", icon: <PickPlaylistIcon />, title: "Pick a playlist",          body: "Browse all your playlists and select one — or all of them. We'll show you a full preview before anything moves." },
  { n: "3", icon: <WatchTransferIcon />, title: "Watch it transfer",        body: "We match each track and build your playlist on the new platform. You get a detailed report of every match — hits and misses." },
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
    <section id="platforms" className="steps-section" style={{ padding: "80px 60px 120px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, marginBottom: 16 }}>
        How it works
      </div>
      <h2 style={{ fontFamily: "'Aleo', serif", fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1 }}>
        Three steps.<br />That&apos;s genuinely it.
      </h2>

      <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 60 }}>
        {steps.map((s, i) => (
          <div
            key={s.n}
            ref={el => { cardsRef.current[i] = el; }}
            className="step-card"
            style={{
              background: "var(--surface)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20, padding: 32, position: "relative", overflow: "hidden",
              opacity: 1, transform: "translateY(0)",
              transition: "opacity 0.5s ease, transform 0.5s ease, border-color 0.3s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,197,71,0.25)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            <span style={{ fontFamily: "'Aleo', serif", fontSize: 64, fontWeight: 700, color: "rgba(255,255,255,0.04)", position: "absolute", top: 16, right: 24, lineHeight: 1, pointerEvents: "none" }}>{s.n}</span>
            <div style={{ width: 44, height: 44, background: "rgba(232,197,71,0.08)", border: "1px solid rgba(232,197,71,0.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#e8c547", marginBottom: 20 }}>{s.icon}</div>
            <h3 style={{ fontFamily: "'Aleo', serif", fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 10 }}>{s.title}</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.65 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
