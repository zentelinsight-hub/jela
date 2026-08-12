# Jela AI

Jela AI is an intelligent companion built by Zentel Insight for learning, research, creation and practical problem-solving. This repository contains the production public website, native Android application, and Supabase control plane developed through Phases 1–4.

The website deliberately has no account, authentication, web chat, billing dashboard or theme switcher. Those capabilities live in the isolated native application under `mobile/`.

## Website setup

Requirements:

- Node.js 20 or newer
- npm
- Optional public Supabase configuration for live Android release metadata

Copy `.env.example` to `.env.local` and provide the public values for the existing Jela Supabase project. Never place a service-role key or another server secret in a `VITE_` variable.

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SITE_URL=https://www.jelaai.com.ng
VITE_GOOGLE_SITE_VERIFICATION=
```

Install and run locally:

```bash
npm install
npm run dev
```

Validate a production build:

```bash
npm run lint
npm run build
```

## Project structure

```text
src/
  components/       Shared navigation, footer, controls, docs shell and content UI
  data/             Product, FAQ and documentation navigation content
  lib/              Public release data access
  pages/            Standalone routed website pages
public/
  brand/            Official, unmodified Jela AI and Zentel Insight logos
  media/            Homepage video and mobile-only homepage slideshow assets
supabase/
  migrations/       Release metadata, native data model, RLS, credits and storage
  functions/        Authenticated server-only AI provider boundary
mobile/
  src/app/           Native Expo Router auth, user and admin route groups
  src/components/    Native UI, virtualized Chat and app shells
  src/services/      Supabase, streaming, release, billing and admin clients
```

All required routes are declared in `src/App.tsx`. `vercel.json` rewrites only those real application routes to `index.html`, so unknown public paths retain an actual HTTP 404. `public/_redirects` provides the private Sites-host fallback.

## Search and canonical deployment

The production canonical origin is `https://www.jelaai.com.ng`. Canonical tags, Open Graph metadata, Twitter metadata, `robots.txt`, `sitemap.xml`, favicons, and WebSite structured data are included. Callback pages, missing pages, and Vercel preview deployments are marked `noindex`.

For Google Search Console, set `VITE_GOOGLE_SITE_VERIFICATION` to the exact HTML-tag verification token in the production environment, deploy, then submit `https://www.jelaai.com.ng/sitemap.xml`. Do not set that token in source control.

## Official assets

The supplied source logos are not redrawn. Transparent Jela derivatives are generated from the official transparent source; the supplied Zentel Insight JPG deliberately retains its white background:

- Jela AI logo: `public/brand/jela-ai-logo.png`
- Zentel Insight logo: `public/brand/zentel-insight-logo.jpg`
- Desktop homepage video: `public/media/jela-hero.mp4`
- Mobile homepage backgrounds: `public/media/mobile/*.webp`

The video appears only on the homepage at tablet/desktop widths. The AI photographs transition only behind the homepage hero on mobile. Neither logo is used as a background image.

## Supabase relationship

This repository is configured for the existing Jela Supabase project. It does not create or reference a second project. Browser code uses only the public project URL and publishable key.

The release migration creates:

- `public.jela_ai_releases` for Android release metadata;
- a partial unique index so only one Android row can be current;
- public read access only to the current release row;
- the private `jela-ai-releases` Storage bucket with short-lived downloads for the current verified APK;
- no public upload, update or delete policies.

APK objects follow this versioned structure:

```text
jela-ai-releases/
  android/
    jela-ai-v1.1.0.apk
```

Release records retain previous versions for rollback. Publishing a release means uploading the real APK through a trusted server/admin process, calculating its SHA-256 checksum, creating the metadata row and transactionally moving `is_current` to the approved version. No fake APK is included in this repository.

When no current row exists—or public Supabase variables have not been provided—the download page reports that no verified public release is currently available. It never invents a release.

## Phase 2 native application

The native application is documented in [`mobile/README.md`](mobile/README.md). It uses Expo SDK 57 and React Native 0.86.2 with secure Supabase authentication, separate auth/user/admin route groups, native Chat, persistent conversation history, backend-authoritative credits and account states, backend-driven commerce states, private attachment architecture, update enforcement, and the existing APK release system.

Production capabilities remain server-authoritative. Live plan, account, feature, conversation, billing, release, appearance, avatar, and attachment state reconciles through scoped Supabase Realtime subscriptions plus foreground refresh. Local optimistic state rolls back on failed writes, and provider secrets never enter the client bundle.

Validate both products independently:

```bash
npm run lint
npm run build

cd mobile
npm run typecheck
npm run lint
npm run test
npx expo-doctor
```
