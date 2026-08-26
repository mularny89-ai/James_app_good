# HANDOVER — Full Transition Notes (2026-08-26, end of email-integration session)

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
- sqlite3 CLI not available — use `node -e` with PrismaClient for DB access.
- TS target doesn't support spread/iteration of Sets/Maps — use `Array.from(...)`.

## Repo state

- Branch: `engineering-app`, **everything committed and pushed** (HEAD `7a327f2`).
- Working tree clean. `git status` should show nothing.

## Email module (this session's big build) — `/email`

Sidebar "✉ Email" → page with **Microsoft 365 Connection card** + **EmailTabs**
(Mail | Assistant | Quote/Invoice Generator).

### Microsoft 365 / Outlook integration (LIVE, connected as james@mellanconsulting.com.au)

- **Azure app registration**: "Mellan Practice Manager", client ID `eedcf15a-9a4b-4325-a2f4-f7fb0dfe3275`,
  single-tenant, tenant `3a228346-9ee3-4dbb-a8da-3a06fc8d550d` (DEFAULT_TENANT in `src/lib/msal.ts` —
  /common is rejected for single-tenant apps, AADSTS50194).
- Delegated Graph perms granted: Mail.Read, Mail.Send, offline_access, User.Read.
- **Client secret lives in the DB** (`CompanySettings.msalClientSecret`), pasted via a form on the
  Email page (`/api/email/config` — form-data POST, also accepts `aiKey`). Env `MSAL_CLIENT_SECRET`
  overrides if set. Secret form shows whenever not connected (so a wrong value can be replaced).
- MSAL token cache persisted in `CompanySettings.msalTokenCache` (+ `msalAccount`, `msalTenantId`);
  refresh-token `acquireTokenSilent` keeps it connected.
- **Redirect URI is request-derived** (`requestBase()` from x-forwarded-proto/host) — the proxy
  passes localhost:12000 internally, so never build redirects from `req.url` host alone.
  Registered redirect in Azure: `https://work-1-jjpurumwskflifxe.prod-runtime.all-hands.dev/api/email/callback`.
  A new domain needs its callback added under Authentication in the app registration.
- API routes: `/api/email/connect` (OAuth start), `/callback`, `/disconnect`, `/folders`,
  `/messages` (folder + `?q=` full-mailbox `$search` + `?skip` paging), `/messages/[id]`
  (GET full + attachments meta, PATCH isRead/flag, DELETE), `/messages/[id]/attachments/[attId]`
  (streams file), `/send` (sendMail or /reply|/replyAll threading, attachments ≤3MB, parses
  "Name <addr>;" lists, logs to job activity), `/contacts` (autocomplete: clients + employees +
  Graph full-mailbox search), `/to-task` (GET lists / POST create task w/ listId), `/assistant`.
- **Graph gotcha**: `wellKnownName` is NOT selectable on this mailbox — folders matched by
  display name in `/api/email/folders`.

### Mail tab — `src/components/OutlookView.tsx`

Outlook-style 3-pane: folder sidebar (unread counts), message list (unread bold, 📎, ⚑ flag
toggle, smart dates, client/job chips, Load more), reading pane (sandboxed iframe for HTML,
attachment downloads, Reply/ReplyAll/Fwd/Delete, mark read/unread, **✓ Task** → dropdown of all
task lists). Toolbar: New mail, search (all folders), refresh, Unread + 📎/👤/⚑ filter chips.
Compose pane: To/Cc use `EmailInput` (autocomplete, keyboard nav, inserts `Name <addr>;`),
📎 attachments, Send via Graph.

### Assistant tab — `src/components/AssistantView.tsx` + `/api/email/assistant`

- Full-page chat: quick-action cards (Triage inbox / Waiting on me / Today's summary / Quotes
  outstanding), conversation thread, **tool activity chips** per turn, draft preview card with
  "Open in compose →" (hands off to Generator tab via `EmailComposer initialDraft`).
- **Providers**: no key → **local Ollama** (`qwen2.5:1.5b` default — 3b OOM-killed the Next
  server under concurrent load; OLLAMA_BASE_URL/OLLAMA_MODEL env override). Key set
  (`ANTHROPIC_API_KEY` env or `CompanySettings.aiApiKey`) → Claude Sonnet. Same 4 tools both
  paths: search_mailbox, read_email (8000 chars), get_job_context (job № or address → client/
  status/quote/invoices), draft_email. Agentic loop capped at 6 rounds; returns
  `{reply, draft, model, activity}`.
- **Ollama runs on this box** (`ollama serve`, port 11434, models qwen2.5:1.5b + 3b pulled).
  It is NOT in git — a fresh sandbox needs `ollama serve` + `ollama pull qwen2.5:1.5b` again.
  ~30–90s per question on CPU; one question at a time.
- System prompt: Mellan voice (plain AU English, "Cheers, James", $400+GST inspections,
  Form 15/12 wording), mandates search-before-answer.

### Generator tab — `src/components/EmailComposer.tsx`

Job dropdown + Quote/Invoice toggle → `/api/email/draft` merges the Settings email template
(quote) or default invoice wording with job/client/doc data. Copy buttons, Open in Mail App
(mailto), **Send via Outlook** when connected. Accepts `initialDraft` from the assistant.

## Earlier this session (all committed)

- `76cc0..` split site address + autocomplete for quotes/invoices
- `b468393` email template quote fixes + Add-Task modal (backdrop/Enter/Save)
- `c5e5f2c` jobs list year grouping; `5160202` job № sort toggle + short job names
  (`J66001 — 14 Bob Street, Bobtown` — street+suburb only, in createJob + acceptQuoteAndCreateJob)
- `837040c` Add-task modal: plain Save on blank form closes
- `86877c4` Quote № / Invoice № column sort toggles (numeric-aware, persists through filters)
- `9b61fbf` Email section v1; `b0b6897` full M365 integration; `292b5aa` forwarded-host redirects
- `54c9b2d` client ID default; `ea48ba5` paste-in-app secret; `b609761` form-data fix;
  `c90717a` tenant default; `f3e5dbe` secret form always visible until connected
- `a57109a` Outlook 3-pane UI; `09f0397` autocomplete + unread filter; `9c6ef4f` assistant v1;
  `c0b8eb1` Ollama provider; `f5242a8` smart views + email-to-task; `2c0f6f4` task list dropdown;
  `7a327f2` tabbed interface + full-page assistant

## User preferences (unchanged)

- Numbered fix lists; implement in place, don't rebuild pages.
- Verify in browser before reporting; clean up test data.
- **Commit AND push to `engineering-app` as soon as verified** — sandbox resets wipe the tree.
- If push auth fails: `git remote set-url origin https://${GITHUB_TOKEN}@github.com/mularny89-ai/James_app_good.git`
- Native `<input type=date>` and native `<select>` can't be filled by browser tooling.
- Server sleeps when idle — tell user to wait ~15s and refresh, or restart it.

## Known rough edges / next candidates

- Local model is "junior assistant" smart; Claude key upgrades quality instantly.
- No auto-filing rules yet (deliberately — destructive); deterministic rules are the safe next step.
- Assistant is not streaming — long waits show a spinner, not partial text.
- Attachments >3MB on send need the Graph upload-session flow (not implemented).
