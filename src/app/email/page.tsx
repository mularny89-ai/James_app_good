import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import EmailComposer, { type EmailJobOpt } from "@/components/EmailComposer";

export const dynamic = "force-dynamic";

export default async function EmailPage() {
  const settings = await db.companySettings.findUnique({ where: { id: 1 } });
  const email = settings?.email ?? "";

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
      <PageHeader title="Email" subtitle="Outlook integration and document email generator" />

      {/* Outlook integration */}
      <div className="card mb-4 p-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-muted">Outlook Integration</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Direct inbox sync (read and send email from inside the app) requires connecting your Microsoft 365
          account — say the word and I’ll wire that up. For now, use these shortcuts:
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://outlook.office.com/mail/deeplink/compose?mailtouri=${encodeURIComponent(`mailto:?subject=`)}`}
            target="_blank"
            rel="noreferrer"
            className="btn"
          >
            ✉ New Email in Outlook
          </a>
          <a href="https://outlook.office.com/mail/" target="_blank" rel="noreferrer" className="btn">
            Open Outlook Inbox
          </a>
          {email && (
            <a href={`mailto:${email}`} className="btn">
              Your address: {email}
            </a>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          The generator below fills in To / Subject / Body — use <strong>Open in Mail App</strong> to send it
          through your default mail client (Outlook if it’s set as default), or copy the fields into an Outlook
          message.
        </p>
      </div>

      <EmailComposer jobs={jobs} />
    </div>
  );
}
