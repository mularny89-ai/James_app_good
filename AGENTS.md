# Mellan Practice Manager — Agent Context

Practice-management app for **Mellan Consulting Engineers** (structural engineering consultancy, https://mellanconsulting.com.au).

## Stack & Layout

- Next.js 14 App Router + Prisma 5.22 (SQLite at `prisma/dev.db`) + Tailwind
- Pages: `src/app/{dashboard,jobs,clients,tasks,inspections,calendar,quotes,invoices,settings,search,reports}/`
- Server actions: `src/lib/actions/*.ts`; helpers: `src/lib/{db,settings,numbering,format,activity,constants}.ts`
- Shared components: `src/components/*.tsx`

## Run / Build

```bash
npm install
npx prisma db push        # create schema (first run / after schema change)
node prisma/seed.mjs      # seed statuses, types, lists, branding (first run)
npm run build             # production build (must pass before shipping)
npm run start             # production server on port 12000
```

In the OpenHands runtime, port 12000 is reachable at the work-1 forwarded URL; port 12001 is the work-2 URL (spare).

## Brand

- Deep indigo-blue `#34368b`; logo at `public/uploads/branding/default-logo.webp`
- App title: "Mellan Practice Manager"

## Conventions & Gotchas

- **Server actions passed to client components must be module-level.** Never pass an inline `"use server"` closure that captures Prisma models (e.g. a `statuses` array) — serialization fails with "Functions cannot be passed directly to Client Components". Bind plain ids instead (see `moveJobById` in `src/lib/actions/jobs.ts`).
- Numbering: quotes `Q-YY###`, invoices `INV-YY####`, jobs `YY###` as integer — formats live in Settings, helpers in `src/lib/numbering.ts`.
- All mutations write to the activity audit trail via `logActivity` (`src/lib/activity.ts`).
- Quote → job conversion uses the "Accept & Create Job" action in `src/lib/actions/quotes.ts`.
- Job/inspection/invoice forms inherit from the parent job via `?jobId=` and key-based remount.

## Current State (as of commit 5769ba6)

- All 8 phases complete: Jobs, Clients, Tasks (To Do-style), Inspections, Calendar, Quotes, Invoicing, Settings + Search/Reports.
- Production build passes; full workflow verified (client → quote → accept → job → task → inspection → invoice → payment → completed), activity trail confirmed.
- Branch `engineering-app` on GitHub `mularny89-ai/James_app_good`.
- Demo data in dev DB: client John Smith (ABC Constructions), job 26001, quote Q-26001, paid invoice INV-260001.
