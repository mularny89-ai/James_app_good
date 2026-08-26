import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import EmailComposer, { type EmailJobOpt } from "@/components/EmailComposer";
import InboxPanel from "@/components/InboxPanel";
import { msalConnection, msalConfigured } from "@/lib/msal";

export const dynamic = "force-dynamic";

export default async function EmailPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { connected, account } = await msalConnection();
  const configured = await msalConfigured();
  const saved = searchParams.saved;
  const notice = searchParams.error;
  const justConnected = searchParams.connected;

  const jobsRaw = await db.job.findMany({
    where: { archived: false, status: { name: { notIn: ["Completed", "Cancelled"] } } },
    include: { client: true },
    orderBy: { jobNumber: "desc" },
    take: 500,
  });
  const jobs: EmailJobOpt[] = jobsRaw.map((j) => ({
    id: j.id,
    label: `${j.jobNumber} — ${[j.siteStreet, j.siteSuburb].filter(Boolean).join(", ") || j.siteAddress || j.client.name}`,
  }));

  return (
    <div className="p-5">
      <PageHeader title="Email" subtitle="Outlook inbox, sending and document email generator" />

      {notice && (
        <div className="mb-4 rounded-md border border-err/30 bg-red-50 px-3 py-2 text-sm text-err">
          {notice === "msal_not_configured"
            ? "Microsoft 365 credentials aren't set on this server (MSAL_CLIENT_SECRET missing)."
            : decodeURIComponent(notice)}
        </div>
      )}
      {justConnected && (
        <div className="mb-4 rounded-md border border-ok/30 bg-green-50 px-3 py-2 text-sm text-ok">
          Connected to Microsoft 365 as {decodeURIComponent(justConnected)} ✓
        </div>
      )}
      {saved && (
        <div className="mb-4 rounded-md border border-ok/30 bg-green-50 px-3 py-2 text-sm text-ok">
          Credentials saved ✓ — now click Connect Microsoft 365 and sign in.
        </div>
      )}

      {/* Microsoft 365 connection */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-muted">Microsoft 365 Connection</h2>
            <p className="text-sm text-ink-muted">
              {connected ? (
                <>Connected as <strong>{account}</strong> — inbox and sending are live below.</>
              ) : configured ? (
                <>Not connected. Connect once with your Microsoft 365 login and the app can read your inbox and send email for you.</>
              ) : (
                <>Almost there — paste the client secret from your Azure app registration below, then connect.</>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {connected ? (
              <>
                <a href="https://outlook.office.com/mail/" target="_blank" rel="noreferrer" className="btn">
                  Open Outlook on the Web
                </a>
                <form action="/api/email/disconnect" method="POST">
                  <button className="btn" type="submit">Disconnect</button>
                </form>
              </>
            ) : (
              <a href="/api/email/connect" className="btn-primary">Connect Microsoft 365</a>
            )}
          </div>
        </div>
      </div>

      {!configured && !connected && (
        <div className="card mb-4 p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">One-time setup: paste your client secret</h2>
          <form action="/api/email/config" method="POST" className="flex flex-wrap items-end gap-2">
            <div className="min-w-72 flex-1">
              <label className="label">Client secret (the "Value" from Certificates &amp; secrets)</label>
              <input name="secret" type="password" className="input w-full" placeholder="e.g. aBc1~xYz..." required />
            </div>
            <button type="submit" className="btn-primary">Save</button>
          </form>
          <p className="mt-2 text-xs text-ink-muted">
            Stored in the app database, never shown again. Azure app: Mellan Practice Manager
            (client ID eedcf15a-…3275 is already configured).
          </p>
        </div>
      )}

      <InboxPanel connected={connected} account={account} />

      <div className="mt-4">
        <EmailComposer jobs={jobs} connected={connected} />
      </div>
    </div>
  );
}
