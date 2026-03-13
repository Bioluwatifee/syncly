# Syncly — CLAUDE.md

This file gives Claude context about the Syncly codebase. Read this before making any changes.

---

## Project

**Syncly** is a playlist migration tool that moves playlists between streaming platforms (Spotify, YouTube Music, Apple Music).

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + inline styles (design system via CSS variables)
- **Language**: TypeScript
- **Database**: Supabase (configured, no tables yet)
- **Deployment**: Vercel
- **Repo**: GitHub → `syncly`

---

## Fonts

Loaded via `<link>` tags in `app/layout.tsx` from Google Fonts:

- **Calligraffitti** — decorative/handwritten headings (e.g. "Welcome, stranger…", "Platform selector", "Your Playlists")
- **Caveat** — secondary handwritten labels (available but mostly replaced by Calligraffitti)
- **DM Sans** — body text, buttons, UI labels
- **DM Mono** — monospace use cases

---

## Design System

- **Background**: `#0f0f0f` (page), `#131316` (card)
- **Accent**: `#e8c547` (gold/yellow) — used for headings, CTAs, active states
- **Accent 2**: `#e85f47` (coral/red) — used in gradient progress bars, error states
- **Platform colors**: Spotify `#1ed760`, YouTube `#ff4444`, Apple `#fc3c44`
- **Handwritten labels**: always Calligraffitti, `rgba(255,255,255,0.5)` color
- **Buttons**: pill shape (`border-radius: 100`), white outlined or yellow filled
- **No Syncly accounts** — platformless by design, no login/signup flow

---

## Pages

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Landing page — hero, how it works, early access CTA |
| `/transfer` | `app/transfer/page.tsx` | Transfer UI — platform selector, playlist list, all transfer states |

---

## Components

| File | Purpose |
|---|---|
| `components/transfer/PlatformSelector.tsx` | From/To platform dropdowns with Connect buttons built into the input |
| `components/transfer/PlaylistList.tsx` | Playlist grid with selection state and gold border on selected item |
| `components/layout/Navbar.tsx` | Top nav with scroll-triggered frosted glass |
| `components/layout/Footer.tsx` | Footer with LinkedIn/GitHub links |
| `components/layout/CustomCursor.tsx` | Gold custom cursor with lagging ring |
| `components/sections/Hero.tsx` | Landing page hero section |
| `components/sections/DemoSection.tsx` | Transfer card mockup on landing page |
| `components/sections/StepsSection.tsx` | 3-step how-it-works cards |
| `components/sections/EarlyAccessSection.tsx` | Tally.so early access CTA |

---

## Transfer Page States

The `/transfer` page has 6 UI states, switchable via a DEV bar at the top (remove before launch):

| State | Description |
|---|---|
| `empty` | No platform selected, playlists area empty |
| `connected` | Platform selected + connected, playlists loaded, Transfer button active |
| `transferring` | Migration in progress — track list with ✓/✗ icons, progress bar |
| `success` | All songs migrated — success message, platform logos, two action buttons |
| `partial` | Some songs failed — count summary, failed tracks listed, two action buttons |
| `error` | Complete failure — error message, playlist shown, Try again + Migrate new buttons |

---

## Current State

**UI only — no real API connections yet.**

- Mock playlists and tracks are hardcoded in `app/transfer/page.tsx`
- `lib/spotify.ts` has wrapper functions written but not wired up
- `lib/matcher.ts` has track fuzzy-matching logic ready
- API route stubs exist at `app/api/auth/`, `app/api/spotify/`, `app/api/youtube/`, `app/api/apple/`
- Supabase clients configured in `lib/supabase.ts` but no schema/tables created yet

---

## What's Next

1. **Spotify OAuth** — wire up `app/api/auth/` with real redirect + token exchange
2. **Fetch real playlists** — replace mock data in `/transfer` with live Spotify API call
3. **YouTube Music integration** — OAuth + playlist creation via YouTube Data API
4. **Supabase schema** — store transfer history, user sessions
5. **Apple Music** — marked "Coming soon" in the platform dropdown

---

## Design Decisions

- **Platformless**: no Syncly accounts, no login. Users authenticate directly with each streaming service.
- **Single playlist at a time**: one playlist per transfer session, keeps the UX focused.
- **Spotify → YouTube Music first**: the primary supported transfer direction at launch. Apple Music is next.
- **Built in public**: progress documented on LinkedIn.
