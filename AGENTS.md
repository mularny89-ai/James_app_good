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

## Current State (as of commit 5018730, pushed to origin/engineering-app 2026-08-20)

All of the 5769ba6 state, plus a completed user "update request" (16 items), all browser-verified:

- **Job address fields split**: `Job` model has `siteStreet/siteSuburb/siteState/sitePostcode`; `siteAddress` kept as legacy combined field with `splitAddress` fallback in `src/lib/actions/jobs.ts`. New/edit job forms have separate inputs; state no longer defaults to QLD. Display format: "14 Example Street, Broadbeach" (no state in common display).
- **Inspections**: `src/components/InspectionForm.tsx` uses `SearchableSelect` job picker (search by job №/address/suburb/client) with auto-populate of client/address/contact, "No Job / manual address" option, `returnTo` support. Actions in `src/lib/actions/inspections.ts`: success redirect w/ confirmation message, `logActivity` entries (scheduled/completed w/ date/time), `setInspectionStatus`, `rescheduleInspection`, `deleteInspection`.
- **Calendar**: `src/components/CalendarView.tsx` — `CalEvent {id, kind: "inspection"|"task"|"job", ...}`; event blocks show type/time/job №/address; "+ Schedule Inspection" links to `/inspections/new?from=calendar`; drag-to-reschedule inspections.
- **Tasks**: Completed folder (`src/app/tasks/page.tsx`, `isCompletedView = view === "list" && activeList.name === "Completed" && !filter`) shows all completed tasks across lists; reopening restores the task to its original list.
- **Finances section**: `/finances` (redirects to `/finances/quotes`) with Quotes/Invoices tabs (`src/components/FinancesTabs.tsx`); legacy `/quotes` and `/invoices` URLs unchanged and still work. Sidebar has a Finances nav item; dashboard cards link there.
- **Jobs**: new jobs default to status "To Start"; jobs list shows merged "Project / Address" column. New-quote form has no Project field.

## User Preferences (from update request)

- Numbered fix lists — implement in place, do NOT rebuild or duplicate pages; preserve existing structure.
- Verify changes in the browser before reporting; clean up test data afterwards.
- Commit with Co-authored-by: openhands <openhands@all-hands.dev>; push to `engineering-app` only when asked.
