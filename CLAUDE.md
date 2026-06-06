# Syncly — CLAUDE.md
## Project Overview
Syncly is a playlist migration tool that transfers playlists between Spotify, Apple Music and YouTube Music. Built by a product designer using AI assistance.
## Tech Stack
- Next.js 16.2.2 (Turbopack)
- TypeScript
- Tailwind CSS
- Deployed on Vercel
- GitHub repo: syncly
## Design
- Dark background #0f0f0f, yellow accent #e8c547
- Fonts: Calligraffitti (decorative headings on /transfer page only), Aleo (headings), DM Sans (body)
- Logo: /public/favicon-96x96.png
## Pages
- / — landing page (waitlist mode, Get Early Access button)
- /transfer — transfer page (main product)
## Key Components
- components/layout/Navbar.tsx
- components/layout/Footer.tsx
- components/sections/Hero.tsx
- components/sections/DemoSection.tsx
- components/sections/StepsSection.tsx
- components/sections/EarlyAccessSection.tsx
- components/transfer/PlatformSelector.tsx
- components/transfer/PlaylistList.tsx
- app/transfer/page.tsx
- app/api/transfer/route.ts — core transfer logic
- app/api/spotify/route.ts — Spotify API calls
- app/api/youtube/route.ts — YouTube Music API calls
- app/api/auth/route.ts — OAuth handling
- app/api/auth/callback/spotify — Spotify OAuth callback
- lib/security.ts — security middleware
## Current State
Transfer is working end to end. Spotify → YouTube Music transfer completes successfully.
## Critical Fix — What Was Blocking Transfer
Spotify deprecated /playlists/{id}/tracks in favor of /playlists/{id}/items for newer apps. Switching to /items endpoint resolved the 403 Forbidden error that blocked all track fetching.
## Current Bug — FIX THIS FIRST
Runtime error: "Can't find variable: formatCompleted"
This appeared after a large UI overhaul prompt was implemented. The formatCompleted function is referenced but not defined or imported in app/transfer/page.tsx. Fix this before anything else.
## Transfer Performance
Last test: 13 out of 34 tracks transferred successfully (38% match rate)
Transfer completes in approximately 33 seconds for 34 tracks
YouTube playlist is created successfully on destination account
## Known Issues To Fix (in priority order)
1. formatCompleted runtime error — UI completely broken
2. Timeout UX — transfer completes but frontend shows error instead of results
3. Match rate too low — 13/34 (38%) needs to be 70%+
4. Search query needs improvement — strip remaster/deluxe/anniversary tags before searching
5. Failed tracks list needs scroll container — currently renders as endless list
6. Retry failed tracks feature needed
## Match Quality Issues
These tracks should have matched but didn't:
- Wicked Game — Chris Isaak
- Earth Song — Michael Jackson
- Chamber Of Reflection — Mac DeMarco
- Stand By Me — Ben E. King
Matcher may be too strict. Threshold needs relaxing.
## OAuth Configuration
- Spotify redirect URI: http://127.0.0.1:3000/api/auth/callback/spotify
- Spotify scopes: playlist-read-private, playlist-read-collaborative, playlist-modify-public, playlist-modify-private, user-library-read, user-read-email, user-read-private
- App is in Spotify development mode (max 25 users)
- YouTube Music OAuth also configured
## Product Decisions
- Platformless — no Syncly user accounts for MVP
- Single playlist transfer at a time
- Spotify → YouTube Music first, YouTube Music → Spotify second
- Apple Music coming later (more complex OAuth)
- One retry pass for failed tracks maximum
## CSS
- app/globals.css imports app/mobile.css for responsive styles
- Fully mobile responsive
- Safari webkit fixes applied
## Building In Public
- Live at synclyy.xyz
- Posting on LinkedIn and Twitter/X
- 5 posts published so far
- Waitlist collecting emails via Tally