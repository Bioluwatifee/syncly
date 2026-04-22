import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastProvider from "@/components/ui/ToastProvider";
import { Analytics } from "@vercel/analytics/next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://synclyy.xyz"),
  title: "Syncly — Move Your Music",
  description:
    "Move entire playlists between Spotify, Apple Music, and YouTube Music in seconds. No lost songs. No starting over.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Syncly — Move Your Music",
    description:
      "Move entire playlists between Spotify, Apple Music, and YouTube Music in seconds.",
    type: "website",
    url: "https://synclyy.xyz",
    images: [{ url: "/favicon.ico" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Syncly — Move Your Music",
    description: "Move playlists between Spotify, Apple Music & YouTube Music.",
    images: ["/favicon.ico"],
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
      <body>
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
