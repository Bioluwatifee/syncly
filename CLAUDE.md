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
- /transfer — transfer page (main product) — gated, see Deployment section
- /privacy — privacy policy (YouTube API compliance)
- /terms — terms of use (YouTube API compliance)

## Key Files
- app/transfer/page.tsx — transfer page UI and state management
- app/api/transfer/route.ts — core transfer logic (both directions)
- app/api/transfer/progress/route.ts — live progress polling endpoint
- app/api/transfer/cancel/route.ts — cancel a running transfer
- app/api/spotify/route.ts — Spotify API calls (GET read/search + POST create/add)
- app/api/youtube/route.ts — YouTube Music API calls
- app/api/auth/route.ts — OAuth handling
- app/api/auth/callback/spotify — Spotify OAuth callback
- lib/matcher.ts — platform-agnostic normalization + similarity scoring
- lib/transfer-progress.ts — in-memory progress store (see Known Limitation)
- lib/oauth-session.ts — server-side platform session store
- lib/security.ts — security middleware
- proxy.ts — route gating (replaced middleware.ts)
- components/transfer/PlatformSelector.tsx
- components/transfer/PlaylistList.tsx
- components/legal/LegalPageLayout.tsx — shared /privacy + /terms layout

## Current State — What Works
- Spotify to YouTube Music transfer works end to end
- YouTube Music to Spotify transfer works end to end (confirmed 8/8 tracks)
- 34 song playlist at 100% match rate; 117 songs at 94% in ~6 min
- OAuth working for both Spotify and YouTube Music
- All transfer UI states built (transferring, success, partial, error)
- Cancel transfer feature implemented
- Live progress tracking during transfer (local only — see Known Limitation)
- Mobile responsive
- Live on Vercel at synclyy.xyz
- /privacy and /terms pages live, linked in footer
- YouTube branding compliant — official unmodified icon asset from brand.youtube

## YouTube Music to Spotify (reverse direction)
WORKING — confirmed end to end at 8/8 tracks. Reuses the forward direction's logic.
Not yet exercised on a large playlist, so the quota/timeout ceilings that affect the
forward direction are unproven here.

How it works:
- Source read: internal GET /api/youtube?resource=tracks
- Candidate search: GET /api/spotify?resource=search (same matcher, same 0.45 threshold, same fallback chain)
- Destination: POST /api/spotify?resource=createPlaylist then per-track addPlaylistItem
- Swap arrow in PlatformSelector flips From/To (previously decorative, now wired via onSwap)
- Progress + results screens are shared with the forward direction, no separate code

Reverse-direction gotchas:
- YouTube track metadata is thinner than Spotify's: durationMs is 0 (no duration tiebreaker),
  no ISRC (loses the exact-match last resort), and artist is the channel name.
  "- Topic" and "VEVO" suffixes are stripped on read. Expect a lower match rate than forward.
- Spotify create needs no user id (POST /me/playlists) — see Critical Fix section
- Spotify accepts up to 100 URIs per add call; we add one per call to keep
  per-track success/fail semantics identical to the forward direction. Batching is a
  possible later optimization.

## Critical Fix — Spotify Silent Endpoint Deprecations
Spotify silently restricts legacy endpoints for newer apps. The symptom is always the same: a bare 403 Forbidden with no detail in the response body, while the token, scopes, and user ID are all confirmed correct. It is NOT an auth-expiry problem, and refreshing the token never fixes it (a refresh preserves the original grant's scopes).

Three instances hit so far, all fixed by switching to the newer endpoint form:

1. Read playlist tracks: POST/GET /playlists/{id}/tracks → /playlists/{id}/items
2. Create playlist: POST /users/{id}/playlists → POST /me/playlists (no user ID in path; targets the authenticated user directly)
3. Add tracks to playlist: POST /playlists/{id}/tracks → POST /playlists/{id}/items (same uris body)

Rule of thumb: when a Spotify call returns a bare 403 and auth is verified good, check developer.spotify.com for a newer form of that endpoint (usually /me/... instead of /users/{id}/..., or /items instead of /tracks) before debugging auth any further. Do not trust model training data on which Spotify endpoint is current — check the live docs.

Error handling note: 401 and 403 must stay separate. 401 = genuinely expired session ("reconnect" is correct). 403 = permission/endpoint problem — mapping it to 401 both shows a misleading "session expired" message and triggers a pointless refresh-and-retry.

## Current Bugs To Fix
1. YouTube rate limiting on large playlists. Current handling: 300ms delay between tracks,
   one 3s retry on 429, plus a post-pass retry queue (5s gaps) for rate-limited searches.
   Diagnostic logging is in place — filter logs for "instrument" and whichever fires first
   tells you which ceiling was hit:
   - [youtube:instrument] internal per-minute rate cap hit  → our own self-imposed 45/min cap
   - [youtube:instrument] 429 from Google — raw response body → Google's limit, with the real
     reason field (quotaExceeded vs rateLimitExceeded vs userRateLimitExceeded)
   - [transfer:instrument] approaching 5-minute function timeout → Vercel maxDuration (300s)
   IMPORTANT: the 45/min cap in app/api/youtube/route.ts was picked arbitrarily, NOT measured.
   YouTube Data API bills by daily quota units, not requests/min — search.list costs ~100 units
   against a ~10,000/day default, so ~100 searches/day total. With 3-4 fallback searches per
   track that is roughly 25-30 tracks/day, which matches the observed cutoff. Raising the
   45/min cap will not help if the real wall is the daily unit quota. Verify in Google Cloud Console.

RESOLVED (kept for context):
- Vercel TypeScript 'scope' error — fixed, scope?: string added in app/api/auth/route.ts
- middleware.ts deprecation — file removed, proxy.ts is the only one now

## Transfer Technical Details
- Spotify endpoints: /playlists/{id}/items (read AND add) NOT /tracks; /me/playlists (create) NOT /users/{id}/playlists — see Critical Fix section
- Match rate: 100% on 34 songs; 94% on 117 songs. Drops on larger playlists due to YouTube quota/rate limits
- Fallback search strategy: full title+artist → cleaned title+main artist → title only → ISRC
- Matching threshold: 0.45 (0.38 in relaxed/retry mode), plus a best-effort floor of 0.35
  when title similarity is at least 0.55, so a live/video-only copy still matches
- Scoring: title weighted 0.75, artist 0.25; duration is a soft signal only (never a hard reject)
- Karaoke and tribute versions are always rejected; live/remix only when title score is weak
- Strips remaster/deluxe/anniversary tags from search queries
- Handles featuring artists in search
- Max 250 tracks per transfer (MATCH_LIMIT in app/api/transfer/route.ts)
- Vercel function limit: maxDuration 300s

## Known Limitation — progress store is per-instance
lib/transfer-progress.ts is an in-memory Map. Locally the transfer POST and the progress GET
share one process, so live per-track updates work. On Vercel they are separate serverless
instances with separate memory, so the progress poll cannot see what the POST wrote.

Consequence: the aggregate counts and the final per-track list still work in production,
because both come from the POST response payload (trackResults is included in the response
body for exactly this reason). But the live song-by-song list updating DURING a long transfer
will not stream on Vercel. A real fix needs a shared store (Vercel KV / Supabase).

## Next Build Priorities
1. Resolve the YouTube quota ceiling — confirm in Google Cloud Console whether the wall is
   the daily unit quota or a per-minute rate limit, then either request a quota increase or
   reduce searches per track. Do not just raise the 45/min cap without checking.
2. Add real API credentials to the Vercel project so production is functional (see Deployment)
3. Shared progress store (Vercel KV / Supabase) for live progress in production
4. Apple Music — complex OAuth
5. Auto sync feature v2 — subscription model
6. Creator tools v3

## Deployment
- Vercel project name is "tuneshift" (NOT "syncly"), team bioluwatifees-projects → synclyy.xyz
- The Vercel project currently has ZERO environment variables set in any environment.
  All Spotify/YouTube credentials live only in local .env.local. Production therefore cannot
  call either API. Verified via `vercel env ls`.
- /transfer is gated in proxy.ts: it redirects to / unless the request hostname is
  localhost/127.0.0.1, or TRANSFER_PUBLIC=true. The gate keys off REQUEST HOSTNAME, not your
  machine — so synclyy.xyz/transfer redirects even from the dev machine.
- To make production /transfer actually work: set TRANSFER_PUBLIC=true, add all .env.local app
  vars to Vercel, AND register production redirect URIs (https://synclyy.xyz/...) in both the
  Google and Spotify consoles. Right now both are pinned to 127.0.0.1:3000.
- Local dev: always use http://127.0.0.1:3000, never localhost — the Spotify redirect URI is
  pinned to 127.0.0.1 and switching was a hassle. Do not change it.
- `vercel link` appends VERCEL_OIDC_TOKEN to .env.local and adds an overly broad `.env*` to
  .gitignore — strip both back out afterward.

## OAuth Configuration
- Spotify redirect URI: http://127.0.0.1:3000/api/auth/callback/spotify
- Spotify scopes: playlist-read-private, playlist-read-collaborative, playlist-modify-public, playlist-modify-private, user-library-read, user-read-email, user-read-private
- App is in Spotify development mode max 25 users
- YouTube Music OAuth also configured

## Product Decisions
- Platformless — no Syncly user accounts for MVP
- Single playlist transfer at a time
- Spotify to YouTube Music first, YouTube Music to Spotify second
- One retry pass for failed tracks maximum
- Apple Music coming later (listed as "Coming soon" in the platform dropdown)
- Extended Quota Mode not requested yet — but see Current Bugs, the daily unit quota is
  the likely large-playlist blocker

## Branding Compliance (YouTube)
Google rejected two earlier attempts, so do not regress this:
- Use ONLY the official unmodified asset at public/platform-logos/youtube-icon-official.png,
  downloaded from brand.youtube (Core YouTube icon, full-color red on transparent)
- Never recolor it, never reconstruct it as an inline SVG path, never wrap it in a colored
  tile, never invert it. An SVG redraw of the play button is what got rejected.
- Minimum 20px tall everywhere. Place it directly on the #0f0f0f background.
- Used in: Hero "Works with" pill, PlatformSelector input + dropdown, transfer result header
- The "YouTube Music" text label sits beside the icon as separate text, matching how the
  Spotify wordmark reads — the icon itself carries no text

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