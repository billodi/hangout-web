# Hangout Web

Hangout Web is a social web app for discovering local activities, joining groups, chatting, and managing your profile.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Drizzle ORM + Drizzle Kit
- Neon Postgres (configured with `DATABASE_URL`)
- Leaflet + OpenStreetMap (map UI/data)
- Web Push notifications

## Features

- Map-first experience (`/map`) powered by OpenStreetMap
- Activity feed and community screens
- Create, join, leave, and waitlist activities
- Activity chat/messages
- User profiles, reviews, and gallery uploads
- Follow/block/report flows
- Admin routes for stats, users, reports, and activity moderation
- PWA support with web push subscription endpoints
- Google OAuth login flow

## Project Structure

```text
src/
  app/                  # App Router pages + API routes
  components/           # Shared UI and navigation components
  db/                   # Drizzle DB client and schema
  lib/                  # Auth, notifications, helpers, and utilities
drizzle/                # Migration artifacts
public/                 # Static assets
docs/                   # Project docs
```

## Requirements

- Node.js 20+
- npm 10+
- Neon Postgres database (or compatible Postgres)

## Environment Variables

Create `.env.local` in the project root:

Copy `.env.example` to `.env.local` and fill in values:

```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SITE_URL="https://your-domain.com"
GOOGLE_OAUTH_CLIENT_ID="..."
GOOGLE_OAUTH_CLIENT_SECRET="..."
METRICS_TOKEN="optional-secret-for-/api/metrics"
CLOUDINARY_URL="cloudinary://<api_key>:<api_secret>@<cloud_name>"
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
```

Notes:

- `DATABASE_URL` should point to your Neon Postgres instance.
- Google OAuth callback URL for local development:
  - `http://localhost:3000/api/auth/google/callback`
- Cloudinary is used for avatar/diary image uploads.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Apply schema to your database:

```bash
npm run db:push
```

3. Start development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) (it redirects to `/map`).

## Available Scripts

- `npm run dev` - Run local dev server
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test:e2e` - Run Playwright end-to-end suite
- `npm run test:e2e:ui` - Run Playwright UI mode
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema directly to DB
- `npm run db:studio` - Open Drizzle Studio

## API Overview

The app includes route handlers under `src/app/api`, including:

- Auth: login/signup/logout/me + Google OAuth start/callback
- Activities: list/create/update/delete, join/leave/check-in, waitlist, messages
- Feed, chats, profiles, follows, blocks, notifications, reports
- Uploads: avatar and diary media endpoints
- Admin: activities, users, stats, reports moderation
- Health: `GET /api/health`
- Metrics: `GET /api/metrics` (send header `x-metrics-token` when `METRICS_TOKEN` is configured)

## End-to-End Tests

Playwright tests live under `tests/e2e` and include:

- Public smoke checks (redirect/nav/core pages/health)
- Authenticated two-user flow:
  signup/login, activity create/join/leave, and chat message exchange

Run with:

```bash
npm run test:e2e
```

## Deployment

Deploy on Vercel (recommended) or any platform that supports Next.js:

1. Push the repo and import it in Vercel.
2. Set environment variables from `.env.example` in the Vercel project settings.
3. Run `npm run db:push` against your production Neon database (or apply migrations in CI).
4. Configure production Google OAuth callback:
   - `https://your-domain.com/api/auth/google/callback`
5. Set `NEXT_PUBLIC_SITE_URL` to your production domain for correct metadata and links.
6. Install Playwright browsers locally before running e2e tests:

```bash
npx playwright install chromium
npm run test:e2e
```

Production build:

```bash
npm run build
npm run start
```

## Security Notes

- Do not commit real secrets in `.env.local`.
- If credentials were exposed, rotate database/API/OAuth secrets immediately.
