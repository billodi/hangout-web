# Hangout (Supabase Postgres + Vercel)

This is a Next.js app that stores activities in Postgres (Supabase).

## What You’re Building (Plain English)

- **Next.js** = your website (pages) + your backend (API routes) in one project.
- **Vercel** = hosts the Next.js app on the internet (serverless functions).
- **Supabase Postgres** = your database on the internet (managed for you).

In production, users open your site on Vercel, and the Vercel backend talks to Supabase Postgres using `DATABASE_URL`.

## Step 1: Install Tools (Windows)

Install Node.js LTS:

```powershell
winget install -e --id OpenJS.NodeJS.LTS
```

Install Git (needed for the easiest Vercel deploy):

```powershell
winget install -e --id Git.Git
```

When Windows asks for admin permission, accept it.

After installing, close and reopen your terminal.

## Step 2: Create a Supabase Project

1. Create a project in Supabase.
2. Go to **Project Settings -> Database -> Connection string**.
3. Copy the **Transaction pooler** connection string (best for serverless).

## Step 3: Configure Your Local App

Create a file named `.env.local` in this folder and set:

```env
DATABASE_URL="paste-your-supabase-transaction-pooler-url-here"
```

## Step 4: Create Tables (Drizzle)

This project uses Drizzle to manage the schema in `src/db/schema.ts`.

To create the `activities` table in Supabase:

```powershell
npm run db:push
```

## Step 5: Run Locally

```powershell
npm run dev
```

Then open the URL it prints (usually `http://localhost:3000`).

## Step 6: Deploy to Vercel

The simplest deploy path is GitHub -> Vercel:

1. Create a GitHub repo and push this `hangout-web` folder.
2. Import the repo in Vercel.
3. In Vercel project settings, add the same env var:
   - `DATABASE_URL` = your Supabase Transaction Pooler URL
4. Deploy.

## API Endpoints

- `GET /api/health`
- `GET /api/activities`
- `POST /api/activities` with JSON: `{ title, location, whenISO, type, limit }`
- `POST /api/activities/:id/join`
- `POST /api/activities/:id/leave`
- `DELETE /api/activities/:id`

