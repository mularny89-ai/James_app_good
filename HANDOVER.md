# HANDOVER — Full Transition Notes (2026-08-24/25 → 26)

Read this first if you're picking up the Mellan Practice Manager. Everything here
is verified against the code in this repo right now.

## Stack & run

- Next.js 14 App Router + Prisma 5.22 (SQLite at `prisma/dev.db`) + Tailwind
- Start: `npm run start` (port 12000, work-1 URL) or `npm run dev`
- Server dies on idle → restart with
  `setsid nohup npm run start > /tmp/next-server.log 2>&1 < /dev/null & disown`
- Kill port: `for p in $(ps aux|grep next-server|grep -v grep|awk '{print $2}'); do kill -9 $p; done`
- Build check: `npm run build`
- Tests: `npm test` → `node tests/run.cjs` (baseline-based; live-data safe). 52 assertions.

## Repo state

- Branch: `engineering-app` (not pushed this session — all planner work is in the working tree)
- Recent commits (previous session): `f55de23` Forms …
- The planner overhaul below is **uncommitted** — commit it when the user approves.

## Dummy data in the DB (do NOT wipe — user wants it kept for testing)

- **Clients**: Danny D (id 2, MCE), Poo Face (id 4, PFC)
- **Employees**: James Mellan (Structural Engineer, assignable)
- **Jobs**:
  - id 1 `J66001` — Danny D · To Start · 2026-08-11→2026-08-14 · 4 working days · colour `#3b5bdb` · plannerSortOrder 10
  - id 3 `J66002` — Danny D · To Start · 2026-08-26→2026-09-01 · 5 working days · colour `#9c36b5` · plannerSortOrder 20 · siteAddress "45 James Street, Bong QLD 4225"
  - Both overlap for testing planner lanes
- **Quotes**: Q66003 (Draft, client 2, "14 Thomas Street, Tomville", New Home, subtotal 1200), Q66004 (Accepted, client 2, "45 James Street, Bong", New Home, subtotal 400)
- **Site inspections** (independent, not linked to jobs — jobId null):
  - id 1: James Street, Glossodia NSW 2756 · 2026-08-26 09:00–10:00 · Scheduled
  - id 2: 67 Thomas Street, Ultimo NSW 2007 · 2026-08-25 09:00–10:00 · Scheduled
  - id 3: 45 Track Road, Tallebudgera · 2026-08-25 09:00–10:00 · Confirmed
- Tasks list is currently empty; `calendarEvent` table empty.

## Planner overhaul (the big work of this session)

The Job Planner's Month / 6 Weeks / 3 Months views were redesigned from per-job
rows to **one shared calendar grid** with overlapping jobs stacked in lanes.

Files involved:
- `src/lib/planner.ts` — helpers
- `src/components/PlannerWrappedView.tsx` — the shared wrapped-grid renderer (Month/6W/3M)
- `src/components/PlannerBoard.tsx` — dispatcher; Week view; filters; wheel nav
- `src/app/planner/page.tsx` — server page (builds DayCol, nav hrefs, filters)

### Behaviour

1. **Shared grid + lanes** — `assignLanes()` in PlannerWrappedView assigns each overlapping job to lane 0, 1, 2… within each week strip. Footer note says "N overlapping jobs are stacked in separate lanes…".

2. **Rolling week-anchored windows** — `viewWindow()` was **changed**: Month=28 days, 6 Weeks=42 days, 3 Months=84 days, all starting on the Monday of the anchor's week. NOT padded to calendar-month boundaries anymore — this is what makes week-scroll work and prevents month-boundary jobs being skipped. `stepAnchor()` still steps by view-length for the ‹Prev/Next› buttons. Regression tests updated accordingly (`tests/regression.ts`).

3. **Day numbers always visible** — `numberOverlay()` renders a `pointer-events-none z-30` grid of white chips (bg-white/60) above bars so day numbers stay visible over bars; bars remain clickable/draggable underneath.

4. **Month separators + alternating shading** — `stripMeta()` detects the first day-of-month in each strip arithmetically from ISO; renderStrip draws a 4px brand-colour separator + bold "MONTH YEAR" label; `stripStyle` alternates `rgba(248,250,252,0.7)` tint per month.

5. **Clean continuation labels** — `barLabel(density, j, segDays, firstSeg)` — label only on the first real segment (or when window-clipped). Continuation segments show just the ◂ / ▸ arrows at the edge.

6. **Bar label indent** — first segment's label gets `paddingLeft` 20–22px so it sits beside the day-number chip, not under it.

7. **Wheel navigation = ±1 week, every view** — in `PlannerBoard.tsx`, a native `wheel` listener with `passive:false` on the grid container accumulates deltas; at 60px threshold it navigates to `start= anchor ±7 days`, using the Prev/Next href shape only as a filter-carrier template, then locks 500ms. Week view, Month, 6W, 3M all behave the same.

8. **Week row label clipping** — row label cell is `overflow-hidden` with inner `overflow-hidden` wrapper and `w-full truncate` button, so long titles/addresses don't bleed into the timeline.

9. **Responsive lane heights** — `useEffect` in PlannerWrappedView computes `laneH = clamp((viewportHeight - elementTop - 24) / nWeeks - 16, MIN, MAX)` per density with MAX = { month:34, sixweeks:28, threemonths:24 }. Root div has `id="planner-wrapped-root"` for measuring. Fonts bumped to text-xs / 11px / 10px.

### Testing gotchas

- Native `<input type=date>` can't be filled by browser_type — use planner Schedule modal or DB.
- Browser tool indices shift on every interaction — re-run `browser_get_state`.
- The planner tests in `tests/regression.ts` now assert the rolling-window contract.

## User preferences (must-honour)

- Numbered fix lists — **implement in place, do NOT rebuild or duplicate pages**. Preserve structure.
- **Verify in the browser** before reporting. Clean up test data if you created any.
- Commit with `Co-authored-by: openhands <openhands@all-hands.dev>`; push to `engineering-app` only when asked.
- Keep dummy data (the jobs/quotes/inspections above) — they exist to make planner verification possible.

## AGENTS.md

The full automated context lives in `AGENTS.md` at repo root — loaded automatically every conversation. This handover file supplements it with the session-specific state.
