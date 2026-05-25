# Syncly Project Handoff

## 1) Product Overview
Syncly is a playlist migration tool focused on moving playlists between streaming platforms, with Spotify -> YouTube Music as the primary launch path. The landing page is currently waitlist-first, while `/transfer` contains the migration UX.

## 2) Current Architecture
- Framework: Next.js App Router (TypeScript)
- UI: React components + global CSS (`app/globals.css`, `app/mobile.css`) with inline `style` props in JSX
- API: Next.js route handlers under `app/api/*`
- Auth/session model: OAuth tokens stored in secure, HTTP-only cookies per provider
- Data/state today: Mostly runtime/in-memory + provider APIs; no production Supabase schema wired yet

High-level flow:
1. User connects source/destination platform via `/api/auth`
2. `/api/{spotify|youtube}` fetches playlists/tracks/search results
3. `/api/transfer` prepares match results using `lib/matcher.ts`
4. Transfer page renders empty/connected/transferring/success/partial/error states

## 3) Important Services / Modules
- `app/transfer/page.tsx`: Main transfer UI/state machine, platform connect/disconnect, playlist selection, transfer states
- `app/api/auth/route.ts`: OAuth start/callback/disconnect orchestration for Spotify + YouTube
- `app/api/spotify/route.ts`: Spotify proxy endpoints (playlists, tracks, search, track counts), token refresh, error mapping
- `app/api/youtube/route.ts`: YouTube proxy endpoints (playlists, tracks, search), token refresh, error mapping
- `app/api/transfer/route.ts`: Transfer-prep endpoint (source track fetch + target search + matching)
- `lib/matcher.ts`: Track normalization + fuzzy scoring + best-match logic
- `lib/security.ts`: In-memory rate limiting + same-origin mutation guard
- `proxy.ts`: Route gate for `/transfer` based on env (`TRANSFER_PUBLIC`)
- `next.config.mjs`: Security headers/CSP + allowed image hosts
- `lib/supabase.ts`: Supabase clients (configured, not yet fully used)

## 4) Key Technical Decisions and Rationale
- Waitlist-first launch with hidden transfer route in production (`TRANSFER_PUBLIC`): reduce public blast radius while validating core UX.
- Cookie-based OAuth token handling (HTTP-only, same-site): avoids exposing provider tokens to frontend JS.
- API proxy pattern for provider calls: centralizes token refresh, retries/timeouts, and provider-specific error normalization.
- Same-origin checks on mutations + per-endpoint rate limits: baseline abuse protection before full backend hardening.
- Separate mobile stylesheet (`app/mobile.css`): avoids component-level `<style>` hydration issues seen earlier.
- Transfer preparation split from playlist browsing: allows incremental rollout of matching before full write/create operations.

## 5) Current Implementation Status
- Implemented:
  - Landing page and full transfer UI
  - Spotify + YouTube OAuth connect flow and cookie session handling
  - Playlist/track loading from Spotify and YouTube APIs
  - Transfer preparation and fuzzy match reporting
  - Security headers, route gating, and basic rate limiting
- Not yet implemented end-to-end:
  - Real destination playlist creation/write pipeline (production-grade migration completion path)
  - Supabase schema and persisted transfer history/sessions
  - Apple Music integration (stub only)

## 6) Active Bugs / Issues
- Placeholder failure reasons still shown in parts of transfer result UI (`app/transfer/page.tsx` TODOs).
- Retry action in transfer error/partial paths is not wired to a real backend retry call (`app/transfer/page.tsx`, TODO).
- In-memory rate limiter in `lib/security.ts` is process-local and resets on restart; not durable for multi-instance/serverless scaling.

## 7) Pending Roadmap / TODOs
1. Finalize Spotify OAuth hardening and edge-case handling across refresh/account switch scenarios.
2. Complete YouTube write path (create playlist + add matched tracks) for true end-to-end transfer.
3. Add Supabase schema and persist transfer sessions/results/history.
4. Replace UI placeholders with real backend/API failure details.
5. Implement Apple Music integration beyond current stub.
6. Decide when to expose `/transfer` publicly from landing page.

## 8) Important Commands / Workflows
- Install: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Production build: `npm run build`
- Start prod server locally: `npm run start`

Suggested local verification workflow:
1. Start app with `npm run dev`
2. Validate `/` layout + responsiveness
3. Validate `/transfer` connect/disconnect flow for Spotify/YouTube
4. Validate playlist fetch, track fetch, and transfer preparation response behavior

## 9) Environment Assumptions
Required env vars (from `.env.example`):
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Spotify OAuth: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
- YouTube OAuth: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`
- Apple placeholders: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
- App/Auth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Route visibility toggle expected by middleware: `TRANSFER_PUBLIC`

Operational assumptions:
- HTTPS in production for secure cookies
- OAuth redirect URIs must exactly match provider console settings
- CSP/connect-src currently allows Spotify + Google OAuth/API domains

## 10) Recent Major Features and Why They Were Built
- `3ca1f6f` (2026-05-22) - Transfer page UX updates:
  - Added smarter reconnect behavior when a platform is already authorized
  - Prevented selecting identical source/destination platforms
  - Added soft-disconnect flow for faster reconnect without forced reauth
  - Problem solved: users were hitting confusing auth loops and invalid transfer setups, causing avoidable friction.

- `6bebfd6` (2026-05-21) - Safari rendering/hydration stabilization:
  - Problem solved: local Safari rendering/hydration inconsistencies affecting reliability of transfer UI behavior.

## 11) Areas of Technical Debt or Risk
- Transfer orchestration is still UI-heavy in `app/transfer/page.tsx`; state complexity is growing.
- Matching uses a simple heuristic (`lib/matcher.ts`); may produce false positives/negatives on noisy metadata.
- No persistent/centralized rate-limit store yet (Redis/Upstash/etc.), weakening abuse controls at scale.
- Supabase is configured but not yet used for authoritative transfer state; observability/auditability gap.
- Apple route is placeholder, so multi-destination narrative is ahead of implementation.
