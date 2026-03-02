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
      <body>{children}</body>
    </html>
  );
}