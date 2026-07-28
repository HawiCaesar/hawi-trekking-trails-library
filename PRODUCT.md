# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Hawi (owner) — maintains a personal hiking archive: connects Strava, imports hikes into a local database, and enriches each activity with trail notes and metadata.

**Secondary:** Visitors — browse the public gallery of imported hikes (list and detail with maps and stats) without signing in. They cannot import from Strava or edit notes.

## Product Purpose

Hawi's Hikes is a personal library of completed hikes that the owner controls independently of Strava. Success means every meaningful hike lives in the owner's database with accurate GPS, stats, and remembered context (conditions, difficulty, gear, companions, ratings), while remaining easy to share as a read-only gallery for others.

## Positioning

Three jobs, one product:

1. **Curated personal memory** — hikes and routes are stored in the owner's PostgreSQL database, not only on Strava.
2. **Shareable portfolio** — friends and family can explore where Hawi has hiked via maps and detail pages without needing Strava accounts.
3. **Planning reference** — structured fields and notes support revisiting trails (conditions, difficulty, gear) before repeating or recommending a hike.

The mechanism neighbors cannot copy truthfully: import selected Strava activities with stream GPS into a owned archive, then layer a private trail journal on top of that data.

## Operating Context

- **Owner workflow:** sign in with password → connect Strava OAuth → import activities from Strava list → open detail → view 2D route, 3D flyover, elevation profile → edit and save annotation fields.
- **Visitor workflow:** browse `/activities` → search and sort → open hike detail → view stats and maps (read-only).
- **Environment:** local dev via `npm run dev`; production on Railway. Strava API app with callback domain configured per environment.
- **Locale signals:** distances formatted in kilometres; dates on detail use `en-GB` long formatting.

## Capabilities and Constraints

**Confirmed functionality**

- Strava OAuth and token refresh stored in `Settings`; activity import with GPS streams in `Activity.gpsData`.
- Activity list: search, sort (date, distance, elevation).
- Activity detail: distance, moving time, elevation gain, pace; 2D map (Leaflet), 3D flyover (Mapbox GL), elevation chart (Recharts).
- Owner-only annotation: difficulty, trail conditions, weather, freeform notes, 1–5 rating, companions, gear.
- Session-based owner gate (`isOwner`); public read for imported activities.

**Technical constraints**

- React Router v7 (SSR), Prisma 7 + PostgreSQL, Tailwind CSS v4.
- Requires `DATABASE_URL`, `SESSION_SECRET`, Strava client credentials; owner auth via `ADMIN_PASSWORD_HASH` (bcrypt).

**Terminology**

- User-facing hikes/activities; repository name *Trails Archive*; canonical product name **Hawi's Hikes** (see Brand Commitments).

**Undecided**

- Whether the product will ever support multiple owners or accounts (currently single-owner by design).

## Brand Commitments

- **Canonical name:** Hawi's Hikes (confirmed for future product copy).
- **Incumbent copy to reconcile later:** login screen uses "HawiTrekkTrails"; list heading already uses "Hawi's Hikes"; README title is "Trails Archive". Future copy work should align on Hawi's Hikes without inventing new positioning.
- **Voice:** personal, direct, outdoor/trail context; not a generic SaaS marketing site.

## Evidence on Hand

- README and in-repo screenshots: `hike-list.png`, `hike-detail.png`.
- Live product data from owner's Strava imports (no fabricated testimonials, case studies, or third-party press).
- Do not invent hike counts, athlete credentials, or deployment URLs not present in repo or env docs.

## Product Principles

1. **Own the archive** — Strava is a source; the database is the durable record the owner curates.
2. **Show the trail** — maps and elevation are first-class, not an appendix to a table row.
3. **Remember what Strava forgets** — conditions, gear, companions, and subjective rating belong on the hike, not in a generic activity feed.
4. **Public by default for reading** — sharing the gallery should not require visitor accounts.
5. **Single-owner honesty** — auth and import tools serve one maintainer until multi-user scope is explicitly chosen.

## Accessibility & Inclusion

- System `prefers-color-scheme` dark mode is supported in layout styling.
- Map views use tab roles and labels on the 2D/3D toggle; no product-specific WCAG target confirmed beyond sensible web defaults.
