import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { toInputDate } from "@/lib/format";
import { updateQuote, setQuoteStatus, duplicateQuote, acceptQuoteAndCreateJob, archiveQuote } from "@/lib/actions/quotes";
import { PageHeader, SoftBadge, Field } from "@/components/ui";
import ClientSelect from "@/components/ClientSelect";
import SiteAddressFields from "@/components/SiteAddressFields";
import TaskItemsEditor from "@/components/TaskItemsEditor";
import { presetOpts } from "@/lib/presets";
import BrandDocument from "@/components/BrandDocument";
import ConfirmButton from "@/components/ConfirmButton";
import PrintButton from "@/components/PrintButton";
import PrintOptionsPanel from "@/components/PrintOptionsPanel";
import QuoteEmailPanel from "@/components/QuoteEmailPanel";
import { getQuoteEmailTemplate, mergeEmailTemplate } from "@/lib/email-template";
import { quoteStatusColor } from "@/lib/constants";
import { parsePrintOpts } from "@/lib/print-opts";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const id = parseInt(params.id);
  const mode = searchParams.mode ?? "preview";

  const [quote, settings, clients, types, presets] = await Promise.all([
    db.quote.findUnique({ where: { id }, include: { items: { orderBy: { order: "asc" } }, client: true, job: true, activities: { orderBy: { createdAt: "desc" }, take: 20 } } }),
    getSettings(),
    db.client.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.jobType.findMany({ orderBy: { order: "asc" } }),
    presetOpts(),
  ]);
  if (!quote) notFound();

  const converted = !!quote.job;
  const editable = mode === "edit" && !converted && quote.status !== "Cancelled";
  const printOpts = parsePrintOpts(searchParams);

  const emailTemplate = await getQuoteEmailTemplate();
  const emailMerge = {
    clientName: quote.client.name,
    contactName: quote.contactName || quote.client.contactPerson,
    siteAddress: quote.siteAddress,
    quoteNumber: quote.quoteNumber,
    total: quote.total,
    validUntil: quote.validUntil,
    companyName: settings.companyName,
  };
  const emailProps = {
    defaultTo: quote.client.email,
    defaultSubject: mergeEmailTemplate(emailTemplate.subject, emailMerge),
    defaultBody: mergeEmailTemplate(emailTemplate.body, emailMerge),
    defaultLeadTime: "2 weeks",
    defaultCompletionTime: "2 weeks",
  };

  async function updateBound(fd: FormData) {
    "use server";
    await updateQuote(id, fd);
  }

  return (
    <div className="p-5">
      <div className="no-print">
        <PageHeader
          title={<span style={{ color: "var(--brand-primary)" }}>{quote.quoteNumber}</span>}
          subtitle={
            <span className="flex items-center gap-3">
              <SoftBadge label={quote.status} color={quoteStatusColor(quote.status)} />
              <span>Client: <Link href={`/clients/${quote.clientId}`} className="link">{quote.client.name}</Link></span>
              {converted && (
                <span>
                  Job created from this quote:{" "}
                  <Link href={`/jobs/${quote.job!.id}`} className="link font-bold">{quote.job!.jobNumber}</Link>
                </span>
              )}
            </span>
          }
          actions={
            <>
              {editable ? (
                <Link href={`/quotes/${id}`} className="btn">Preview</Link>
              ) : (
                !converted && quote.status !== "Cancelled" && <Link href={`/quotes/${id}?mode=edit`} className="btn">Edit</Link>
              )}
              <PrintButton />
              <Link href={`/quotes/${id}?email=1`} className="btn">✉ Email</Link>
              <form action={async () => { "use server"; await duplicateQuote(id); }}>
                <button type="submit" className="btn">Duplicate</button>
              </form>
              {!converted && quote.status === "Draft" && (
                <form action={async () => { "use server"; await setQuoteStatus(id, "Sent"); }}>
                  <button type="submit" className="btn">Mark Sent</button>
                </form>
              )}
              {!converted && (quote.status === "Draft" || quote.status === "Sent") && (
                <>
                  <form action={async () => { "use server"; await setQuoteStatus(id, "Declined"); }}>
                    <button type="submit" className="btn">Mark Declined</button>
                  </form>
                  {/* SECTION 52 — the critical workflow */}
                  <ConfirmButton
                    label="Accept Quote & Create Job"
                    message={`Accept ${quote.quoteNumber} and automatically create the next job?`}
                    className="btn-primary"
                    onConfirm={async () => { "use server"; await acceptQuoteAndCreateJob(id); }}
                  />
                </>
              )}
              {!converted && (
                <ConfirmButton
                  label="Archive"
                  message="Archive this quote?"
                  onConfirm={async () => { "use server"; await archiveQuote(id); }}
                />
              )}
            </>
          }
        />
        {searchParams.email === "1" && <QuoteEmailPanel {...emailProps} />}
      </div>

      {editable ? (
        <form action={updateBound} className="card mx-auto max-w-4xl space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client *">
              <ClientSelect name="clientId" required defaultValue={String(quote.clientId)}
                options={clients.map((c) => ({ value: String(c.id), label: c.name, hint: c.company }))} />
            </Field>
            <Field label="Client Contact"><input name="contactName" className="input" defaultValue={quote.contactName} /></Field>
            <Field label="Project"><input name="project" className="input" defaultValue={quote.project} /></Field>
            <Field label="Project Type">
              <select name="projectType" className="input" defaultValue={quote.projectType}>
                <option value="">—</option>
                {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </Field>
            <SiteAddressFields defaultStreet={quote.siteStreet || quote.siteAddress} defaultSuburb={quote.siteSuburb} />
            <Field label="Scope of Works" className="sm:col-span-2"><textarea name="scope" rows={3} className="input" defaultValue={quote.scope} /></Field>
            <Field label="Exclusions" className="sm:col-span-2"><textarea name="exclusions" rows={2} className="input" defaultValue={quote.exclusions} /></Field>
            <Field label="Valid Until"><input type="date" name="validUntil" className="input" defaultValue={toInputDate(quote.validUntil)} /></Field>
          </div>
          <div>
            <h3 className="section-title mb-2">Tasks</h3>
            <TaskItemsEditor
              items={quote.items.map((i) => ({ name: i.name, description: i.description, qty: i.qty, unitPrice: i.unitPrice, gst: i.gst }))}
              presets={presets}
              gstRate={settings.gstRate}
              documentTitle="Quote"
              brandColor={settings.primaryColor}
            />
          </div>
          <Field label="Internal Notes"><textarea name="notes" rows={2} className="input" defaultValue={quote.notes} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Link href={`/quotes/${id}`} className="btn">Cancel</Link>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BrandDocument
                settings={settings}
                docType="Quotation"
                docNumber={quote.quoteNumber}
                date={quote.date}
                dueOrValid={{ label: "Valid Until", value: quote.validUntil }}
                clientName={quote.client.name}
                clientCompany={quote.client.company}
                billingAddress={quote.client.billingAddress}
                siteAddress={quote.siteAddress}
                project={quote.project}
                jobNumber={quote.job?.jobNumber}
                opts={printOpts}
                items={quote.items}
                subtotal={quote.subtotal}
                gst={quote.gst}
                total={quote.total}
                gstRate={settings.gstRate}
                notes={quote.notes}
                exclusions={quote.exclusions}
              />
            </div>
            <div className="no-print">
              <PrintOptionsPanel initial={printOpts} omit={["paymentAdvice"]} />
            </div>
          </div>
          {quote.activities.length > 0 && (
            <div className="no-print mx-auto mt-4 max-w-3xl card p-4">
              <h3 className="section-title mb-2">History</h3>
              <ul className="space-y-1 text-sm">
                {quote.activities.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="w-40 shrink-0 text-xs text-ink-muted">{new Date(a.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span>{a.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
