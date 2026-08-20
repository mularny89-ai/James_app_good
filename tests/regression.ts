/**
 * Regression tests for numbering, formatting and planner day maths (Sections 27/47).
 * Run with: npx sucrase-node tests/regression.ts
 * DB-affecting tests run inside an interactive transaction that is rolled back —
 * the database is never mutated.
 */
import { db } from "../src/lib/db";
import { formatNumber, formatJobNumber, formatQuoteNumber, nextNumber, peekNextJobNumber, peekNextQuoteNumber } from "../src/lib/numbering";
import { getSettings } from "../src/lib/settings";
import { fmtAddress, readableTextOn, splitAddress } from "../src/lib/format";
import { addDuration, durationBetween, fromIsoDay, isoDay, nextWorkingDay, isWeekend } from "../src/lib/planner";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ok ${name}`); }
  else { failed++; console.log(` FAIL ${name}`); }
}
function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected);
  if (actual !== expected) console.log(`     got: ${actual}  want: ${expected}`);
}

const ROLLBACK = { tag: "rollback" };

async function main() {
  const settings = await getSettings();

  // ---------- Pure helpers ----------
  eq("formatNumber J66/3/1", formatNumber("J66", 3, 1), "J66001");
  eq("formatNumber Q66/3/12", formatNumber("Q66", 3, 12), "Q66012");
  eq("formatNumber pads longer digits", formatNumber("J66", 4, 3), "J660003");
  eq("readableTextOn dark", readableTextOn("#34368b"), "#ffffff");
  eq("readableTextOn light", readableTextOn("#f4f6f9"), "#1e2430");
  eq("fmtAddress street+locality", fmtAddress({ street: "14 Example Street", suburb: "Broadbeach", state: "QLD", postcode: "4218" }), "14 Example Street, Broadbeach QLD 4218");
  eq("fmtAddress without street", fmtAddress({ suburb: "Broadbeach", state: "QLD" }), "Broadbeach QLD");
  eq("splitAddress comma", splitAddress("14 Example Street, Broadbeach").street, "14 Example Street");

  // ---------- Planner working-day maths (Sections 17–18, 50) ----------
  const computeEnd = (start: string, n: number, unit: string) => isoDay(addDuration(fromIsoDay(start), n, unit));
  eq("Sat Aug 2026 is weekend", isWeekend(fromIsoDay("2026-08-22")), true);
  eq("Mon Aug 2026 not weekend", isWeekend(fromIsoDay("2026-08-24")), false);
  eq("nextWorkingDay rolls Sat -> Mon", isoDay(nextWorkingDay(fromIsoDay("2026-08-22"))), "2026-08-24");
  eq("Thu 27 Aug + 5 wd = Wed 2 Sep", computeEnd("2026-08-27", 5, "working"), "2026-09-02");
  eq("Fri 21 Aug + 2 wd = Mon 24 Aug", computeEnd("2026-08-21", 2, "working"), "2026-08-24");
  eq("Fri 21 Aug + 5 wd = Thu 27 Aug", computeEnd("2026-08-21", 5, "working"), "2026-08-27");
  eq("calendar days continue over weekend", computeEnd("2026-08-27", 5, "calendar"), "2026-08-31");
  eq("duration included end (working)", durationBetween(fromIsoDay("2026-08-27"), fromIsoDay("2026-09-02"), "working"), 5);
  eq("duration (calendar)", durationBetween(fromIsoDay("2026-08-27"), fromIsoDay("2026-08-31"), "calendar"), 5);

  // peek helpers must return the next number WITHOUT consuming it
  const peekedJob = await peekNextJobNumber();
  const peekedJob2 = await peekNextJobNumber();
  eq("peekNextJobNumber is idempotent", peekedJob, peekedJob2);
  const peekedQuote = await peekNextQuoteNumber();
  const peekedQuote2 = await peekNextQuoteNumber();
  eq("peekNextQuoteNumber is idempotent", peekedQuote, peekedQuote2);

  // ---------- Numbering persistence in a rolled-back transaction ----------
  const baseJobs = await db.job.count();
  const baseClients = await db.client.count();
  const baseSettings = await getSettings();
  try {
    await db.$transaction(async (tx) => {
      const j1 = await nextNumber(tx, "job");
      check("job sequence row created (year 0)", !!await tx.numberSequence.findUnique({ where: { key_year: { key: "job", year: 0 } } }));

      const jobNo = await formatJobNumber(j1.seq);
      eq("next job number from settings", jobNo, `${settings.jobPrefix}${String(j1.seq).padStart(settings.jobDigits, "0")}`);

      const q1 = await nextNumber(tx, "quote");
      const quoteNo = await formatQuoteNumber(q1.seq);
      eq("next quote number from settings", quoteNo, `${settings.quotePrefix}${String(q1.seq).padStart(settings.quoteDigits, "0")}`);

      // Simulate a real allocated job row; verify its stored number survives a
      // later settings change (only future allocations use new formats).
      const toStart = await tx.jobStatus.findUniqueOrThrow({ where: { name: "To Start" } });
      const client = await tx.client.create({ data: { name: "__regression test__" } });
      const jobNoAtCreate = await formatJobNumber(j1.seq);
      const job = await tx.job.create({
        data: { jobNumber: jobNoAtCreate, name: "__regression__", clientId: client.id, statusId: toStart.id },
      });
      check("stored job number matches allocation at creation", job.jobNumber === jobNoAtCreate);

      // Flipping settings must not alter the already-allocated row.
      await tx.companySettings.update({ where: { id: 1 }, data: { jobPrefix: "__test__" } });
      const recheck = await tx.job.findUnique({ where: { id: job.id } });
      check("existing job number untouched by settings change", recheck?.jobNumber === jobNoAtCreate);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  check("transaction rolled back (job count unchanged)", (await db.job.count()) === baseJobs);
  check("transaction rolled back (client count unchanged)", (await db.client.count()) === baseClients);
  const post = await getSettings();
  check("settings restored after rollback", post.jobPrefix === baseSettings.jobPrefix && post.jobDigits === baseSettings.jobDigits);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
