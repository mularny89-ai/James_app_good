# Mellan Practice Manager — Agent Context

Practice-management app for **Mellan Consulting Engineers** (structural engineering consultancy, https://mellanconsulting.com.au).

## Stack & Layout

- Next.js 14 App Router + Prisma 5.22 (SQLite at `prisma/dev.db`) + Tailwind
- Pages: `src/app/{dashboard,jobs,clients,tasks,inspections,calendar,quotes,invoices,settings,search,reports,planner}/`
- Server actions: `src/lib/actions/*.ts`; helpers: `src/lib/{db,settings,numbering,format,activity,constants,planner}.ts`
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

## Job Planner module (added 2026-08-20, uncommitted on engineering-app)

Visual workload scheduler/Gantt for Jobs at `/planner`:

- **Schema**: `Job` gained `plannedStartDate`, `plannedEndDate`, `plannedDuration Int?`, `durationUnit String @default("working")` ("working"|"calendar"), `plannerColor String @default("")`, `plannerSortOrder Int @default(0)`, `unscheduledOrder Int @default(0)`.
- **`src/lib/planner.ts`**: working-day maths (`addDuration`, `durationBetween`, `nextWorkingDay` — start day counts as day 1, weekends skipped for "working" unit), `PLANNER_PALETTE` + `assignPlannerColor` (least-used palette colour), `planningStatus` (completed/unscheduled/scheduled/starting-today/in-period/overdue), view windows (`viewWindow`, `stepAnchor`, `VIEW_COL_W`), wrapped-layout helpers (`barSegments` — splits working-day bars over weekends; `chunkWeeks` — Monday-aligned weeks).
- **Wrapped views (Month / 6 Weeks / 3 Months)**: `viewWindow` pads these to Monday-start whole weeks; `src/components/PlannerWrappedView.tsx` has dedicated renderers `PlannerMonthView` / `PlannerSixWeekView` / `PlannerThreeMonthView` (shared `WrappedGrid`) — each job row is a stack of 7-column Mon–Sun week rows, bars split at week boundaries with ◂▸ continuation markers, working-day bars break over weekends; Week view keeps the original single-row timeline in `PlannerBoard.tsx`. Nav links step from the unpadded anchor in `src/app/planner/page.tsx` (range labels: "August 2026", short range for 6w, "August – October 2026").
- **`src/lib/actions/planner.ts`**: `scheduleJob` (start + duration OR start + end; auto-end; weekend starts roll to Monday; auto-colour on first schedule; logs activity), `moveJobToDate`, `resizeJobDuration`, `unscheduleJob`, `reorderPlanner` (vertical drag AND overlap resolution — same action), `reorderUnscheduled`, `movePlannerJob`, `setPlannerColor`, `updateJobPlannerMeta`. `createJob` in `jobs.ts` delegates to `scheduleJob` when planned start is set on the New Job form.
- **`src/app/planner/page.tsx`** (server): GET filter form (engineer/status/planning status/priority/type/client + "Hide completed" default-ON via `completed=show|hide` pair), unscheduled = `plannedStartDate: null` and job status not Completed/Cancelled. Weekly workload stats strip.
- **`src/components/PlannerBoard.tsx`** (client): rows-per-job Gantt with drag bar to reschedule (`moveJobToDate`), drag edges to resize (`resizeJobDuration`), drag row/label to reorder, drop unscheduled cards onto timeline, job popover (Change Dates, palette + custom colour, engineer, priority, Move Up/Down, Unschedule, Open Job), Schedule Job modal (SearchableSelect), unscheduled side panel (`?panel=unscheduled`), client-side Sort By (visual only — never touches manual order) + "View By Engineer" grouping. Bars: colour from DB, completed muted, overdue hatched, ◂▸ clip arrows, inspection diamonds, task ⚑ badge.
- **Elsewhere**: Sidebar "Job Planner" entry; job detail Overview has a Planning card (colour/start/end/duration/planning status + View in Planner); New Job form has optional Planned Start/Duration/Unit; dashboard has 4 planner cards.

## Second update round (commit 3fb12ba, engineering-app)

- **Employees**: `Employee` model (name/role/email/phone/active); Settings → Employees tab (`EmployeeManager`); searchable assignee picker on job new/edit forms storing `employeeId` (legacy `assignedEngineer` string kept for compat).
- **Invoice presets**: `InvoicePreset` model (name/description/unitPrice/defaultQty/gstApplicable/active); Settings → Invoice Presets (`PresetManager`); `LineItemsEditor` preset dropdown auto-fills rows; `presetOpts()` helper in `src/lib/presets.ts`.
- **Numbering**: `Job.jobNumber`/`Quote.quoteNumber` are Strings now; Settings → Numbering (`NumberingForm`) edits prefix/digits/next with live preview (defaults J66/Q66); `consumeSequence`/`allocateJobNumber`/`allocateQuoteNumber` in `src/lib/numbering.ts` use `NumberSequence` rows (key, year) in atomic transactions. Existing numbers never touched by settings changes.
- **ClientSelect** (`src/components/ClientSelect.tsx`): shared search picker with inline "+ Add New Client" modal (pinned `noFilter` option in SearchableSelect); used in jobs/new, quotes/new, quotes/[id]; job edit keeps client fixed. `key={value-selKey}` remount keeps freshly-created client selected.
- **Planner**: weekends hatched, engineer filter also reads `assignedEmployee`, labels = job № + full street/suburb. **Calendar**: chips use planner colours, show job №.
- **Testing**: `npm test` → `node tests/run.cjs` (27 assertions, baseline-based so it runs against live data; covers numbering idempotency, existing-number preservation, transaction rollback).
- Gotcha: native `<input type=date>` can't be filled by browser tooling's `browser_type`; verify planner scheduling via planner modal or DB.

## User Preferences (from update request)

- Numbered fix lists — implement in place, do NOT rebuild or duplicate pages; preserve existing structure.
- Verify changes in the browser before reporting; clean up test data afterwards.
- Commit with Co-authored-by: openhands <openhands@all-hands.dev>; push to `engineering-app` only when asked.
