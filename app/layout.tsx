import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Syncly — Move Your Music",
  description:
    "Move entire playlists between Spotify, Apple Music, and YouTube Music in seconds. No lost songs. No starting over.",
  openGraph: {
    title: "Syncly — Move Your Music",
    description:
      "Move entire playlists between Spotify, Apple Music, and YouTube Music in seconds.",
    type: "website",
    url: "https://syncly.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Syncly — Move Your Music",
    description: "Move playlists between Spotify, Apple Music & YouTube Music.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Aleo:ital,wght@0,300;0,400;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&family=Calligraffitti&family=Caveat:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
