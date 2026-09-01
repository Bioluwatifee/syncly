# Syncly — CLAUDE.md

## Project Overview
Syncly is a playlist migration tool that transfers playlists between Spotify, Apple Music and YouTube Music. Built by product designer Boluwatife Ayodeji using AI assistance. Building in public at synclyy.xyz

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
- All UI designed in Figma first before building
- Designer reviews all AI output before accepting

## Pages
- / — landing page (waitlist mode, Get Early Access button)
- /transfer — transfer page (main product)

## Key Files
- app/transfer/page.tsx — transfer page UI and state management
- app/api/transfer/route.ts — core transfer logic
- app/api/spotify/route.ts — Spotify API calls
- app/api/youtube/route.ts — YouTube Music API calls
- app/api/auth/route.ts — OAuth handling
- app/api/auth/callback/spotify — Spotify OAuth callback
- lib/security.ts — security middleware
- components/transfer/PlatformSelector.tsx
- components/transfer/PlaylistList.tsx

## Current State — What Works
- Spotify to YouTube Music transfer works end to end
- 34 song playlist transferred at 100% match rate
- OAuth working for both Spotify and YouTube Music
- All transfer UI states built (transferring, success, partial, error)
- Cancel transfer feature implemented
- Live progress tracking during transfer
- Mobile responsive
- Live on Vercel at synclyy.xyz

## Critical Fix — Spotify Silent Endpoint Deprecations
Spotify silently restricts legacy endpoints for newer apps. The symptom is always the same: a bare 403 Forbidden with no detail in the response body, while the token, scopes, and user ID are all confirmed correct. It is NOT an auth-expiry problem, and refreshing the token never fixes it (a refresh preserves the original grant's scopes).

Three instances hit so far, all fixed by switching to the newer endpoint form:

1. Read playlist tracks: POST/GET /playlists/{id}/tracks → /playlists/{id}/items
2. Create playlist: POST /users/{id}/playlists → POST /me/playlists (no user ID in path; targets the authenticated user directly)
3. Add tracks to playlist: POST /playlists/{id}/tracks → POST /playlists/{id}/items (same uris body)

Rule of thumb: when a Spotify call returns a bare 403 and auth is verified good, check developer.spotify.com for a newer form of that endpoint (usually /me/... instead of /users/{id}/..., or /items instead of /tracks) before debugging auth any further. Do not trust model training data on which Spotify endpoint is current — check the live docs.

Error handling note: 401 and 403 must stay separate. 401 = genuinely expired session ("reconnect" is correct). 403 = permission/endpoint problem — mapping it to 401 both shows a misleading "session expired" message and triggers a pointless refresh-and-retry.

## Current Bugs To Fix
1. YouTube rate limiting (429) on large playlists — transfer stops after ~27 songs. Need exponential backoff and delays between YouTube search requests
2. Vercel deployment failing — TypeScript error: 'Property scope does not exist on type { accessToken: string; refreshToken: string | undefined; expiresIn: number }' at app/api/auth/route.ts line 340. Fix: add scope?: string to the token payload type
3. middleware.ts deprecation warning — should use proxy.ts only

## Transfer Technical Details
- Spotify endpoints: /playlists/{id}/items (read AND add) NOT /tracks; /me/playlists (create) NOT /users/{id}/playlists — see Critical Fix section
- Match rate: 100% on 34 songs, drops on larger playlists due to YouTube rate limiting
- Fallback search strategy: full title+artist → cleaned title+main artist → title only → ISRC
- Matching threshold: 0.45
- YouTube search rate limits after ~27 rapid searches
- Strips remaster/deluxe/anniversary tags from search queries
- Handles featuring artists in search

## Next Build Priorities
1. Fix YouTube rate limiting with exponential backoff
2. Fix Vercel TypeScript deployment error
3. Test large playlists 100+ songs successfully
4. YouTube Music to Spotify direction
5. Apple Music later — complex OAuth
6. Auto sync feature v2 — subscription model
7. Creator tools v3

## OAuth Configuration
- Spotify redirect URI: http://127.0.0.1:3000/api/auth/callback/spotify
- Spotify scopes: playlist-read-private, playlist-read-collaborative, playlist-modify-public, playlist-modify-private, user-library-read, user-read-email, user-read-private
- App is in Spotify development mode max 25 users
- YouTube Music OAuth also configured

## Product Decisions
- Platformless — no Syncly user accounts for MVP
- Single playlist transfer at a time
- Spotify to YouTube Music first
- One retry pass for failed tracks maximum
- Apple Music coming later
- No Extended Quota Mode needed yet

## Building In Public
- Live at synclyy.xyz
- Posting on LinkedIn and Twitter/X
- 6 posts published
- 18+ waitlist signups
- Next post: first successful transfer milestone — biggest post yet
- Compelling narrative: product designer building with AI

## CSS
- app/globals.css imports app/mobile.css for responsive styles
- Fully mobile responsive
- Safari webkit fixes applied