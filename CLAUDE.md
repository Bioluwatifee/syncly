# Syncly — CLAUDE.md

This file gives Claude context about the Syncly codebase. Read this before making any changes.

---

## Project

**Syncly** is a playlist migration tool that moves playlists between streaming platforms. Spotify → YouTube Music is the first supported direction.

Built in public by Boluwatife Ayodeji. Follow the journey on [LinkedIn](https://www.linkedin.com/in/ayodeji-boluwatife/).

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + inline styles (design system via CSS variables)
- **Language**: TypeScript
- **Deployment**: Vercel
- **Repo**: GitHub → `syncly`

---

## Fonts

All loaded via `<link>` tags in `app/layout.tsx` from Google Fonts:

- **Calligraffitti** — decorative handwritten headings on `/transfer` page only: "Welcome, stranger…", "Lets move some music!", "Platform selector", "Your Playlists", "Migrating playlist…"
- **Aleo** — all headings and display text on the landing page and everywhere else
- **DM Sans** — body text, buttons, labels, all UI elements
- **DM Mono** — monospace use cases
- **Caveat** — loaded but not actively used

> ⚠️ Calligraffitti must NOT appear anywhere on the landing page.

---

## Design System

- **Page background**: `#0f0f0f`
- **Card background**: `#131316`
- **Accent (gold/yellow)**: `#e8c547` — headings on /transfer, CTAs, active states
- **Accent 2 (coral)**: `#e85f47` — gradient progress bars, error states
- **Platform colors**: Spotify `#1ed760`, YouTube `#ff4444`, Apple `#fc3c44`
- **Muted text**: `#6b6870`
- **Body text**: `#f0ede8`
- **Syncly logo**: `/public/favicon-96x96.png` — used in Navbar and Footer

---

## Pages

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Landing page — Navbar, Hero, DemoSection, StepsSection, EarlyAccessSection, Footer |
| `/transfer` | `app/transfer/page.tsx` | Transfer UI — not linked from landing page yet (site is in waitlist phase) |

---

## Components

| File | Purpose |
|---|---|
| `components/layout/Navbar.tsx` | Fixed top nav with scroll-triggered frosted glass, hamburger menu on mobile |
| `components/layout/Footer.tsx` | Footer with logo, "Built in public by Boluwatife Ayodeji" note, X/Twitter + Privacy links |
| `components/sections/Hero.tsx` | Landing page hero — headline, CTA buttons, platform pills with brand SVG icons |
| `components/sections/DemoSection.tsx` | Static transfer UI preview matching /transfer page design |
| `components/sections/StepsSection.tsx` | 3-step how-it-works cards with scroll-triggered animations |
| `components/sections/EarlyAccessSection.tsx` | Early access CTA linking to Tally.so form |
| `components/transfer/PlatformSelector.tsx` | From/To platform dropdowns — stacks vertically on mobile, connected/connecting/connected states |
| `components/transfer/PlaylistList.tsx` | Scrollable playlist list with selection state, max-height 360px |
| `app/transfer/page.tsx` | Full transfer page — platform selector, playlist list, transfer button |

---

## Transfer Page States

The `/transfer` page renders different UI based on real connection state. The result states (Transferring, Success, Partial Match, Error) are built as component functions and ready to wire up:

| State | When shown |
|---|---|
| Empty | No platform connected |
| Connected | Platform(s) connected, playlist selected |
| Transferring | `TransferringState` — track list with ✓/✗, progress bar |
| Success | `SuccessState` — all songs migrated |
| Partial | `PartialState` — some songs failed |
| Error | `ErrorState` — full failure, try again |

> The DEV state switcher has been removed. States are now driven by real connection state.

---

## Current State

**Full UI complete — no real API connections yet.**

- Mock playlists and tracks are hardcoded in `app/transfer/page.tsx`
- `lib/spotify.ts` has wrapper functions written but not wired up
- `lib/matcher.ts` has track fuzzy-matching logic ready
- API route stubs exist at `app/api/auth/`, `app/api/spotify/`, `app/api/youtube/`, `app/api/apple/`
- Supabase clients configured in `lib/supabase.ts` but no schema/tables yet

---

## What's Next

1. **Spotify OAuth** — wire up `app/api/auth/` with real redirect + token exchange
2. **Fetch real playlists** — replace mock data with live Spotify API call
3. **YouTube Music integration** — OAuth + playlist creation via YouTube Data API
4. **Supabase schema** — store transfer history, sessions
5. **Link /transfer from landing page** — currently in waitlist phase

---

## CSS Architecture

- `app/globals.css` — base styles, CSS variables, animations
- `app/mobile.css` — all responsive/mobile styles, imported by `globals.css`
- Inline `style` props used throughout components (no Tailwind utility classes in JSX)
- Media queries for layout changes live in `mobile.css`, not in component `<style>` tags (to avoid hydration mismatches)

---

## Design Decisions

- **Platformless**: no Syncly accounts. Users authenticate directly with each streaming service via OAuth.
- **Single playlist at a time**: one playlist per transfer session.
- **Spotify → YouTube Music first**: primary supported direction at launch. Apple Music is next.
- **Mobile responsive**: all pages work at 375px minimum width.
- **No inline `<style>` tags in components**: caused hydration errors — all global CSS lives in `mobile.css`.
- **Built in public**: progress documented on LinkedIn and X/Twitter.
